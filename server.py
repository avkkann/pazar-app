from flask import Flask, jsonify, send_from_directory
import json, os, threading, signal, sys
from datetime import datetime

app = Flask(__name__, static_folder=".")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

_scraper_lock    = threading.Lock()
_scraper_running = False
_shutdown        = False
_start_time      = datetime.utcnow()


def load_json(filename):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
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
    urunler_ok = os.path.exists(os.path.join(BASE_DIR, "urunler.json"))
    hal_ok     = os.path.exists(os.path.join(BASE_DIR, "hal_fiyatlari.json"))
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
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/urunler")
def urunler():
    data = load_json("urunler.json")
    if data is None:
        return jsonify({"hata": "urunler.json bulunamadi."}), 404
    return jsonify(data)


@app.route("/api/hal")
def hal():
    data = load_json("hal_fiyatlari.json")
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


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Sunucu basliyor... http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
