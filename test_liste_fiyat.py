# -*- coding: utf-8 -*-
"""discountlessPrice -> liste_fiyat ve ilan_indirim_gecmisi testi.
scraper.py'yi dogrudan import eder, kopya mantik degil.
Kullanim: py test_liste_fiyat.py
"""
import importlib.util
import json
import os
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


def depot(market, price, **ek):
    d = {"marketAdi": market, "price": price}
    d.update(ek)
    return d


def urun(depots, ad="Test Urun 1 Kg"):
    return {"title": ad, "main_category": "Test", "refinedVolumeOrWeight": "1 KG",
            "imageUrl": None, "productDepotInfoList": depots}


print("\n=== 1. parse_product: liste_fiyat ===")
p = scr.parse_product(urun([depot("migros", 35.18, discountlessPrice=46.9)]), "Test", "test")
mf = p["market_fiyatlari"][0]
ok("discountlessPrice > price -> liste_fiyat eklendi", mf.get("liste_fiyat") == 46.9, mf)
ok("  market ve fiyat degismedi", mf.get("market") == "migros" and mf.get("fiyat") == 35.18, mf)

p = scr.parse_product(urun([depot("bim", 50.0, discountlessPrice=50.0)]), "Test", "test")
mf = p["market_fiyatlari"][0]
ok("discountlessPrice == price -> liste_fiyat YOK", "liste_fiyat" not in mf, mf)

p = scr.parse_product(urun([depot("bim", 50.0, discountlessPrice=40.0)]), "Test", "test")
mf = p["market_fiyatlari"][0]
ok("discountlessPrice < price -> liste_fiyat YOK", "liste_fiyat" not in mf, mf)

p = scr.parse_product(urun([depot("a101", 12.5, discountlessPrice=None)]), "Test", "test")
mf = p["market_fiyatlari"][0]
ok("discountlessPrice None -> liste_fiyat YOK", "liste_fiyat" not in mf, mf)

p = scr.parse_product(urun([depot("sok", 9.9)]), "Test", "test")
mf = p["market_fiyatlari"][0]
ok("alan hic yoksa -> liste_fiyat YOK", "liste_fiyat" not in mf, mf)
ok("  indirimsiz kayit HALA tam olarak {market,fiyat}", set(mf.keys()) == {"market", "fiyat"}, mf)

print("\n=== 2. MEVCUT YAPI BOZULMADI ===")
p = scr.parse_product(urun([depot("migros", 35.18, discountlessPrice=46.9),
                            depot("sok", 40.0)]), "Test", "test")
ok("en_dusuk_fiyat hala SATIS fiyatindan (liste fiyattan degil)", p["en_dusuk_fiyat"] == 35.18, p["en_dusuk_fiyat"])
ok("market_fiyatlari uzunlugu degismedi", len(p["market_fiyatlari"]) == 2, p["market_fiyatlari"])
ok("urun ust seviye anahtarlari degismedi",
   set(p.keys()) == {"_sid", "ad", "ana_kategori", "agirlik_hacim", "resim", "en_dusuk_fiyat", "market_fiyatlari"},
   sorted(p.keys()))
ok("fiyati None olan depot hala atlaniyor",
   len(scr.parse_product(urun([depot("x", None, discountlessPrice=99.0)]), "T", "t")["market_fiyatlari"]) == 0)

print("\n=== 3. ilan_indirim_gecmisi ===")
fn = getattr(scr, "_apply_ilan_indirim_gecmisi", None)
ok("_apply_ilan_indirim_gecmisi tanimli", fn is not None)

if fn:
    def calistir(yeni, eski_json=None):
        tf = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
        if eski_json is not None:
            json.dump(eski_json, tf, ensure_ascii=False)
        tf.close()
        yol = tf.name if eski_json is not None else os.path.join(tempfile.gettempdir(), "yok_boyle_dosya.json")
        fn(yeni, yol)
        try:
            os.unlink(tf.name)
        except OSError:
            pass
        return yeni

    u1 = {"_sid": "s1", "market_fiyatlari": [{"market": "migros", "fiyat": 35.18, "liste_fiyat": 46.9}]}
    calistir([u1])
    g = u1.get("ilan_indirim_gecmisi")
    ok("ilan varken kayit yazildi", isinstance(g, list) and len(g) == 1, g)
    if g:
        k = g[0]
        ok("  kayit alanlari {tarih,market,liste_fiyat,satis_fiyat}",
           set(k.keys()) == {"tarih", "market", "liste_fiyat", "satis_fiyat"}, k)
        ok("  degerler dogru", k["market"] == "migros" and k["liste_fiyat"] == 46.9 and k["satis_fiyat"] == 35.18, k)

    u2 = {"_sid": "s2", "market_fiyatlari": [{"market": "sok", "fiyat": 10.0}]}
    calistir([u2])
    ok("ilan YOKKEN kayit yazilmiyor", u2.get("ilan_indirim_gecmisi") == [], u2.get("ilan_indirim_gecmisi"))

    # ayni deger tekrar -> yeni kayit yok
    eski = [{"_sid": "s3", "ilan_indirim_gecmisi": [
        {"tarih": "2020-01-01", "market": "migros", "liste_fiyat": 46.9, "satis_fiyat": 35.18}]}]
    u3 = {"_sid": "s3", "market_fiyatlari": [{"market": "migros", "fiyat": 35.18, "liste_fiyat": 46.9}]}
    calistir([u3], eski)
    ok("ayni ilan tekrar -> yeni kayit YOK", len(u3["ilan_indirim_gecmisi"]) == 1, u3["ilan_indirim_gecmisi"])

    # deger degisti -> yeni kayit
    u4 = {"_sid": "s3", "market_fiyatlari": [{"market": "migros", "fiyat": 29.9, "liste_fiyat": 46.9}]}
    calistir([u4], eski)
    ok("ilan degisti -> yeni kayit eklendi", len(u4["ilan_indirim_gecmisi"]) == 2, u4["ilan_indirim_gecmisi"])

    # farkli market ayri izleniyor
    u5 = {"_sid": "s3", "market_fiyatlari": [
        {"market": "migros", "fiyat": 35.18, "liste_fiyat": 46.9},
        {"market": "carrefour", "fiyat": 33.0, "liste_fiyat": 44.0}]}
    calistir([u5], eski)
    ok("farkli market ayri kayit acti", len(u5["ilan_indirim_gecmisi"]) == 2, u5["ilan_indirim_gecmisi"])

print("\n=== 4. scrape_category akisi cagiriyor mu ===")
src = open(os.path.join(_BASE, "scraper.py"), encoding="utf-8").read()
ok("_apply_ilan_indirim_gecmisi scrape akisinda cagriliyor",
   src.count("_apply_ilan_indirim_gecmisi(") >= 2, src.count("_apply_ilan_indirim_gecmisi("))
ok("discountlessPrice parse_product icinde okunuyor",
   "discountlessPrice" in src.split("def parse_product")[1].split("def ")[0])

print("\nPASS=%d  FAIL=%d" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
