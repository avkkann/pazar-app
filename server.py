from flask import Flask, jsonify, send_from_directory, abort
import json, os

app = Flask(__name__, static_folder=".")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/urunler")
def urunler():
    data = load_json("urunler.json")
    if data is None:
        return jsonify({"hata": "urunler.json bulunamadı. Önce scraper.py çalıştırın."}), 404
    return jsonify(data)


@app.route("/api/hal")
def hal():
    data = load_json("hal_fiyatlari.json")
    if data is None:
        return jsonify({"hata": "hal_fiyatlari.json bulunamadı. Önce hal_scraper.py çalıştırın."}), 404
    return jsonify(data)


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Pazar + Hal Fiyatlari sunucusu basliyor... http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
