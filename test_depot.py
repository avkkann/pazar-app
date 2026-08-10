# -*- coding: utf-8 -*-
"""depotId / depotName -> market_fiyatlari kaydi testi.

NEDEN: API her zincir icin TEK temsilci magaza donduruyor ve bu temsilci
zaman icinde degisiyor (olculdu: ayni anda depots'suz sorgu
carrefour-1012 "Istanbul Acibadem Hiper", depot filtreli sorgu
carrefour-5027 "Karakoy Mini" donuyor). Magaza degisimini ZAM sanmamak
icin hangi magazadan okudugumuzu kaydetmemiz gerekiyor.

scraper.py'yi dogrudan import eder, kopya mantik degil.
Kullanim: py test_depot.py
"""
import importlib.util
import os
import sys

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


print("\n=== depot kimligi kaydediliyor mu ===")

u = scr.parse_product(urun([
    depot("carrefour", 171.5, depotId="carrefour-5027", depotName="Istanbul Karaköy Mını"),
]), "Test")
mf = u["market_fiyatlari"][0]
ok("depot_id kaydediliyor", mf.get("depot_id") == "carrefour-5027", mf)
ok("depot_ad kaydediliyor", mf.get("depot_ad") == "Istanbul Karaköy Mını", mf)
ok("market alani bozulmadi", mf.get("market") == "carrefour", mf)
ok("fiyat alani bozulmadi", mf.get("fiyat") == 171.5, mf)

print("\n=== additive: alan yoksa anahtar hic acilmiyor ===")

u = scr.parse_product(urun([depot("bim", 159.0)]), "Test")
mf = u["market_fiyatlari"][0]
ok("depotId yoksa depot_id yok", "depot_id" not in mf, mf)
ok("depotName yoksa depot_ad yok", "depot_ad" not in mf, mf)
ok("bos alan tasinmiyor (sadece market+fiyat)", set(mf) == {"market", "fiyat"}, mf)

u = scr.parse_product(urun([depot("sok", 169.0, depotId="", depotName=None)]), "Test")
mf = u["market_fiyatlari"][0]
ok("bos string depot_id yazilmiyor", "depot_id" not in mf, mf)
ok("None depotName yazilmiyor", "depot_ad" not in mf, mf)

print("\n=== liste_fiyat ile birlikte yasiyor ===")

u = scr.parse_product(urun([
    depot("migros", 64.95, discountlessPrice=89.9, depotId="migros-1991",
          depotName="Çiçekçi M Migros"),
]), "Test")
mf = u["market_fiyatlari"][0]
ok("liste_fiyat hala yaziliyor", mf.get("liste_fiyat") == 89.9, mf)
ok("depot_id yaninda duruyor", mf.get("depot_id") == "migros-1991", mf)
ok("dort alan birden", set(mf) == {"market", "fiyat", "liste_fiyat", "depot_id", "depot_ad"}, mf)

print("\n=== depot adi kirpiliyor ===")

u = scr.parse_product(urun([
    depot("a101", 10.0, depotId="  a101-123  ", depotName="  Kadıköy Şube  "),
]), "Test")
mf = u["market_fiyatlari"][0]
ok("depot_id bosluklari kirpiliyor", mf.get("depot_id") == "a101-123", mf)
ok("depot_ad bosluklari kirpiliyor", mf.get("depot_ad") == "Kadıköy Şube", mf)

print("\n=== fiyati olmayan depot yine atlaniyor ===")

u = scr.parse_product(urun([
    depot("bim", None, depotId="bim-J251", depotName="Bim Sube"),
    depot("sok", 12.0, depotId="sok-4707", depotName="Şok Minifevziçakmak"),
]), "Test")
ok("fiyatsiz depot kayda girmiyor", len(u["market_fiyatlari"]) == 1, u["market_fiyatlari"])
ok("kalan kaydin depotu dogru", u["market_fiyatlari"][0].get("depot_id") == "sok-4707",
   u["market_fiyatlari"])
ok("en_dusuk_fiyat degismedi", u["en_dusuk_fiyat"] == 12.0, u["en_dusuk_fiyat"])

print("\n=== cok depot: her kayit kendi magazasini tasiyor ===")

u = scr.parse_product(urun([
    depot("carrefour", 85.9, depotId="carrefour-1012", depotName="Istanbul Acıbadem Hıper"),
    depot("migros", 64.95, depotId="migros-1991", depotName="Çiçekçi M Migros"),
]), "Test")
esles = {f["market"]: f.get("depot_id") for f in u["market_fiyatlari"]}
ok("carrefour dogru depota bagli", esles.get("carrefour") == "carrefour-1012", esles)
ok("migros dogru depota bagli", esles.get("migros") == "migros-1991", esles)

print("\n%d gecti, %d basarisiz" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
