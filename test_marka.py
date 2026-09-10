# -*- coding: utf-8 -*-
"""MARKA alani: API'den aliniyor, additive, "Markasız" yazilmiyor, korunuyor.

NEDEN: API "brand" alanini urunlerin %100'unde veriyor (olculdu 10.09.2026,
16.434 baslik; 1.992 benzersiz gercek marka) ve biz onu ATIYORDUK. Elimizde
bir urunu tanimlayan tek sey ADI idi.

Onemi resimsiz urunlerde olculdu: 2.384 resimsiz urunun 2.210'u (%92,7)
MARKALI paketli urun. Ad benzerligi bu kumede tehlikeli -- olculen gercek
karisma ornekleri: "Tat Bulgur" -> "Duru Bulgur", "Cem Siyah Zeytin" ->
"Zeytino Siyah Zeytin", "Gesas Cilek Receli" -> "Metin Cilek Receli".
Marka olmadan yapilan her ad eslestirmesi bu ciftleri karistirir.

scraper.py'yi dogrudan import eder, kopya mantik degil.
Kullanim: py test_marka.py
"""
import importlib.util
import json
import os
import shutil
import sys
import tempfile

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

spec = importlib.util.spec_from_file_location("scr", os.path.join(_BASE, "scraper.py"))
scr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scr)

gecti = basarisiz = 0


def ok(ad, kosul, detay=""):
    global gecti, basarisiz
    if kosul:
        gecti += 1
        print("  PASS  " + ad)
    else:
        basarisiz += 1
        print("  FAIL  " + ad + ("  -> " + str(detay) if detay else ""))


def item(**ek):
    temel = {
        "title": "Ulker Cikolatali Gofret 36 Gr",
        "main_category": "Gofret",
        "refinedVolumeOrWeight": "36 GR",
        "imageUrl": "https://cdn.marketfiyati.org.tr/a101images/1.jpg",
        "productDepotInfoList": [{"marketAdi": "a101", "price": 10.0}],
    }
    temel.update(ek)
    return temel


print("\n=== 0. ALET KONTROLU ===")
u = scr.parse_product(item(brand="Ülker"), "Gofret", "atistirmalik")
ok("parse_product calisiyor", u.get("ad") == "Ulker Cikolatali Gofret 36 Gr", u)
ok("  alet marka alanini GOREBILIYOR", u.get("marka") == "Ülker", u.get("marka"))

print("\n=== 1. GERCEK MARKA KAYDEDILIYOR ===")
for gelen, beklenen in [("Ülker", "Ülker"), ("Nivea", "Nivea"),
                        ("  Dr. Oetker  ", "Dr. Oetker"), ("Tarım Kredi", "Tarım Kredi")]:
    u = scr.parse_product(item(brand=gelen), "K", "s")
    ok("marka '%s' -> '%s'" % (gelen.strip(), beklenen), u.get("marka") == beklenen, u.get("marka"))

print("\n=== 2. ADDITIVE: bos alan ANAHTAR ACMIYOR ===")
# liste_fiyat / depot_id ile ayni desen: 16 bin urunde bos alan tasima.
for gelen in (None, "", "   "):
    u = scr.parse_product(item(brand=gelen), "K", "s")
    ok("brand=%r -> anahtar YOK" % (gelen,), "marka" not in u, list(u.keys()))
u = scr.parse_product(item(), "K", "s")   # brand hic yok
ok("brand alani HIC yoksa -> anahtar YOK", "marka" not in u, list(u.keys()))

print("\n=== 3. \"Markasız\" MARKA DEGILDIR ===")
# API acik/dokme urunde (karpuz, baby patates) birebir "Markasız" koyuyor --
# 479 urun (%2,9). Bu bir marka degil, "markasi yok" demek. Alanin YOKLUGU
# zaten bunu anlatiyor; 479 kez ayni bilgisiz dize tasinmiyor.
for gelen in ("Markasız", "markasız", "MARKASIZ", "Markasiz", " Markasız "):
    u = scr.parse_product(item(brand=gelen), "K", "s")
    ok("brand=%r -> yazilmiyor" % gelen, "marka" not in u, u.get("marka"))
# KONTROL GRUBU: icinde "marka" gecen GERCEK bir marka elenmemeli
u = scr.parse_product(item(brand="Markam"), "K", "s")
ok("  KONTROL: 'Markam' GERCEK marka, eleniyor mu?", u.get("marka") == "Markam", u.get("marka"))

print("\n=== 4. DIGER ALANLAR BOZULMADI ===")
u = scr.parse_product(item(brand="Eti"), "Gofret", "atistirmalik")
for alan, beklenen in [("ad", "Ulker Cikolatali Gofret 36 Gr"), ("ana_kategori", "Gofret"),
                       ("agirlik_hacim", "36 GR"), ("en_dusuk_fiyat", 10.0)]:
    ok("%s korundu" % alan, u.get(alan) == beklenen, u.get(alan))
ok("  resim korundu", (u.get("resim") or "").endswith("/1.jpg"), u.get("resim"))
ok("  market_fiyatlari korundu", len(u.get("market_fiyatlari") or []) == 1)

print("\n=== 5. GECE KAYNAK VERMEZSE ESKI DEGER KORUNUYOR ===")
# CLAUDE.md kurali: turetilmis alan her kosuda sifirdan kuruluyorsa "eskiyi
# koru" adimi SART. Searlo'nun doldurdugu 73 resim tam olarak bu adim
# olmadigi icin ertesi gece ucmustu.
gecici = tempfile.mkdtemp()
try:
    yol = os.path.join(gecici, "k.json")
    with open(yol, "w", encoding="utf-8") as f:
        json.dump([{"_sid": "s1", "marka": "Ülker", "resim": "https://x/1.jpg"}], f, ensure_ascii=False)

    yeni = [{"_sid": "s1", "ad": "A"}]              # API bu kez marka vermedi
    n = scr._alan_koru(yeni, yol, "marka")
    ok("eski marka korundu", yeni[0].get("marka") == "Ülker", yeni[0])
    ok("  sayac dogru", n == 1, n)

    # KONTROL GRUBU: API DOLU verdiyse kaynak KAZANIR (marka degismis olabilir)
    yeni2 = [{"_sid": "s1", "ad": "A", "marka": "Eti"}]
    n2 = scr._alan_koru(yeni2, yol, "marka")
    ok("  KONTROL: API dolu verince ESKI EZILIYOR", yeni2[0]["marka"] == "Eti", yeni2[0])
    ok("  ve korunan sayilmiyor", n2 == 0, n2)

    # Dosyada olmayan urun
    yeni3 = [{"_sid": "yok", "ad": "B"}]
    scr._alan_koru(yeni3, yol, "marka")
    ok("  dosyada olmayan urun patlatmiyor", "marka" not in yeni3[0], yeni3[0])

    # TEK KAYNAK: resim korumasi ayni fonksiyona indi, hala calisiyor mu?
    yeni4 = [{"_sid": "s1", "ad": "A"}]
    scr._apply_resim_koru(yeni4, yol)
    ok("  KONTROL: resim korumasi hala calisiyor (tek kaynak bozmadi)",
       yeni4[0].get("resim") == "https://x/1.jpg", yeni4[0])
finally:
    shutil.rmtree(gecici, ignore_errors=True)

print("\n=== 6. VERITABANI YAZIMI YENI ALANDAN ETKILENMIYOR ===")
# sync_db.py alanlari TEK TEK kuruyor; blind passthrough olsaydi bilinmeyen
# kolon PostgREST'te hata verirdi. Bu iddia o guvenceyi kilitliyor.
with open(os.path.join(_BASE, "sync_db.py"), encoding="utf-8") as f:
    sync = f.read()
sync_temiz = "\n".join("" if l.lstrip().startswith("#") else l for l in sync.split("\n"))
ok('sync_db urunu tek tek kuruyor ("_sid": sid)', '"_sid": sid' in sync_temiz)
ok("  urunun tamamini gondermiyor (**u / dict(u) yok)",
   "**u" not in sync_temiz and "dict(u)" not in sync_temiz, "blind passthrough var")
ok("  marka DB'ye gonderilmiyor (kolon yok, gonderilse 400 olurdu)",
   '"marka"' not in sync_temiz, "marka sync_db'ye eklenmis - once SQL kolonu gerekir")

print("\n=== 7. KAYNAK KILIDI ===")
with open(os.path.join(_BASE, "scraper.py"), encoding="utf-8") as f:
    kaynak = f.read()
temiz = "\n".join("" if l.lstrip().startswith("#") else l for l in kaynak.split("\n"))
ok("marka API'nin brand alanindan geliyor", 'item.get("brand")' in temiz, "")
ok("  Markasız kapisi kosula bagli (sabit degil)",
   '"markasız", "markasiz"' in temiz.lower(), "")
ok("  koruma TEK fonksiyonda (_alan_koru)", "def _alan_koru(" in temiz, "")
ok("  _apply_resim_koru ona DELEGE ediyor (iki kopya mantik yok)",
   '_alan_koru(yeni_urunler, cat_file, "resim")' in temiz, "")
ok("  marka korumasi cagriliyor", '_alan_koru(products, cat_file, "marka")' in temiz, "")

print("\nPASS=%d  FAIL=%d" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
