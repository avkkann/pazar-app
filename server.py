from flask import Flask, jsonify, send_from_directory, make_response, request
import json, os, threading, signal, sys
from datetime import datetime

app = Flask(__name__, static_folder=".")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = BASE_DIR
os.makedirs(DATA_DIR, exist_ok=True)

URUNLER_FILE = os.path.join(DATA_DIR, "urunler.json")
HAL_FILE     = os.path.join(DATA_DIR, "hal_fiyatlari.json")

_scraper_lock    = threading.Lock()
_scraper_running = False
_shutdown        = False
_start_time      = datetime.utcnow()


PAGE_SIZE = 48

KATEGORI_MAP = {
    'meyve-sebze': ['Meyve', 'Sebze', 'Meyve ve Sebze'],
    'et':          ['Şarküteri', 'Beyaz Et', 'Kırmızı Et', 'Deniz Ürünleri', 'Sakatat',
                    'Et, Tavuk ve Balık'],
    'sut':         ['Süt', 'Yoğurt', 'Peynir', 'Tereyağı ve Margarin', 'Kaymak ve Krema',
                    'Yumurta', 'Zeytin', 'Bal ve Reçel', 'Helva Tahin ve Pekmez',
                    'Kahvaltılık Gevrek Bar ve Granola', 'Sürülebilir Ürünler ve Kahvaltılık Soslar',
                    'Ayran ve Kefir', 'Süt Ürünleri ve Kahvaltılık'],
    'gida':        ['Mantı Makarna ve Erişte', 'Pasta Malzemeleri', 'Hazır Gıda', 'Bakliyat',
                    'Ekmek ve Unlu Mamüller', 'Konserve', 'Salça', 'Ketçap Mayonez Sos ve Sirkeler',
                    'Sıvı Yağlar', 'Tuz Baharat ve Harçlar', 'Şeker ve Tatlandırıcılar',
                    'Turşu', 'Un ve İrmik', 'Bebek Mamaları', 'Temel Gıda'],
    'icecek':      ['Meyve Suyu', 'Su', 'Maden Suyu', 'Çay ve Bitki Çayları',
                    'Gazsız İçecekler', 'Gazlı İçecekler', 'Kahve', 'İçecek'],
    'temizlik':    ['Bulaşık Temizlik Ürünleri', 'Kağıt Havlu', 'Kağıt Peçete ve Mendil',
                    'Genel Temizlik Ürünleri', 'Hijyenik Ped', 'Çamaşır Temizlik Ürünleri',
                    'Saç Bakım', 'Cilt Bakımı', 'Parfüm Deodorant Kolonya ve Kokular',
                    'Mutfak Sarf Malzemeleri', 'Temizlik ve Kişisel Bakım'],
}


def slim_urun(u):
    fiyatlar = sorted(
        [f for f in (u.get('fiyatlar') or []) if f.get('fiyat') is not None],
        key=lambda f: f['fiyat']
    )[:3]
    return {
        'id':             u.get('id'),
        'ad':             u.get('ad'),
        'marka':          u.get('marka'),
        'agirlik_hacim':  u.get('agirlik_hacim'),
        'ana_kategori':   u.get('ana_kategori'),
        'resim':          u.get('resim'),
        'en_dusuk_fiyat': u.get('en_dusuk_fiyat'),
        'fiyatlar':       fiyatlar,
    }


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

    kategori = request.args.get('kategori', '').strip()
    try:
        sayfa = max(1, int(request.args.get('sayfa', 1)))
    except ValueError:
        sayfa = 1

    tum = data.get('urunler', [])
    if kategori and kategori in KATEGORI_MAP:
        cat_set = set(KATEGORI_MAP[kategori])
        tum = [u for u in tum if u.get('ana_kategori') in cat_set]

    toplam       = len(tum)
    sayfa_sayisi = max(1, (toplam + PAGE_SIZE - 1) // PAGE_SIZE)
    baslangic    = (sayfa - 1) * PAGE_SIZE

    return jsonify({
        'toplam':       toplam,
        'sayfa':        sayfa,
        'sayfa_sayisi': sayfa_sayisi,
        'urunler':      [slim_urun(u) for u in tum[baslangic: baslangic + PAGE_SIZE]],
    })


@app.route("/api/urunler/ara")
def urunler_ara():
    data = load_json(URUNLER_FILE)
    if data is None:
        return jsonify({"hata": "urunler.json bulunamadi."}), 404

    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'urunler': [], 'toplam': 0})

    def norm_tr(s):
        return (s or '').lower() \
            .replace('ğ','g').replace('ü','u').replace('ş','s') \
            .replace('ı','i').replace('ö','o').replace('ç','c')

    qn = norm_tr(q)
    sonuclar = [
        u for u in data.get('urunler', [])
        if qn in norm_tr(u.get('ad','')) or qn in norm_tr(u.get('marka','') or '')
    ]
    return jsonify({
        'toplam':  len(sonuclar),
        'urunler': [slim_urun(u) for u in sonuclar[:96]],
    })


@app.route("/api/hal")
def hal():
    data = load_json(HAL_FILE)
    if data is None:
        return jsonify({"hata": "hal_fiyatlari.json bulunamadi."}), 404
    return jsonify(data)


@app.route("/api/guncelle-d5336945")
def guncelle():
    def run_scrapers():
        try:
            import run_scrapers as rs
            rs.main()
        except Exception as e:
            print(f"Scraper hatasi: {e}", flush=True)

    thread = threading.Thread(target=run_scrapers)
    thread.daemon = True
    thread.start()
    return jsonify({"durum": "baslatildi", "mesaj": "Scraper arka planda calisiyor"}), 200


@app.route("/sw.js")
def sw():
    response = make_response(send_from_directory(BASE_DIR, "sw.js"))
    response.headers["Content-Type"] = "application/javascript"
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/manifest.json")
def manifest():
    return send_from_directory(BASE_DIR, "manifest.json")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(os.path.join(BASE_DIR, "static"), filename)


@app.route("/<path:filename>")
def serve_file(filename):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Sunucu basliyor... http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
