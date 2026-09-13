# -*- coding: utf-8 -*-
"""Il merkezi koordinatlari — TEK KAYNAK.

NEDEN AYRI DOSYA: bu tablo 2026-09-13'e kadar yalnizca il_market_tara.py
icinde satir ici duruyordu. scraper.py de ayni tabloya ihtiyac duyuyor
(fiyatin hangi ILDEKI magazadan okundugunu kaydetmek icin); kopyalamak bu
depoda kayitli tuzak -- "iki kaynak = kacinilmaz sapma" (bkz. _asKart ->
scripts/kart-bicimi.mjs, zamOlcutu -> scripts/zam-aylik.mjs).

KOORDINATLAR YAKLASIK il merkezleridir (elle girildi). Kesinlik GEREKMIYOR:
  - il_market_tara.py 40 km yaricapla zincir arar,
  - il_bul() en yakin il merkezini dondurur ve uzaksa None der.
"""
import math

# il -> (enlem, boylam)
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

# En yakin il merkezi bu mesafeden uzaksa IL YAZILMIYOR. 150 km secildi cunku
# buyuk illerde ilceler merkeze uzak olabiliyor (Alanya -> Antalya ~125 km);
# daha genis bir esik komsu ile YANLIS etiket uretirdi. Emin olamadigimizda
# alan HIC acilmiyor -- yanlis il yazmaktansa hic yazmamak.
AZAMI_KM = 150


def il_bul(lat, lon, azami_km=AZAMI_KM):
    """Koordinata en yakin il merkezinin adi; uzak/gecersizse None."""
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return None
    en_yakin, en_km = None, None
    for ad, (ilat, ilon) in ILLER.items():
        dy = (lat - ilat) * 111.0
        dx = (lon - ilon) * 111.0 * math.cos(math.radians((lat + ilat) / 2.0))
        km = math.hypot(dx, dy)
        if en_km is None or km < en_km:
            en_yakin, en_km = ad, km
    if en_km is None or en_km > azami_km:
        return None
    return en_yakin
