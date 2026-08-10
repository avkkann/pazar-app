# -*- coding: utf-8 -*-
"""hal_scraper testleri. Ag istegi YOK — sahte Excel yaniti uretilip parse edilir.

Kaynak tablo kolonlari (10.08.2026 bulteninden dogrulandi):
  0 Urun Adi | 1 Urun Cinsi | 2 Urun Turu | 3 Ortalama Fiyat | 4 Islem Hacmi | 5 Birim Adi
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hal_scraper as hs

_pass = 0
_fail = 0


def ok(ad, kosul, detay=""):
    global _pass, _fail
    if kosul:
        _pass += 1
        print("  PASS  " + ad)
    else:
        _fail += 1
        print("  FAIL  " + ad + ("  -> " + str(detay) if detay else ""))


def excel_yaniti(satirlar, bulten="10.08.2026"):
    """Kaynagin dondurdugu UTF-16 HTML tablosunu birebir taklit eder."""
    html = ["<table>"]
    html.append("<tr><td>Bülten Tarihi : %s (Bilgi amaclidir.)</td></tr>" % bulten)
    html.append("<tr><td>Ürün Adı</td><td>Ürün Cinsi</td><td>Ürün Türü</td>"
                "<td>Ortalama Fiyat</td><td>İşlem Hacmi</td><td>Birim Adı</td></tr>")
    for s in satirlar:
        html.append("<tr>" + "".join("<td>%s</td>" % c for c in s) + "</tr>")
    html.append("</table>")
    return "".join(html).encode("utf-16")


print("\n=== 1. KOLONLAR OKUNUYOR MU ===")
ham = excel_yaniti([
    ["ACUR", "ACUR", "Geleneksel(Konvansiyonel)", "20,02", "12758", "Kg"],
    ["ADAÇAYI (YAŞ-TAZE)", "ADAÇAYI (YAŞ-TAZE)", "Geleneksel(Konvansiyonel)", "76,48", "8", "Kg"],
    ["ADAÇAYI (YAŞ-TAZE)", "ADAÇAYI (YAŞ-TAZE)", "İyi Tarım", "410,21", "4", "Kg"],
])
urunler, tarih = hs.parse_excel_response(ham)
ok("3 satir parse edildi", len(urunler) == 3, len(urunler))
ok("bulten tarihi okundu", tarih == "10.08.2026", tarih)

if urunler:
    r = urunler[0]
    ok("ad okunuyor", r.get("ad") == "Acur", r.get("ad"))
    ok("fiyat okunuyor (cols[3])", r.get("fiyat") == 20.02, r.get("fiyat"))
    ok("birim okunuyor (cols[5])", r.get("birim") == "Kg", r.get("birim"))
    ok("CINSI okunuyor (cols[1])", r.get("cinsi") == "ACUR", r.get("cinsi"))
    ok("TURU okunuyor (cols[2])", r.get("turu") == "Geleneksel(Konvansiyonel)", r.get("turu"))
    ok("HACIM okunuyor (cols[4])", r.get("hacim") == 12758, r.get("hacim"))
    ok("  hacim sayi olarak (metin degil)", isinstance(r.get("hacim"), (int, float)), type(r.get("hacim")))

if len(urunler) >= 3:
    ok("ayni urunun farkli turu ayri satir kaliyor",
       urunler[1]["turu"] != urunler[2]["turu"], (urunler[1].get("turu"), urunler[2].get("turu")))
    ok("  ve fiyatlari ayri", urunler[1]["fiyat"] != urunler[2]["fiyat"],
       (urunler[1].get("fiyat"), urunler[2].get("fiyat")))

print("\n=== 2. BOZUK/EKSIK HUCRE ===")
ham2 = excel_yaniti([
    ["KABAK", "KABAK", "Geleneksel(Konvansiyonel)", "30,00", "", "Kg"],
    ["MARUL", "MARUL", "İyi Tarım", "", "500", "Kg"],
])
u2, _ = hs.parse_excel_response(ham2)
ok("hacim bos ise satir DUSMUYOR (fiyat var)", len(u2) == 1, len(u2))
if u2:
    ok("  bos hacim None olarak tasiniyor", u2[0].get("hacim") is None, u2[0].get("hacim"))
ok("fiyati olmayan satir atiliyor", all(x["ad"] != "Marul" for x in u2), [x["ad"] for x in u2])

print("\n=== 3. MERGE CIKTISI KOLONLARI TASIYOR ===")
birlesik = hs.merge_products([
    {"ad": "Elma", "cinsi": "ELMA", "turu": "Geleneksel(Konvansiyonel)", "fiyat": 28.51, "hacim": 747438.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "Elma", "cinsi": "ELMA", "turu": "İyi Tarım", "fiyat": 158.85, "hacim": 2.0, "birim": "Kg", "sehir": "TR"},
])
ok("tek urune indi", len(birlesik) == 1, len(birlesik))
if birlesik:
    e = birlesik[0]
    ok("ad korundu", e.get("ad") == "Elma", e.get("ad"))
    ok("birim korundu", e.get("birim") == "Kg", e.get("birim"))
    ok("sehir korundu", e.get("sehir") == "TR", e.get("sehir"))
    ok("HACIM toplami tasiniyor", e.get("hacim") == 747440.0, e.get("hacim"))
    ok("SATIR SAYISI tasiniyor", e.get("satir_sayisi") == 2, e.get("satir_sayisi"))
    ok("fiyat_min tasiniyor", e.get("fiyat_min") == 28.51, e.get("fiyat_min"))
    ok("fiyat_max tasiniyor", e.get("fiyat_max") == 158.85, e.get("fiyat_max"))
    ok("TURLER tasiniyor", isinstance(e.get("turler"), list) and len(e["turler"]) == 2, e.get("turler"))

print("\n=== 4. TUKETICILERIN BEKLEDIGI ALANLAR DURUYOR ===")
# app.js: u.ad, u.fiyat, u.gorsel / hal_gorsel_cek.py: data["urunler"][i]["ad"]
if birlesik:
    e = birlesik[0]
    for alan in ("ad", "fiyat", "birim", "sehir"):
        ok("  '%s' alani hala var" % alan, alan in e, list(e.keys()))
    ok("fiyat sayi", isinstance(e["fiyat"], (int, float)), type(e["fiyat"]))

print("\nPASS=%d  FAIL=%d" % (_pass, _fail))
sys.exit(1 if _fail else 0)
