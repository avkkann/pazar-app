# -*- coding: utf-8 -*-
"""Resim adimi testi: (1) olu dongu kesilmesi, (2) resim kaliciligi.
scraper.py'yi dogrudan import eder, kopya mantik degil.
Kullanim: py test_resim.py
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


class SahteYanit:
    def __init__(self, kod, govde=None, patlat=None):
        self.status_code = kod
        self._govde = govde if govde is not None else {}
        self._patlat = patlat

    def json(self):
        if self._patlat:
            raise self._patlat
        return self._govde


print("\n=== 1. _searlo_resim_ara HATA TURUNU DONDURUYOR MU ===")
imza_ok = False
try:
    import inspect
    kaynak = inspect.getsource(scr._searlo_resim_ara)
    imza_ok = "hata" in kaynak
except Exception:
    pass
ok("_searlo_resim_ara kaynaginda hata bilgisi var", imza_ok)

_gercek_get = scr.requests.get


def sahte_get_kur(yanit=None, istisna=None, sayac=None):
    def _g(*a, **k):
        if sayac is not None:
            sayac.append(1)
        if istisna:
            raise istisna
        return yanit
    scr.requests.get = _g


def geri_al():
    scr.requests.get = _gercek_get


scr.SEARLO_API_KEY = "test-key"

senaryolar = [
    ("402 INSUFFICIENT_CREDITS", SahteYanit(402, {"code": "INSUFFICIENT_CREDITS"}), None, "402", True),
    ("401 gecersiz anahtar",     SahteYanit(401, {"message": "Invalid or expired API key"}), None, "401", True),
    ("403 yasak",                SahteYanit(403, {}), None, "403", True),
    ("429 hiz limiti",           SahteYanit(429, {}), None, "429", False),
    ("500 sunucu",               SahteYanit(500, {}), None, "500", False),
]
for ad, yanit, istisna, beklenenTur, beklenenKalici in senaryolar:
    sahte_get_kur(yanit=yanit, istisna=istisna)
    try:
        sonuc = scr._searlo_resim_ara("test urun")
    except Exception as e:
        sonuc = ("EXC", str(e), None)
    geri_al()
    ok(ad + " -> 3'lu donus", isinstance(sonuc, tuple) and len(sonuc) == 3, sonuc)
    if isinstance(sonuc, tuple) and len(sonuc) == 3:
        h = sonuc[2]
        ok("  " + ad + " hata tur=" + beklenenTur,
           isinstance(h, dict) and str(h.get("tur")) == beklenenTur, h)
        ok("  " + ad + " kalici=" + str(beklenenKalici),
           isinstance(h, dict) and bool(h.get("kalici")) == beklenenKalici, h)

sahte_get_kur(istisna=scr.requests.exceptions.Timeout("zaman asimi"))
s = scr._searlo_resim_ara("x")
geri_al()
ok("timeout -> tur=timeout, gecici", isinstance(s[2], dict) and s[2].get("tur") == "timeout" and not s[2].get("kalici"), s[2])

sahte_get_kur(yanit=SahteYanit(200, {"images": [{"image_url": "http://x/y.png", "title": "T"}]}))
s = scr._searlo_resim_ara("x")
geri_al()
ok("200 basarili -> hata None, img dolu", s[0] == "http://x/y.png" and s[2] is None, s)

sahte_get_kur(yanit=SahteYanit(200, {"images": []}))
s = scr._searlo_resim_ara("x")
geri_al()
ok("200 ama bos sonuc -> hata tur=bos_sonuc, gecici",
   isinstance(s[2], dict) and s[2].get("tur") == "bos_sonuc" and not s[2].get("kalici"), s[2])

print("\n=== 2. resimleri_doldur: KALICI HATADA IPTAL ===")


def kategori_dosyasi_kur(tmp, adet):
    os.makedirs(os.path.join(tmp, "data"), exist_ok=True)
    urunler = [{"_sid": "t_%d" % i, "ad": "Urun %d" % i, "agirlik_hacim": "1 KG", "resim": None}
               for i in range(adet)]
    for slug, kw, dosya in scr.CATEGORIES:
        with open(os.path.join(tmp, "data", dosya + ".json"), "w", encoding="utf-8") as f:
            json.dump(urunler if dosya == "urunler_meyve" else [], f, ensure_ascii=False)


def calistir_iptal_testi(yanit, adet=400):
    tmp = tempfile.mkdtemp()
    kategori_dosyasi_kur(tmp, adet)
    eski_dir, eski_uyku = scr.DATA_DIR, scr.time.sleep
    scr.DATA_DIR = os.path.join(tmp, "data")
    scr.time.sleep = lambda *a, **k: None
    sayac = []
    sahte_get_kur(yanit=yanit, sayac=sayac)
    import io as _io
    tut = _io.StringIO()
    eski_out = sys.stdout
    sys.stdout = tut
    try:
        scr.resimleri_doldur()
    finally:
        sys.stdout = eski_out
        geri_al()
        scr.DATA_DIR, scr.time.sleep = eski_dir, eski_uyku
    return len(sayac), tut.getvalue()


istek, cikti = calistir_iptal_testi(SahteYanit(402, {"code": "INSUFFICIENT_CREDITS"}))
ok("402: 5 ardisik kalici hatadan sonra duruyor", istek <= 5, "yapilan istek=%d" % istek)
ok("  IPTAL satiri basiliyor", "[RESIM] IPTAL" in cikti, cikti.strip().splitlines()[-3:] if cikti else "")
ok("  mesajda 402 geciyor", "402" in cikti)
ok("  mesajda INSUFFICIENT_CREDITS geciyor", "INSUFFICIENT_CREDITS" in cikti)
ok("  mesajda yapilmayan istek sayisi var", "istek yapilmadi" in cikti or "istek yapılmadı" in cikti, "")
ok("  GUNLUK_LIMIT(950) yerine 5 istekte durdu (tasarruf)", istek < 950, "istek=%d" % istek)

istek429, cikti429 = calistir_iptal_testi(SahteYanit(429, {}), adet=20)
ok("429 (gecici): IPTAL YOK, mevcut davranis suruyor", "[RESIM] IPTAL" not in cikti429, "")
ok("  429'da tum urunler denendi", istek429 == 20, "istek=%d" % istek429)

print("\n=== 3. OZET: hata SAYISI degil hata TURU dagilimi ===")
ok("ozet satirinda tur dagilimi var",
   ("402" in cikti) or ("tur" in cikti.lower()), cikti.strip().splitlines()[-2:] if cikti else "")
ok("429 ozetinde de tur dagilimi var", "429" in cikti429, cikti429.strip().splitlines()[-2:] if cikti429 else "")

print("\n=== 4. IS 2: RESIM KALICILIGI ===")
fn = getattr(scr, "_apply_resim_koru", None)
ok("_apply_resim_koru tanimli", fn is not None)

if fn:
    tf = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump([{"_sid": "s1", "resim": "http://eski/a.png"},
               {"_sid": "s2", "resim": "http://eski/b.png"},
               {"_sid": "s3", "resim": None}], tf, ensure_ascii=False)
    tf.close()

    yeni = [{"_sid": "s1", "resim": None},                    # API bos -> eski korunmali
            {"_sid": "s2", "resim": "http://yeni/b2.png"},    # API dolu -> API kazanmali
            {"_sid": "s3", "resim": None},                    # ikisi de bos
            {"_sid": "s4", "resim": None}]                    # dosyada yok
    fn(yeni, tf.name)
    d = {u["_sid"]: u.get("resim") for u in yeni}
    ok("API bos + eski dolu -> ESKI KORUNDU", d["s1"] == "http://eski/a.png", d)
    ok("API dolu -> API KAZANDI", d["s2"] == "http://yeni/b2.png", d)
    ok("ikisi de bos -> None kaliyor", d["s3"] is None, d)
    ok("dosyada olmayan urun -> None, patlamiyor", d["s4"] is None, d)

    yeni2 = [{"_sid": "s1", "resim": None}]
    fn(yeni2, os.path.join(tempfile.gettempdir(), "yok_boyle_dosya_xyz.json"))
    ok("eski dosya yoksa patlamiyor", yeni2[0].get("resim") is None)
    os.unlink(tf.name)

src = open(os.path.join(_BASE, "scraper.py"), encoding="utf-8").read()
ok("_apply_resim_koru scrape akisinda cagriliyor", src.count("_apply_resim_koru(") >= 2,
   src.count("_apply_resim_koru("))
ok("  cagri sirasi: resim koru, fiyat gecmisinden SONRA",
   src.find("_apply_resim_koru(products") > src.find("_apply_fiyat_gecmisi(products"), "")

print("\nPASS=%d  FAIL=%d" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
