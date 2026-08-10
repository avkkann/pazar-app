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
    ok("  ama satirlarda turu HALA okunuyor", urunler[0].get("turu") == "Geleneksel(Konvansiyonel)", urunler[0].get("turu"))
    ok("HACIM toplami tasiniyor", e.get("hacim") == 747440.0, e.get("hacim"))
    ok("SATIR SAYISI tasiniyor", e.get("satir_sayisi") == 2, e.get("satir_sayisi"))
    ok("fiyat_min tasiniyor", e.get("fiyat_min") == 28.51, e.get("fiyat_min"))
    ok("fiyat_max tasiniyor", e.get("fiyat_max") == 158.85, e.get("fiyat_max"))
    # turler CIKTIYA yazilmiyor: 9,8 KB (dosyanin %24'u) ve hicbir tuketici okumuyor.
    # Okunmaya devam ediyor (parse_excel_response satirlarinda "turu" var), sadece
    # merge ciktisina konmuyor.
    ok("TURLER ciktiya YAZILMIYOR (payload)", "turler" not in e, list(e.keys()))

print("\n=== 4. TUKETICILERIN BEKLEDIGI ALANLAR DURUYOR ===")
# app.js: u.ad, u.fiyat, u.gorsel / hal_gorsel_cek.py: data["urunler"][i]["ad"]
if birlesik:
    e = birlesik[0]
    for alan in ("ad", "fiyat", "birim", "sehir"):
        ok("  '%s' alani hala var" % alan, alan in e, list(e.keys()))
    ok("fiyat sayi", isinstance(e["fiyat"], (int, float)), type(e["fiyat"]))

print("\n=== 5. HACIM AGIRLIKLI BIRLESTIRME ===")
# Elma gercek ornegi: 747438 kg 28,51 TL'den, 2 kg 158,85 TL'den islem gormus.
# Duz ortalama 93,68 TL der; gercekte odenen ortalama 28,51 TL'ye cok yakin.
e = hs.merge_products([
    {"ad": "Elma", "cinsi": "ELMA", "turu": "Geleneksel(Konvansiyonel)", "fiyat": 28.51, "hacim": 747438.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "Elma", "cinsi": "ELMA", "turu": "İyi Tarım", "fiyat": 158.85, "hacim": 2.0, "birim": "Kg", "sehir": "TR"},
])[0]
ok("fiyat hacim agirlikli", abs(e["fiyat"] - 28.51) < 0.01, e["fiyat"])
ok("  duz ortalama (93,68) DEGIL", abs(e["fiyat"] - 93.68) > 1, e["fiyat"])

# Esit hacim -> duz ortalama ile ayni sonuc
d = hs.merge_products([
    {"ad": "X", "cinsi": "X", "turu": "a", "fiyat": 10.0, "hacim": 100.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "X", "cinsi": "X", "turu": "b", "fiyat": 20.0, "hacim": 100.0, "birim": "Kg", "sehir": "TR"},
])[0]
ok("esit hacimde sonuc duz ortalamaya esit (15,00)", abs(d["fiyat"] - 15.0) < 0.001, d["fiyat"])

print("\n=== 6. HACIM EKSIK/SIFIR POLITIKASI ===")
# hacim<=0 olan satir AGIRLIKTAN cikar (uydurma agirlik verilmez), digerleri hesaplar
k = hs.merge_products([
    {"ad": "K", "cinsi": "K", "turu": "a", "fiyat": 10.0, "hacim": 1000.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "K", "cinsi": "K", "turu": "b", "fiyat": 90.0, "hacim": 0.0, "birim": "Kg", "sehir": "TR"},
])[0]
ok("hacim=0 satir agirliktan cikiyor -> 10,00", abs(k["fiyat"] - 10.0) < 0.001, k["fiyat"])
ok("  ama fiyat_max hala tum satirlari goruyor (90)", k["fiyat_max"] == 90.0, k["fiyat_max"])
ok("  ve satir_sayisi hala 2", k["satir_sayisi"] == 2, k["satir_sayisi"])

n = hs.merge_products([
    {"ad": "N", "cinsi": "N", "turu": "a", "fiyat": 10.0, "hacim": None, "birim": "Kg", "sehir": "TR"},
    {"ad": "N", "cinsi": "N", "turu": "b", "fiyat": 90.0, "hacim": 0.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "N", "cinsi": "N", "turu": "c", "fiyat": 20.0, "hacim": None, "birim": "Kg", "sehir": "TR"},
])[0]
ok("TUM satirlarda hacim yoksa MEDYANA dusuyor (20,00)", abs(n["fiyat"] - 20.0) < 0.001, n["fiyat"])
ok("  duz ortalamaya (40,00) DUSMUYOR", abs(n["fiyat"] - 40.0) > 1, n["fiyat"])

t = hs.merge_products([
    {"ad": "T", "cinsi": "T", "turu": "a", "fiyat": 42.0, "hacim": None, "birim": "Kg", "sehir": "TR"},
])[0]
ok("tek satirli urun degismiyor", abs(t["fiyat"] - 42.0) < 0.001, t["fiyat"])

print("\n=== 7. CIKTI HALA GECERLI ===")
for u in (e, d, k, n, t):
    ok("  fiyat pozitif sayi (%s)" % u["ad"], isinstance(u["fiyat"], (int, float)) and u["fiyat"] > 0, u["fiyat"])
ok("fiyat 2 haneye yuvarli", e["fiyat"] == round(e["fiyat"], 2), e["fiyat"])

print("\n=== 8. SATIR BAZLI MAX_PRICE KALKTI ===")
import io
import contextlib

ok("MAX_PRICE sabiti kalmadi", not hasattr(hs, "MAX_PRICE"), getattr(hs, "MAX_PRICE", None))
ham3 = excel_yaniti([
    ["AHUDUDU(FRAMBUAZ)", "AHUDUDU(FRAMBUAZ)", "Geleneksel(Konvansiyonel)", "661,89", "506", "Kg"],
    ["AHUDUDU(FRAMBUAZ)", "AHUDUDU(FRAMBUAZ)", "İyi Tarım", "1600,00", "53", "Kg"],
])
u3, _ = hs.parse_excel_response(ham3)
ok("500 TL ustu satir artik PARSE ediliyor", len(u3) == 2, [x["fiyat"] for x in u3])

print("\n=== 9. URUN-ICI AYKIRI SATIR ELEMESI (K) ===")
ok("AYKIRI_KAT sabiti var", hasattr(hs, "AYKIRI_KAT"), "")
ok("  deger 20", getattr(hs, "AYKIRI_KAT", None) == 20, getattr(hs, "AYKIRI_KAT", None))

# Adacayi gercek ornegi: 76,48 (hacim 8, en cok islem goren) ve 4180,21 (hacim 4).
# 4180/76 = 55 kat -> veri hatasi, atilmali. Hacim agirligi TEK BASINA korumuyor:
# agirlikli ortalama 1444,39 cikardi.
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    a = hs.merge_products([
        {"ad": "Adaçayi", "cinsi": "A", "turu": "Geleneksel(Konvansiyonel)", "fiyat": 76.48, "hacim": 8.0, "birim": "Kg", "sehir": "TR"},
        {"ad": "Adaçayi", "cinsi": "A", "turu": "İyi Tarım", "fiyat": 4180.21, "hacim": 4.0, "birim": "Kg", "sehir": "TR"},
    ])
log9 = buf.getvalue()
ok("55 kat aykiri satir atildi -> 76,48", a and abs(a[0]["fiyat"] - 76.48) < 0.01, a[0]["fiyat"] if a else None)
ok("  agirlikli ortalamaya (1444,39) DUSMUYOR", a and abs(a[0]["fiyat"] - 1444.39) > 1, a[0]["fiyat"] if a else None)
ok("  atilan satir log'a basildi", "4180" in log9, log9.replace("\n", " | ")[:200])
ok("  urun adi log'da", "Adaçayi" in log9, log9.replace("\n", " | ")[:200])

# 2,4 kat fark -> gercek premium kademe olabilir, ATILMAZ
b = hs.merge_products([
    {"ad": "Ahududu", "cinsi": "A", "turu": "Geleneksel(Konvansiyonel)", "fiyat": 661.89, "hacim": 506.0, "birim": "Kg", "sehir": "TR"},
    {"ad": "Ahududu", "cinsi": "A", "turu": "İyi Tarım", "fiyat": 1600.0, "hacim": 53.0, "birim": "Kg", "sehir": "TR"},
])
ok("2,4 kat fark ATILMIYOR (premium kademe olabilir)", b and abs(b[0]["fiyat"] - 750.83) < 1, b[0]["fiyat"] if b else None)
ok("  Ahududu artik uygulamada VAR", len(b) == 1, b)

# tek satirli urunde referans yok -> eleme yapilmaz
c = hs.merge_products([{"ad": "Tek", "cinsi": "T", "turu": "x", "fiyat": 700.0, "hacim": 115.0, "birim": "Kg", "sehir": "TR"}])
ok("tek satirli urun elenmiyor", c and abs(c[0]["fiyat"] - 700.0) < 0.01, c[0]["fiyat"] if c else None)

print("\n=== 10. URUN BAZLI AKIL SAGLIGI KONTROLU ===")
ok("URUN_MAX_FIYAT sabiti var", hasattr(hs, "URUN_MAX_FIYAT"), "")
ok("  deger 2000", getattr(hs, "URUN_MAX_FIYAT", None) == 2000, getattr(hs, "URUN_MAX_FIYAT", None))

# Mercan Kosk gercek ornegi: tek satir, 4800 TL, hacim 0
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    d = hs.merge_products([
        {"ad": "Mercan Köşk", "cinsi": "M", "turu": "İyi Tarım", "fiyat": 4800.0, "hacim": 0.0, "birim": "Kg", "sehir": "TR"},
        {"ad": "Domates", "cinsi": "D", "turu": "x", "fiyat": 30.0, "hacim": 5000.0, "birim": "Kg", "sehir": "TR"},
    ])
log10 = buf.getvalue()
ok("absurd fiyatli urun DUSTU", all(x["ad"] != "Mercan Köşk" for x in d), [x["ad"] for x in d])
ok("  saglam urun kaldi", any(x["ad"] == "Domates" for x in d), [x["ad"] for x in d])
ok("  dusurme SESSIZ DEGIL", "Mercan" in log10, log10.replace("\n", " | ")[:200])
ok("  sebep log'da yaziyor", "URUN_MAX_FIYAT" in log10 or "2000" in log10, log10.replace("\n", " | ")[:200])

# hacmi bilinmeyen ama fiyati MAKUL urun DUSMEZ (fazla ileri gitme)
g2 = hs.merge_products([{"ad": "Hacimsiz", "cinsi": "H", "turu": "x", "fiyat": 25.0, "hacim": 0.0, "birim": "Kg", "sehir": "TR"}])
ok("hacmi 0 ama fiyati makul urun KALIYOR", len(g2) == 1 and g2[0]["fiyat"] == 25.0, g2)

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    e2 = hs.merge_products([
        {"ad": "Absurd", "cinsi": "A", "turu": "x", "fiyat": 3000.0, "hacim": 500.0, "birim": "Kg", "sehir": "TR"},
    ])
log10b = buf.getvalue()
ok("2000 TL ustu urun DUSTU", len(e2) == 0, e2)
ok("  esik log'da geciyor", "2000" in log10b, log10b.replace("\n", " | ")[:200])

f2 = hs.merge_products([{"ad": "Frenk", "cinsi": "F", "turu": "x", "fiyat": 1102.75, "hacim": 132.0, "birim": "Kg", "sehir": "TR"}])
ok("1102,75 TL (gercek hacimli) KALIYOR", len(f2) == 1, f2)

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    hs.merge_products([{"ad": "Normal", "cinsi": "N", "turu": "x", "fiyat": 30.0, "hacim": 100.0, "birim": "Kg", "sehir": "TR"}])
ok("sorun yoksa gereksiz uyari basmiyor", buf.getvalue().strip() == "", repr(buf.getvalue()[:80]))

print("\n=== 9. HAL GECMISI ===")
import tempfile
import json as _json

ok("hal_gecmis_kaydet tanimli", hasattr(hs, "hal_gecmis_kaydet"))

if hasattr(hs, "hal_gecmis_kaydet"):
    tmpdir = tempfile.mkdtemp()
    yol = os.path.join(tmpdir, "hal_gecmis.json")
    U = lambda ad, f: {"ad": ad, "fiyat": f, "birim": "Kg", "sehir": "TR"}

    hs.hal_gecmis_kaydet([U("Domates", 30.0), U("Elma", 28.5)], bugun="2026-08-10", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("dosya olustu ve 2 urun var", len(g) == 2, list(g.keys()))
    ok("  kayit formati {t,f}", g["domates"][0] == {"t": "2026-08-10", "f": 30.0}, g["domates"][0])
    ok("  market alani YOK (tek kaynak)", "m" not in g["domates"][0], g["domates"][0])

    # ayni deger, ertesi gun -> yeni kayit YOK
    hs.hal_gecmis_kaydet([U("Domates", 30.0), U("Elma", 28.5)], bugun="2026-08-11", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("deger degismediyse kayit EKLENMIYOR", len(g["domates"]) == 1, g["domates"])

    # deger degisti -> yeni kayit
    hs.hal_gecmis_kaydet([U("Domates", 34.0), U("Elma", 28.5)], bugun="2026-08-12", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("deger degisince kayit ekleniyor", len(g["domates"]) == 2, g["domates"])
    ok("  eski kayit korunuyor", g["domates"][0]["f"] == 30.0, g["domates"])
    ok("  degismeyen urun yine tek kayit", len(g["elma"]) == 1, g["elma"])

    # ayni gun tekrar kosulursa mukerrer kayit yok
    hs.hal_gecmis_kaydet([U("Domates", 99.0)], bugun="2026-08-12", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("ayni gun ikinci kosu mukerrer kayit yazmiyor", len(g["domates"]) == 2, g["domates"])

    # yeni urun
    hs.hal_gecmis_kaydet([U("Kivi", 55.0)], bugun="2026-08-13", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("yeni urun kendi listesini aliyor", g.get("kivi") and g["kivi"][0]["f"] == 55.0, g.get("kivi"))
    ok("  onceki urunler silinmiyor", "domates" in g and "elma" in g, list(g.keys()))

    # fiyati olmayan urun
    hs.hal_gecmis_kaydet([{"ad": "Bos", "fiyat": None, "birim": "Kg", "sehir": "TR"}], bugun="2026-08-14", dosya=yol)
    g = _json.load(open(yol, encoding="utf-8"))
    ok("fiyati None olan urun kaydedilmiyor", "bos" not in g, list(g.keys()))

print("\n=== 10. GERIYE DONUK DOLDURMA YOK ===")
kaynak = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "hal_scraper.py"), encoding="utf-8").read()
ok("git snapshot'tan doldurma kodu YOK",
   "git show" not in kaynak and "subprocess" not in kaynak, "git/subprocess izi var")
ok("neden doldurulmadigi yorumda aciklanmis",
   "geriye donuk" in kaynak.lower() or "geriye dönük" in kaynak.lower(), "aciklama yok")
ok("  gerekce: eski kayitlar duz ortalamayla uretilmis",
   "duz ortalama" in kaynak.lower() or "düz ortalama" in kaynak.lower(), "gerekce yok")

print("\n=== 11. SCRAPE AKISINA BAGLI ===")
sc = kaynak[kaynak.index("def scrape("):]
ok("scrape() hal_gecmis_kaydet cagiriyor", "hal_gecmis_kaydet(" in sc, "")
ok("  hal.json yazildiktan SONRA cagriliyor",
   sc.index("hal_gecmis_kaydet(") > sc.index("json.dump(output"), "")

print("\nPASS=%d  FAIL=%d" % (_pass, _fail))
sys.exit(1 if _fail else 0)
