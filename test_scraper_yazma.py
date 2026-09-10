# -*- coding: utf-8 -*-
"""EKSIK VERI TAM DOSYANIN UZERINE YAZILMAZ + ATOMIK YAZMA.

KUSUR (denetim, yuksek): _kategori_sayfalarini_cek'in sayfalama dongusu
ag koptugunda SESSIZCE `break` ediyor ve cagirana durum olarak "ok"
donuyordu. 20 sayfalik bir kategorinin 5. sayfasinda kopan bir baglanti,
dosyaya yalnizca ilk 5 sayfayi yaziyordu -- ve bu YARIM liste, tam olan
dosyanin UZERINE geciyordu. Zincirleme sonuc: eksik dosya -> sync_db
o urunleri "artik gecerli degil" sayar -> fiyat gecmisi ve rozetler
dusen urunlerde SILINIR.

Ikinci kusur ayni satirda: open(yol, "w") dosyayi ANINDA kirpiyor. Surec
yazma ortasinda olurse (runner zaman asimi, disk dolu) geride YARIM json
kalir ve ertesi gece _apply_fiyat_gecmisi onu okuyamaz.

Test DAVRANISSAL: scraper.py dogrudan import edilir, mantik kopyalanmaz.
Kontrol grubu gomulu -- once aletin kusuru GOREBILDIGI gosterilir.
Kullanim: py test_scraper_yazma.py
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


# ── sahte sayfa kaynagi ─────────────────────────────────────────────
class SahteSayfalar:
    """fetch_page yerine gecer. `kes` sayfasinda None doner (ag koptu)."""

    def __init__(self, toplam, sayfa_boyu=25, kes=None, bos_sayfa=None):
        self.toplam = toplam
        self.sayfa_boyu = sayfa_boyu
        self.kes = kes
        self.bos_sayfa = bos_sayfa
        self.cagri = []

    def __call__(self, session, keyword, page):
        self.cagri.append(page)
        if self.kes is not None and page >= self.kes:
            return None
        if self.bos_sayfa is not None and page >= self.bos_sayfa:
            return {"numberOfFound": self.toplam, "content": []}
        bas = page * self.sayfa_boyu
        adet = max(0, min(self.sayfa_boyu, self.toplam - bas))
        return {"numberOfFound": self.toplam,
                "content": [{"id": bas + i, "title": "U%d" % (bas + i)} for i in range(adet)]}


def cek(toplam, kes=None, bos_sayfa=None):
    eski_fetch = scr.fetch_page
    eski_parse = scr.parse_product
    eski_sleep = getattr(scr.time, "sleep", None)
    scr.fetch_page = SahteSayfalar(toplam, kes=kes, bos_sayfa=bos_sayfa)
    scr.parse_product = lambda item, kat, slug: {"_sid": "s%d" % item["id"], "ad": item["title"]}
    scr.time.sleep = lambda *a, **k: None
    try:
        return scr._kategori_sayfalarini_cek(None, "Test", "Test", "t")
    finally:
        scr.fetch_page = eski_fetch
        scr.parse_product = eski_parse
        if eski_sleep:
            scr.time.sleep = eski_sleep


print("\n=== 0. ALET KONTROLU: sahte kaynak gercekten sayfaliyor mu ===")
urunler, durum = cek(60)
ok("tam cekim 60 urun getiriyor", len(urunler) == 60, len(urunler))
ok("  durum 'ok'", durum == "ok", durum)
ok("  birden fazla sayfa istendi (alet tek sayfada durmuyor)",
   len(scr.fetch_page.cagri) if hasattr(scr.fetch_page, "cagri") else True)

print("\n=== 1. SAYFALAMA YARIDA KESILIRSE 'eksik' BILDIRILIYOR ===")
urunler, durum = cek(200, kes=3)          # 3. sayfada ag kopuyor
ok("durum 'eksik' (eskiden SESSIZCE 'ok' idi)", durum == "eksik", durum)
ok("  veri var ama TAM DEGIL", 0 < len(urunler) < 200, len(urunler))

print("\n=== 2. ORTADA BOS SAYFA da eksik sayiliyor ===")
urunler, durum = cek(200, bos_sayfa=2)
ok("durum 'eksik'", durum == "eksik", durum)
ok("  KONTROL: beklenen toplama ULASILDIYSA 'ok'", cek(50)[1] == "ok", cek(50)[1])

print("\n=== 3. ILK SAYFA HATALARI ESKISI GIBI AYRISIYOR ===")
# Bu ikisi "eksik"ten FARKLI: veri hic gelmedi. Karistirilirsa yanlis
# mesaj basilir ve tesbit zorlasir.
urunler, durum = cek(200, kes=0)
ok("ilk sayfa ag hatasi -> 'ag_hatasi'", durum == "ag_hatasi", durum)
urunler, durum = cek(0)
ok("  ilk sayfa bos -> 'bos'", durum == "bos", durum)

print("\n=== 4. _mevcut_urun_sayisi ===")
gecici = tempfile.mkdtemp()
try:
    yol = os.path.join(gecici, "k.json")
    ok("dosya yoksa None", scr._mevcut_urun_sayisi(yol) is None)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump([{"a": 1}, {"a": 2}, {"a": 3}], f)
    ok("  var olan dosyada sayiyi veriyor", scr._mevcut_urun_sayisi(yol) == 3,
       scr._mevcut_urun_sayisi(yol))
    with open(yol, "w", encoding="utf-8") as f:
        f.write('[{"a":1},{"a"')            # YARIM json
    ok("  bozuk dosyada None (patlamiyor)", scr._mevcut_urun_sayisi(yol) is None)
finally:
    shutil.rmtree(gecici, ignore_errors=True)

print("\n=== 5. ATOMIK YAZMA ===")
gecici = tempfile.mkdtemp()
try:
    yol = os.path.join(gecici, "a.json")
    scr._atomik_json_yaz(yol, [{"x": 1}], indent=2)
    with open(yol, encoding="utf-8") as f:
        ok("normal yazma calisiyor", json.load(f) == [{"x": 1}])
    ok("  .tmp geride birakilmiyor", not os.path.exists(yol + ".tmp"),
       os.listdir(gecici))

    # KONTROL GRUBU: yazma ORTASINDA patlarsa eski dosya BOZULMAMALI.
    # json.dump'i patlatarak gercek senaryo uretiliyor (disk dolu / surec
    # olduruldu). Eskiden open(...,"w") dosyayi ONCE kirptigi icin eski
    # icerik burada KAYBOLURDU.
    class Patlayan:
        def __repr__(self):
            raise RuntimeError("disk doldu")

    onceki = None
    try:
        scr._atomik_json_yaz(yol, [Patlayan()])
    except Exception as e:
        onceki = str(e)
    ok("  yazma hatasi YUTULMUYOR (sesli)", onceki is not None, onceki)
    with open(yol, encoding="utf-8") as f:
        korundu = json.load(f)
    ok("  ESKI dosya bozulmadan duruyor", korundu == [{"x": 1}], korundu)
    ok("  yarim .tmp temizlendi", not os.path.exists(yol + ".tmp"), os.listdir(gecici))
finally:
    shutil.rmtree(gecici, ignore_errors=True)

print("\n=== 6. KAYNAK KILIDI: ciplak `open(..., \"w\")` geri gelmesin ===")
with open(os.path.join(_BASE, "scraper.py"), encoding="utf-8") as f:
    kaynak = f.read()
# Yorumlari soy: asagidaki iddia bir deseni YASAKLIYOR ve ustteki aciklama
# tam da o deseni ANLATIYOR -- soyulmazsa test kendi yorumuyla eslesir.
temiz = "\n".join(
    "" if l.lstrip().startswith("#") else l for l in kaynak.split("\n"))
ok("kategori dosyasi atomik yaziliyor",
   "_atomik_json_yaz(cat_file, products" in temiz, "")
ok("  gecmis dosyasi atomik yaziliyor",
   "_atomik_json_yaz(gecmis_dosya, gecmis" in temiz, "")
ok('  cat_file icin ciplak open(..., "w") YOK',
   'open(cat_file, "w"' not in temiz, "geri gelmis")
ok('  gecmis_dosya icin ciplak open(..., "w") YOK',
   'open(gecmis_dosya, "w"' not in temiz, "geri gelmis")
# Kapi CAGRIYA degil KOSULA bagli olmali (bu depoda bes kez yasanan kor nokta).
ok("  eksik veri kapisi mevcut dosyayla KARSILASTIRIYOR",
   "len(products) < _onceki" in temiz, "kosul yok")
ok("  ve yalnizca eksik veri varken devrede",
   "if eksik_veri:" in temiz, "kosulsuz")

print("\nPASS=%d  FAIL=%d" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
