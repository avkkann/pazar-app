#!/usr/bin/env python3
"""
Veri tazelik kontrolu.

data/urunler_*.json ve data/anasayfa.json dosyalarinin her birinin SON COMMIT
tarihine bakar; herhangi biri ESIK_GUN'den eskiyse net bir mesajla exit 1 verir.

anasayfa.json NEDEN BURADA: ana sayfanin dort seridi (tuzaklar, dusenler,
supheli, zam) artik TAMAMEN bu dosyaya bagli, istemci hicbir hesap yapmiyor.
Dosya bayatlarsa ana sayfa SESSIZCE eskir - kategori dosyalari taze olsa bile.

Uretimi bilerek "Veri Guncelle" isine de eklendi. Yalnizca "Build ve Deploy"
uretseydi repoya hic islenmezdi (o isin izni contents: read) ve bu git tabanli
kontrol iki gunde YANLIS ALARM verirdi. Yanlis alarm, hic alarm olmamasindan
kotudur - kirmizi hattin anlamini yok eder.

Amaci hattı GORUNUR sekilde kirmiziya cevirmektir: 2026-07 sonunda
marketfiyati.org.tr "Temizlik ve Kişisel Bakım" kategorisini ikiye bolunce
scraper o dosyayi 12 gun boyunca hic yazmadi ama is yesil gecti ve kimse fark
etmedi. Bu kontrol o sessizligi bir daha mumkun kilmaz.

NOT: git gecmisi gerektirir. CI'da actions/checkout varsayilan olarak
--depth=1 (shallow) ceker; bu yuzden update-data.yml'da fetch-depth: 0 ayarli
olmalidir, yoksa HEAD'de degismeyen dosyalar icin commit gecmisi bulunamaz.
"""
import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

ESIK_GUN = 2

# ESIK_GUN_HAL: --hub kipinde /hal/ sayfasina uygulanan gevsek tazelik esigi.
# AYNI GEREKCE hal.json'un asagidaki izlenen_dosyalar()'da HARIC tutulmasiyla
# birebir ayni: kaynak Ticaret Bakanligi bulteni, kendi ritmi var ve hafta
# sonu guncellenmiyor -- 2 gunluk esik Cuma aksami uretilen bir bulteni
# Pazartesi sabahi BAYAT sayar, bu yanlis alarmdir.
ESIK_GUN_HAL = 5

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(_BASE_DIR, "data")


def son_commit_zamani(path):
    """Dosyaya en son dokunan commit'in tarihi. Bulunamazsa None."""
    rel = os.path.relpath(path, _BASE_DIR).replace(os.sep, "/")
    try:
        r = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", rel],
            cwd=_BASE_DIR, capture_output=True, text=True, timeout=60,
        )
    except Exception as e:
        print(f"  [uyari] git calistirilamadi ({rel}): {e}")
        return None
    if r.returncode != 0:
        return None
    ham = r.stdout.strip()
    if not ham:
        return None
    try:
        return datetime.fromisoformat(ham)
    except ValueError:
        return None


def izlenen_dosyalar():
    """Tazeligi izlenen dosyalar.

    hal.json BILEREK DISARIDA: kaynagi Ticaret Bakanligi bulteni, kendi
    ritmi var ve hafta sonu guncellenmiyor.
    il_marketler.json BILEREK DISARIDA: HAFTALIK is (Il Market Haritasi),
    2 gun esigi ona uymaz.
    """
    dosyalar = sorted(glob.glob(os.path.join(DATA_DIR, "urunler_*.json")))
    for ek in ("anasayfa.json", "indirim_analiz_son.json"):
        yol = os.path.join(DATA_DIR, ek)
        if os.path.exists(yol):
            dosyalar.append(yol)
    return dosyalar


def bayat_mi(zaman, simdi):
    """Commit zamani None ise (gecmis bulunamadi) BAYAT sayilir - sessiz
    gecmektense gurultu yapmak amac."""
    if zaman is None:
        return True
    return (simdi - zaman).total_seconds() / 86400.0 > ESIK_GUN


def main():
    dosyalar = izlenen_dosyalar()
    if not dosyalar:
        print("TAZELIK HATASI: data/urunler_*.json hic bulunamadi.")
        return 1
    if not any(os.path.basename(p) == "anasayfa.json" for p in dosyalar):
        print("TAZELIK HATASI: data/anasayfa.json YOK.")
        print("  Ana sayfanin dort seridi bu dosyadan besleniyor; yoksa istemci")
        print("  geriye dusup 17 MB indirir. scripts/anasayfa-uret.mjs kostu mu?")
        return 1
    if not any(os.path.basename(p) == "indirim_analiz_son.json" for p in dosyalar):
        print("TAZELIK HATASI: data/indirim_analiz_son.json YOK.")
        print("  'Sahte Indirim Analizi' adimi continue-on-error ile kosuyor;")
        print("  basarisiz olunca is YESIL geciyor ama 'Bu indirimlere dikkat'")
        print("  seridi ESKI puanlarla uretiliyor. Damga yoksa adim atlandi demektir.")
        return 1

    simdi = datetime.now(timezone.utc)
    bayatlar = []

    print(f"Veri tazelik kontrolu - esik: {ESIK_GUN} gun")
    print("-" * 64)
    for path in dosyalar:
        ad = os.path.basename(path)
        zaman = son_commit_zamani(path)
        if zaman is None:
            print(f"  {ad:32s}  commit gecmisi BULUNAMADI")
            bayatlar.append((ad, None))
            continue
        yas = (simdi - zaman).total_seconds() / 86400.0
        durum = "BAYAT" if bayat_mi(zaman, simdi) else "taze"
        print(f"  {ad:32s}  {zaman.date()}  {yas:5.1f} gun  {durum}")
        if bayat_mi(zaman, simdi):
            bayatlar.append((ad, yas))
    print("-" * 64)

    if not bayatlar:
        print(f"TAZELIK OK: {len(dosyalar)} dosyanin hepsi {ESIK_GUN} gunden yeni.")
        return 0

    print(f"TAZELIK HATASI: {len(bayatlar)}/{len(dosyalar)} dosya {ESIK_GUN} gunden eski.")
    for ad, yas in bayatlar:
        if yas is None:
            print(f"  - {ad}: commit gecmisi yok (shallow clone mu?)")
        else:
            print(f"  - {ad}: en son {yas:.1f} gun once guncellendi")
    print()
    print("Muhtemel sebep: scraper bu kategoriyi cekemiyor - kaynak sitede kategori")
    print("adi degismis olabilir. Scraper loglarinda [KRITIK] satirlarina bakin.")
    return 1


# ═══════════════════════════════════════════════════════════════════════
# --hub KIPI: yayina gidecek uretilmis hub sayfalarinin (zam/market/kategori/
# hal) denetimi. Yukaridaki git-tabanli kip data/*.json dosyalarinin COMMIT
# tazeligine bakar; bu kip .hub/ (ya da yayina giden dist/) dizinindeki
# URETILMIS SAYFALARIN kendisine bakar -- manifest'in dosya sistemiyle
# tutarli oldugunu, manifest'in TURETILMIS beklenen sayfa kumesini eksiksiz
# kapsadigini ve her sayfanin tazelik damgasi tasidigini dogrular. Ikisi de
# BAGIMSIZ calisir, biri digerinin yerini almaz, mevcut kip DEGISMEDI.
# ═══════════════════════════════════════════════════════════════════════

_TURKCE_HARF_HARITASI = {
    "ı": "i", "İ": "i", "I": "i",
    "ş": "s", "Ş": "s",
    "ğ": "g", "Ğ": "g",
    "ü": "u", "Ü": "u",
    "ö": "o", "Ö": "o",
    "ç": "c", "Ç": "c",
}


def slug(ham):
    """scripts/hub-sayfa.mjs'teki slug()'un Python karsiligi -- ayni sirayla
    ayni adimlar (Turkce harf esleme -> kucuk harf -> alt cizgi/bosluk
    tireye -> gecersiz karakterleri at -> tekrarlayan tireleri sikistir ->
    uc tireleri kirp). Market kodlarinin ('tarim_kredi' gibi) hub yoluna
    ('tarim-kredi') donusumu bu kuralla birebir eslesmeli, aksi halde
    turetilmis beklenti manifest yoluyla YANLIS karsilastirilir."""
    cevrilmis = "".join(_TURKCE_HARF_HARITASI.get(ch, ch) for ch in ham)
    cevrilmis = cevrilmis.lower()
    cevrilmis = re.sub(r"[_\s]+", "-", cevrilmis)
    cevrilmis = re.sub(r"[^a-z0-9-]", "", cevrilmis)
    cevrilmis = re.sub(r"-+", "-", cevrilmis)
    return cevrilmis.strip("-")


def app_js_market_kodlari(app_js_metni):
    """app.js'teki MARKET_NAMES nesnesinin anahtarlarini cikarir. app.js bir
    Node modulu, Python'dan import EDILEMEZ -- bu yuzden regex ile okunuyor.
    KIRILGANLIK BILEREK KABUL EDILDI: MARKET_NAMES'in bicimi degisirse
    (orn. nesne yerine Map) bu fonksiyon throw eder ve build kirmiziya
    doner -- sessizce eksik/yanlis bir kume uretmektense budur tercih
    edilen."""
    eslesme = re.search(r"const\s+MARKET_NAMES\s*=\s*\{(.*?)\};", app_js_metni, re.S)
    if not eslesme:
        raise RuntimeError("[hub-kontrol] app.js icinde MARKET_NAMES bulunamadi")
    kodlar = re.findall(r"(\w+)\s*:\s*'", eslesme.group(1))
    if not kodlar:
        raise RuntimeError("[hub-kontrol] MARKET_NAMES govdesinde anahtar bulunamadi")
    return kodlar


def app_js_kategori_sluglari(app_js_metni):
    """app.js'teki KATEGORILER dizisindeki slug degerlerini cikarir."""
    eslesme = re.search(r"const\s+KATEGORILER\s*=\s*\[(.*?)\];", app_js_metni, re.S)
    if not eslesme:
        raise RuntimeError("[hub-kontrol] app.js icinde KATEGORILER bulunamadi")
    sluglar = re.findall(r"slug\s*:\s*'([^']+)'", eslesme.group(1))
    if not sluglar:
        raise RuntimeError("[hub-kontrol] KATEGORILER govdesinde slug bulunamadi")
    return sluglar


def turetilmis_beklenen_sayfalar(app_js_yolu):
    """manifest'ten BAGIMSIZ, app.js'ten turetilen beklenen sayfa kumesi:
    her market (MARKET_NAMES) + her kategori (KATEGORILER) + /hal/.

    ZAM AYLARI BILEREK BURADA TURETILMIYOR: hangi ayin uygun oldugu
    hub-uret.mjs'teki iki kapinin ORTAK karari -- ayKarari() (ayin ilk
    gozlemi ayin 1-4. gunu icinde mi) VE ay oncesi en az 30 gunluk gecmis
    var mi. Bu mantigi burada ikinci kez yazmak tam olarak bu projenin
    tekrar tekrar dustugu 'iki sayac' tuzagidir (urunler.json ve
    marketfiyati.json'un iki kez ayristigi desen). Zam sayfalari icin
    denetim bunun yerine ayri, daha zayif ama BAGIMSIZ kalan bir kuralla
    yapiliyor: manifest'te en az bir tip=='zam' kaydi bulunmali ve TUM zam
    kayitlari ya uretildi ya gerekceli atlandi olmali (bu, asagidaki genel
    'taninmayan durum' ve 'atlandi ama sebep bos' kurallariyla zaten
    saglaniyor -- ayrica bir kod yolu gerekmiyor)."""
    with open(app_js_yolu, encoding="utf-8") as f:
        metin = f.read()
    beklenen = []
    for kod in app_js_market_kodlari(metin):
        beklenen.append(f"/market/{slug(kod)}/")
    for kat_slug in app_js_kategori_sluglari(metin):
        beklenen.append(f"/kategori/{kat_slug}/")
    beklenen.append("/hal/")
    return beklenen


W3C_DATETIME_DESENI = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)


def w3c_datetime_mi(deger):
    return isinstance(deger, str) and bool(W3C_DATETIME_DESENI.match(deger))


def _meta_oku(html, isim):
    eslesme = re.search(r'<meta\s+name="%s"\s+content="([^"]*)"' % re.escape(isim), html)
    return eslesme.group(1) if eslesme else None


def hub_kontrolu(hub_dir, app_js_yolu=None, simdi=None):
    """--hub kipinin cekirdegi.

    hub_dir: denetlenecek dizin -- uretim .hub/ ya da yayina giden dist/ ile
    AYNI SEKLE sahip olmali: <hub_dir>/manifest.json + her manifest kaydinin
    yolu icin <hub_dir><yol>index.html.

    app_js_yolu/simdi TEST ICIN enjekte edilebilir: testte gercek app.js
    yerine kucuk bir sahte dosya, gercek 'simdi' yerine sabit bir zaman
    kullanilir -- testin gercek saatle ya da gercek MARKET_NAMES/KATEGORILER
    uzunluguyla yarismamasi icin. --hub CLI kipi ikisini de varsayilana
    (gercek app.js, datetime.now()) birakir."""
    if app_js_yolu is None:
        app_js_yolu = os.path.join(_BASE_DIR, "app.js")
    if simdi is None:
        simdi = datetime.now(timezone.utc)

    print(f"Hub tazelik kontrolu - dizin: {hub_dir}")
    print("-" * 64)

    manifest_yolu = os.path.join(hub_dir, "manifest.json")
    if not os.path.exists(manifest_yolu):
        print(f"HUB HATASI: manifest bulunamadi: {manifest_yolu}")
        return 1
    with open(manifest_yolu, encoding="utf-8") as f:
        manifest = json.load(f)
    if not isinstance(manifest, list):
        print("HUB HATASI: manifest.json bir dizi (liste) olmali.")
        return 1

    ihlaller = []
    zam_kayit_var = False

    for kayit in manifest:
        yol = kayit.get("yol", "?")
        tip = kayit.get("tip", "?")
        durum = kayit.get("durum", "?")
        if tip == "zam":
            zam_kayit_var = True

        dosya_yolu = os.path.join(hub_dir, str(yol).strip("/"), "index.html")
        dosya_var = os.path.exists(dosya_yolu)

        if durum not in ("uretildi", "atlandi"):
            print(f"  {yol:24s}  durum={durum!r}  TANINMAYAN DURUM")
            ihlaller.append(f"{yol}: taninmayan durum {durum!r}")
            continue

        if durum == "atlandi":
            sebep = (kayit.get("sebep") or "").strip()
            if not sebep:
                print(f"  {yol:24s}  atlandi   SEBEP BOS")
                ihlaller.append(f"{yol}: durum=atlandi ama sebep bos")
            if dosya_var:
                print(f"  {yol:24s}  atlandi   ama DOSYA DISKTE VAR ({dosya_yolu})")
                ihlaller.append(f"{yol}: durum=atlandi ama dosya diskte var")
            if sebep and not dosya_var:
                print(f"  {yol:24s}  atlandi   OK")
            continue

        # durum == "uretildi"
        if not dosya_var:
            print(f"  {yol:24s}  uretildi  DOSYA YOK ({dosya_yolu})")
            ihlaller.append(f"{yol}: durum=uretildi ama dosya yok: {dosya_yolu}")
            continue

        with open(dosya_yolu, encoding="utf-8") as f:
            html = f.read()

        damga = _meta_oku(html, "pazar-veri-damgasi")
        if damga is None:
            print(f"  {yol:24s}  uretildi  DAMGA YOK")
            ihlaller.append(f"{yol}: pazar-veri-damgasi meta'si yok")
        elif not w3c_datetime_mi(damga):
            print(f"  {yol:24s}  uretildi  DAMGA BOZUK ({damga})")
            ihlaller.append(f"{yol}: damga W3C Datetime degil: {damga!r}")
        else:
            damga_zamani = datetime.fromisoformat(damga)
            yas_gun = (simdi - damga_zamani).total_seconds() / 86400.0
            esik = ESIK_GUN_HAL if yol == "/hal/" else ESIK_GUN
            durum_metni = "BAYAT" if yas_gun > esik else "taze"
            print(f"  {yol:24s}  uretildi  damga {yas_gun:5.1f} gun (esik {esik})  {durum_metni}")
            if yas_gun > esik:
                ihlaller.append(f"{yol}: damga {yas_gun:.1f} gun eski (esik {esik} gun)")

        satir_meta = _meta_oku(html, "pazar-satir")
        satir_manifest = kayit.get("satir")
        if satir_meta is None:
            ihlaller.append(f"{yol}: pazar-satir meta'si yok")
        else:
            try:
                satir_meta_sayi = int(satir_meta)
            except ValueError:
                satir_meta_sayi = None
            if satir_meta_sayi != satir_manifest:
                ihlaller.append(
                    f"{yol}: pazar-satir meta ({satir_meta}) manifest satir ({satir_manifest}) ile uyusmuyor"
                )

    print("-" * 64)

    # ── turetilmis beklenen kume: manifeste korukorune guvenme ─────────
    manifest_yollari = {kayit.get("yol") for kayit in manifest}
    beklenen = turetilmis_beklenen_sayfalar(app_js_yolu)
    print(f"Turetilmis beklenen sayfa sayisi (app.js'ten, zam haric): {len(beklenen)}")
    for beklenen_yol in beklenen:
        if beklenen_yol not in manifest_yollari:
            print(f"  {beklenen_yol:24s}  MANIFESTTE HIC GORUNMUYOR")
            ihlaller.append(f"{beklenen_yol}: turetilmis beklenen sayfa manifestte hic gorunmuyor")

    if not zam_kayit_var:
        print("  /zam/*                    MANIFESTTE HIC ZAM KAYDI YOK")
        ihlaller.append("manifest'te tip=='zam' olan hicbir kayit yok")

    print("-" * 64)

    if not ihlaller:
        print(f"TAZELIK OK: {len(manifest)} manifest kaydi, {len(beklenen)} turetilmis beklenti, 0 ihlal.")
        return 0

    print(f"HUB HATASI: {len(ihlaller)} ihlal.")
    for ihlal in ihlaller:
        print(f"  - {ihlal}")
    return 1


if __name__ == "__main__":
    if "--hub" in sys.argv:
        _idx = sys.argv.index("--hub")
        if _idx + 1 >= len(sys.argv):
            print("KULLANIM: python veri_tazelik_kontrol.py --hub <dizin>")
            sys.exit(1)
        sys.exit(hub_kontrolu(sys.argv[_idx + 1]))
    else:
        sys.exit(main())
