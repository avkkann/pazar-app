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

# il -> (enlem, boylam). Il merkezleri, elle girilmis yaklasik degerler.
ILLER = {
    "Adana": (37.0000, 35.3213), "Adıyaman": (37.7648, 38.2786), "Afyonkarahisar": (38.7507, 30.5567),
    "Ağrı": (39.7191, 43.0503), "Amasya": (40.6499, 35.8353), "Ankara": (39.9334, 32.8597),
    "Antalya": (36.8969, 30.7133), "Artvin": (41.1828, 41.8183), "Aydın": (37.8560, 27.8416),
    "Balıkesir": (39.6484, 27.8826), "Bilecik": (40.1451, 29.9799), "Bingöl": (38.8854, 40.4980),
    "Bitlis": (38.4006, 42.1095), "Bolu": (40.5760, 31.5788), "Burdur": (37.7203, 30.2908),
    "Bursa": (40.1826, 29.0665), "Çanakkale": (40.1553, 26.4142), "Çankırı": (40.6013, 33.6134),
    "Çorum": (40.5506, 34.9556), "Denizli": (37.7765, 29.0864), "Diyarbakır": (37.9144, 40.2306),
    "Edirne": (41.6771, 26.5557), "Elazığ": (38.6810, 39.2264), "Erzincan": (39.7500, 39.5000),
    "Erzurum": (39.9000, 41.2700), "Eskişehir": (39.7767, 30.5206), "Gaziantep": (37.0662, 37.3833),
    "Giresun": (40.9128, 38.3895), "Gümüşhane": (40.4386, 39.5086), "Hakkari": (37.5744, 43.7408),
    "Hatay": (36.2025, 36.1606), "Isparta": (37.7648, 30.5566), "Mersin": (36.8121, 34.6415),
    "İstanbul": (41.0082, 28.9784), "İzmir": (38.4237, 27.1428), "Kars": (40.6013, 43.0975),
    "Kastamonu": (41.3887, 33.7827), "Kayseri": (38.7312, 35.4787), "Kırklareli": (41.7333, 27.2167),
    "Kırşehir": (39.1425, 34.1709), "Kocaeli": (40.8533, 29.8815), "Konya": (37.8746, 32.4932),
    "Kütahya": (39.4242, 29.9833), "Malatya": (38.3552, 38.3095), "Manisa": (38.6191, 27.4289),
    "Kahramanmaraş": (37.5858, 36.9371), "Mardin": (37.3212, 40.7245), "Muğla": (37.2153, 28.3636),
    "Muş": (38.9462, 41.7539), "Nevşehir": (38.6939, 34.6857), "Niğde": (37.9667, 34.6833),
    "Ordu": (40.9839, 37.8764), "Rize": (41.0201, 40.5234), "Sakarya": (40.7569, 30.3781),
    "Samsun": (41.2867, 36.3300), "Siirt": (37.9333, 41.9500), "Sinop": (42.0231, 35.1531),
    "Sivas": (39.7477, 37.0179), "Tekirdağ": (40.9833, 27.5167), "Tokat": (40.3167, 36.5500),
    "Trabzon": (41.0015, 39.7178), "Tunceli": (39.1079, 39.5401), "Şanlıurfa": (37.1591, 38.7969),
    "Uşak": (38.6823, 29.4082), "Van": (38.4891, 43.4089), "Yozgat": (39.8181, 34.8147),
    "Zonguldak": (41.4564, 31.7987), "Aksaray": (38.3687, 34.0370), "Bayburt": (40.2552, 40.2249),
    "Karaman": (37.1759, 33.2287), "Kırıkkale": (39.8468, 33.5153), "Batman": (37.8812, 41.1351),
    "Şırnak": (37.4187, 42.4918), "Bartın": (41.6344, 32.3375), "Ardahan": (41.1105, 42.7022),
    "Iğdır": (39.8880, 44.0048), "Yalova": (40.6500, 29.2667), "Karabük": (41.2061, 32.6204),
    "Kilis": (36.7184, 37.1212), "Osmaniye": (37.0742, 36.2478), "Düzce": (40.8438, 31.1565),
}


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
