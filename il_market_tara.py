# -*- coding: utf-8 -*-
"""
81 il icin hangi market zincirlerinin bulundugunu cikarir -> data/il_marketler.json

Kaynak: https://api.marketfiyati.org.tr/api/v2/nearest
  Gonderilen: {latitude, longitude, distance}
  Donen     : [{id: "bim-D306", sellerName, marketName, location, distance}, ...]
  Zincir kodu id'nin ilk parcasindan cikiyor: "bim-D306" -> "bim"

DISTANCE ALANINA GUVENILMIYOR: yanit icindeki "distance" degeri bozuk — Istanbul
icindeki bir magaza icin 2632 km yaziyor. Yalnizca ISTEKTEKI yaricap filtresi
kullaniliyor, donen distance okunmuyor.

Il merkez koordinatlari asagida SABIT tablo olarak duruyor (elle girildi, il
merkezlerinin yaklasik enlem/boylami). Dis bagimlilik/yeni paket eklenmedi.
Kesinlik gerekmiyor: 40 km yaricapla sorgulandigi icin birkac km sapma sonucu
degistirmiyor.

Bu script GUNLUK degil HAFTALIK kosar (.github/workflows/il-marketler.yml);
zincir agi her gun degismiyor, gecelik veri kosusunu uzatmasin.
"""
import json
import os
import sys
import time
from datetime import datetime

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API = "https://api.marketfiyati.org.tr/api/v2/nearest"
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE_DIR, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "il_marketler.json")

YARICAP_KM = 40      # il merkezinden; buyuksehirlerde ilcelere de ulasir
BEKLE_SN = 4.5       # istekler arasi — nazik davraniyoruz
MAX_RETRIES = 2

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Accept-Language": "tr-TR,tr;q=0.9",
    "Content-Type": "application/json",
}

# il -> (enlem, boylam). TEK KAYNAK: iller_tablo.py. Tablo 2026-09-13'te oraya
# tasindi cunku scraper.py de ayni koordinatlara ihtiyac duyuyor (fiyatin hangi
# ildeki magazadan okundugunu yaziyor); iki kopya kacinilmaz sapma demekti.
from iller_tablo import ILLER



def il_marketleri(lat, lon):
    """Tek il icin zincir listesi. (marketler, depot_sayisi) veya (None, 0) doner."""
    gonder = {"latitude": lat, "longitude": lon, "distance": YARICAP_KM}
    for deneme in range(1, MAX_RETRIES + 1):
        try:
            r = requests.post(API, json=gonder, headers=HEADERS, timeout=45, verify=False)
            r.raise_for_status()
            kayitlar = r.json()
            if isinstance(kayitlar, dict):
                kayitlar = kayitlar.get("content") or []
            if not isinstance(kayitlar, list):
                raise ValueError("beklenmeyen yanit tipi: %s" % type(kayitlar).__name__)
            zincirler = sorted({
                str(k.get("id", "")).split("-")[0]
                for k in kayitlar if k.get("id") and "-" in str(k.get("id"))
            })
            return ([z for z in zincirler if z], len(kayitlar))
        except Exception as e:
            print("    [HATA] deneme %d/%d: %s" % (deneme, MAX_RETRIES, e), flush=True)
            if deneme < MAX_RETRIES:
                time.sleep(5)
    return (None, 0)


def main():
    print("=" * 62)
    print("Il -> market zinciri taramasi  (%d il, yaricap %d km)" % (len(ILLER), YARICAP_KM))
    print("Baslangic: %s" % datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 62)

    os.makedirs(DATA_DIR, exist_ok=True)
    # Mevcut dosya: bir il bu kosuda basarisiz olursa ESKI degeri korunur.
    onceki = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                onceki = (json.load(f) or {}).get("iller") or {}
        except Exception as e:
            print("[UYARI] mevcut il_marketler.json okunamadi: %s — sifirdan yazilacak" % e)

    iller = dict(onceki)
    basarili, hatali, korunan = 0, [], []
    for i, (ad, (lat, lon)) in enumerate(sorted(ILLER.items()), 1):
        if i > 1:
            time.sleep(BEKLE_SN)
        zincirler, depot = il_marketleri(lat, lon)
        if zincirler is None:
            hatali.append(ad)
            if ad in onceki:
                korunan.append(ad)
                print("  %2d/%d %-16s HATA — onceki deger korundu (%s)"
                      % (i, len(ILLER), ad, ",".join(onceki[ad].get("marketler", []))), flush=True)
            else:
                print("  %2d/%d %-16s HATA — onceki deger de yok, dosyaya yazilmadi"
                      % (i, len(ILLER), ad), flush=True)
            continue
        if not zincirler:
            hatali.append(ad)
            print("  %2d/%d %-16s BOS sonuc (%d depot) — yazilmadi" % (i, len(ILLER), ad, depot), flush=True)
            continue
        basarili += 1
        iller[ad] = {"marketler": zincirler, "depot": depot}
        print("  %2d/%d %-16s %2d depot  %s" % (i, len(ILLER), ad, depot, ",".join(zincirler)), flush=True)

    if not iller:
        print("\n[KRITIK] Hicbir il icin sonuc yok — dosya YAZILMADI.")
        return 1

    cikti = {
        "kaynak": "api.marketfiyati.org.tr/api/v2/nearest",
        "yaricap_km": YARICAP_KM,
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "il_sayisi": len(iller),
        "iller": dict(sorted(iller.items())),
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, separators=(",", ":"))

    print("\n" + "=" * 62)
    print("  basarili        : %d" % basarili)
    print("  hatali/bos      : %d  %s" % (len(hatali), ", ".join(hatali) if hatali else ""))
    print("  eski degeri korunan: %d  %s" % (len(korunan), ", ".join(korunan) if korunan else ""))
    print("  dosyadaki il    : %d" % len(iller))
    print("  dosya           : %s (%d byte)" % (OUTPUT_FILE, os.path.getsize(OUTPUT_FILE)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
