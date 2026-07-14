# -*- coding: utf-8 -*-
"""
Hal urunleri icin Wikimedia Commons'tan gorsel ceker.
Anonim erisim - API key gerekmez.
Kullanim: python hal_gorsel_cek.py [--test]
--test: sadece ilk 10 urunu isler (deneme)
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

from hal_ceviri import CEVIRI

HAL_JSON_PATH = "data/hal.json"
OUT_DIR = "data/hal-images"
LOG_PATH = "data/hal-images/_log.json"
USER_AGENT = "PazarApp/1.0 (https://avkkann.github.io/pazar-app; hal-urun-gorseli)"


def slugify(ad):
    n = unicodedata.normalize("NFKD", ad)
    n = n.encode("ascii", "ignore").decode("ascii")
    n = re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
    return n or "urun"


def commons_search(query):
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": 6,
        "gsrlimit": 5,
        "prop": "imageinfo",
        "iiprop": "url|mime|size",
        "iiurlwidth": 600,
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    pages = data.get("query", {}).get("pages", {})
    sonuclar = []
    for _, page in pages.items():
        infos = page.get("imageinfo", [])
        if not infos:
            continue
        info = infos[0]
        mime = info.get("mime", "")
        if not mime.startswith("image/"):
            continue
        if mime in ("image/svg+xml",):
            continue
        sonuclar.append({
            "title": page.get("title"),
            "url": info.get("thumburl") or info.get("url"),
            "size": info.get("size"),
        })
    return sonuclar


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        content = resp.read()
    with open(path, "wb") as f:
        f.write(content)
    return len(content)


def main():
    test_mode = "--test" in sys.argv

    os.makedirs(OUT_DIR, exist_ok=True)

    with open(HAL_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    urunler = data["urunler"]
    if test_mode:
        urunler = urunler[:10]
        print(f"TEST MODU: sadece ilk {len(urunler)} urun islenecek.\n")

    log = []
    basarili = 0
    basarisiz = 0

    for u in urunler:
        ad = u["ad"]
        query = CEVIRI.get(ad)
        if not query:
            print(f"[ATLA] '{ad}' icin ceviri bulunamadi.")
            log.append({"ad": ad, "durum": "ceviri_yok"})
            basarisiz += 1
            continue

        slug = slugify(ad)
        dosya_adi = f"{slug}.jpg"
        dosya_yolu = os.path.join(OUT_DIR, dosya_adi)

        try:
            sonuclar = commons_search(query)
            if not sonuclar:
                print(f"[BULUNAMADI] '{ad}' -> '{query}' (0 sonuc)")
                log.append({"ad": ad, "query": query, "durum": "sonuc_yok"})
                basarisiz += 1
                time.sleep(1.0)
                continue

            secilen = sonuclar[0]
            img_url = secilen["url"]
            boyut = download(img_url, dosya_yolu)

            print(f"[OK] '{ad}' -> '{query}' -> {dosya_adi} ({boyut} bytes) commons_title={secilen.get('title')}")
            log.append({
                "ad": ad,
                "query": query,
                "durum": "ok",
                "dosya": f"{OUT_DIR}/{dosya_adi}",
                "commons_title": secilen.get("title"),
                "commons_url": img_url,
            })
            basarili += 1
        except Exception as e:
            print(f"[HATA] '{ad}' -> '{query}': {e}")
            log.append({"ad": ad, "query": query, "durum": "hata", "mesaj": str(e)})
            basarisiz += 1

        time.sleep(1.0)

    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\nBITTI. Basarili: {basarili}, Basarisiz: {basarisiz}")
    print(f"Log dosyasi: {LOG_PATH}")


if __name__ == "__main__":
    main()