from flask import Flask, jsonify, send_from_directory, make_response
import json, os, threading, signal, sys
from datetime import datetime

app = Flask(__name__, static_folder=".")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", BASE_DIR)
os.makedirs(DATA_DIR, exist_ok=True)

URUNLER_FILE = os.path.join(DATA_DIR, "urunler.json")
HAL_FILE     = os.path.join(DATA_DIR, "hal_fiyatlari.json")

_scraper_lock    = threading.Lock()
_scraper_running = False
_shutdown        = False
_start_time      = datetime.utcnow()


def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def _run_scrapers_bg():
    global _scraper_running
    try:
        import run_scrapers
        run_scrapers.main()
    finally:
        _scraper_running = False


# ── Graceful shutdown ──────────────────────────────────────────
def _handle_sigterm(signum, frame):
    """
    Railway SIGTERM gönderince önce in-flight isteklerin bitmesi beklenir,
    sonra süreç temiz kapanır. Daemon thread'ler (scraper) otomatik durur.
    """
    global _shutdown
    _shutdown = True
    print("SIGTERM alindi, graceful shutdown basliyor...", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, _handle_sigterm)


# ── Routes ────────────────────────────────────────────────────

@app.route("/health")
def health():
    urunler_ok = os.path.exists(URUNLER_FILE)
    hal_ok     = os.path.exists(HAL_FILE)
    uptime_s   = int((datetime.utcnow() - _start_time).total_seconds())
    status = {
        "status":          "ok" if (urunler_ok and hal_ok) else "degraded",
        "uptime_seconds":  uptime_s,
        "urunler_json":    urunler_ok,
        "hal_json":        hal_ok,
        "scraper_running": _scraper_running,
    }
    return jsonify(status), 200 if status["status"] == "ok" else 503


@app.route("/")
def index():
    resp = make_response(send_from_directory(BASE_DIR, "index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@app.route("/api/urunler")
def urunler():
    data = load_json(URUNLER_FILE)
    if data is None:
        return jsonify({"hata": "urunler.json bulunamadi."}), 404
    return jsonify(data)


@app.route("/api/hal")
def hal():
    data = load_json(HAL_FILE)
    if data is None:
        return jsonify({"hata": "hal_fiyatlari.json bulunamadi."}), 404
    return jsonify(data)


@app.route("/api/guncelle-d5336945")
def guncelle():
    global _scraper_running

    with _scraper_lock:
        if _scraper_running:
            return jsonify({"durum": "zaten_calisiyor", "mesaj": "Scraper zaten calisiyor."}), 409
        _scraper_running = True

    thread = threading.Thread(target=_run_scrapers_bg, daemon=True)
    thread.start()

    return jsonify({"durum": "baslatildi", "mesaj": "Scraper'lar arka planda baslatildi."}), 202


@app.route("/sw.js")
def service_worker():
    resp = make_response(send_from_directory(BASE_DIR, "sw.js"))
    resp.headers["Content-Type"] = "application/javascript"
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Sunucu basliyor... http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
