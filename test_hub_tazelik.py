# -*- coding: utf-8 -*-
"""--hub kipi testi (Gorev 6).

Bu, .hub/manifest.json'un yayina gitmeden ONCE denetlendigi kapinin
testidir: sessizce bayat/eksik/tutarsiz bir hub sayfasi yayina cikamasin
diye kurulan sert kontrolun kendisi test edilmeden yayina cikmaz.

scripts/veri_tazelik_kontrol.py'yi test_tazelik.py'deki AYNI desenle
dogrudan importlib ile import eder -- kopya mantik YOK. Her senaryo kendi
gecici dizinine sahte bir 'dist/' + manifest.json + kucuk bir sahte app.js
kurar; hub_kontrolu() dogrudan cagrilir (CLI'ye gerek yok), stdout
contextlib.redirect_stdout ile yakalanir.

Esikler (ESIK_GUN, ESIK_GUN_HAL) ve beklenen sayfa kumesi TURETME
fonksiyonlari (turetilmis_beklenen_sayfalar) modulden import edilir --
testte sabit sayi (16/19 gibi) YAZILMAZ; son test bunu app.js'e yeni bir
market ekleyip turetilmis kumenin kendiliginden buyudugunu göstererek
kanitlar.

Kullanim: py test_hub_tazelik.py
"""
import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

spec = importlib.util.spec_from_file_location(
    "tk", os.path.join(_BASE, "scripts", "veri_tazelik_kontrol.py"))
tk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tk)

gecti = basarisiz = 0


def ok(ad, kosul, detay=""):
    global gecti, basarisiz
    if kosul:
        gecti += 1
        print("  PASS  " + ad)
    else:
        basarisiz += 1
        print("  FAIL  " + ad + ("  -> " + str(detay) if detay else ""))


# ── sahte app.js: gercek app.js'teki MARKET_NAMES/KATEGORILER bicimini
# birebir taklit eder (turetme fonksiyonlari regex ile bu bicime bagli).
# Kucuk tutuluyor: 2 market + 2 kategori + /hal/ = 5 beklenen sayfa. ──────
SAHTE_APP_JS = """const MARKET_NAMES = {
  a101:'A101', bim:'BİM'
};
const KATEGORILER = [
  { slug:'et', label:'Et', emoji:'x', img:'x', file:'x' },
  { slug:'sut', label:'Süt', emoji:'x', img:'x', file:'x' },
];
"""


def damga_yaz(zaman):
    return zaman.strftime("%Y-%m-%dT%H:%M:%S+03:00")


def sayfa_html(damga, tip, satir):
    return (
        "<!doctype html><html><head>"
        f'<meta name="pazar-veri-damgasi" content="{damga}">'
        f'<meta name="pazar-hub-tipi" content="{tip}">'
        f'<meta name="pazar-satir" content="{satir}">'
        "</head><body>test</body></html>"
    )


def _kayit(yol, tip, durum, satir=20, sebep="", veri_damgasi=None):
    return {
        "yol": yol, "tip": tip, "durum": durum, "sebep": sebep,
        "satir": satir, "kelime": 400,
        "son_veri": None, "veri_damgasi": veri_damgasi,
        "atlanan_bolumler": [],
    }


def dist_kur(tmp, simdi):
    """Saglam bir sahte dist/ + manifest.json + app.js kurar (5 uretilen
    sayfa + 1 gerekceli atlanan zam kaydi). Doner: (dist_dizini, app_js_yolu,
    manifest_yolu)."""
    dist = os.path.join(tmp, "dist")
    os.makedirs(dist, exist_ok=True)
    app_js_yolu = os.path.join(tmp, "app.js")
    with open(app_js_yolu, "w", encoding="utf-8") as f:
        f.write(SAHTE_APP_JS)

    damga = damga_yaz(simdi - timedelta(hours=1))
    manifest = []
    for yol, tip in [
        ("/market/a101/", "market"), ("/market/bim/", "market"),
        ("/kategori/et/", "kategori"), ("/kategori/sut/", "kategori"),
        ("/hal/", "hal"),
    ]:
        manifest.append(_kayit(yol, tip, "uretildi", satir=20, veri_damgasi=damga))
        hedef = os.path.join(dist, yol.strip("/"))
        os.makedirs(hedef, exist_ok=True)
        with open(os.path.join(hedef, "index.html"), "w", encoding="utf-8") as f:
            f.write(sayfa_html(damga, tip, 20))
    manifest.append(_kayit("/zam/2026-06/", "zam", "atlandi", satir=0,
                            sebep="ay oncesinde yeterli gecmis yok"))

    manifest_yolu = os.path.join(dist, "manifest.json")
    with open(manifest_yolu, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return dist, app_js_yolu, manifest_yolu


def manifest_yaz(manifest_yolu, donusturucu):
    with open(manifest_yolu, encoding="utf-8") as f:
        m = json.load(f)
    donusturucu(m)
    with open(manifest_yolu, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)


def calistir(dist, app_js_yolu, simdi, manifest_yolu=None):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        kod = tk.hub_kontrolu(dist, app_js_yolu=app_js_yolu, simdi=simdi, manifest_yolu=manifest_yolu)
    return kod, buf.getvalue()


def kurulum_ayri(tmp, simdi):
    """--manifest testleri icin: manifest ve sayfalar AYRI iki dizinde
    kurulur -- 'kaynak' .hub'i, 'hedef' dist'i taklit eder. dist_kur()'un
    aksine, gercek build zincirinde prepare-public.mjs'in yaptigi 'sayfalari
    .hub'dan dist'e kopyala' adimini burada ACIKCA taklit ediyoruz: her
    sayfa HER IKI dizine de yaziliyor, manifest.json SADECE kaynakta (aynen
    .hub/manifest.json'un dist'e kopyalanmamasi gibi).

    Doner: (kaynak, hedef, app_js_yolu, manifest_yolu) -- manifest_yolu
    kaynak icindeki dosyanin TAM yolu."""
    kaynak = os.path.join(tmp, "kaynak")
    hedef = os.path.join(tmp, "hedef")
    os.makedirs(kaynak, exist_ok=True)
    os.makedirs(hedef, exist_ok=True)
    app_js_yolu = os.path.join(tmp, "app.js")
    with open(app_js_yolu, "w", encoding="utf-8") as f:
        f.write(SAHTE_APP_JS)

    damga = damga_yaz(simdi - timedelta(hours=1))
    manifest = []
    for yol, tip in [
        ("/market/a101/", "market"), ("/market/bim/", "market"),
        ("/kategori/et/", "kategori"), ("/kategori/sut/", "kategori"),
        ("/hal/", "hal"),
    ]:
        manifest.append(_kayit(yol, tip, "uretildi", satir=20, veri_damgasi=damga))
        for taban in (kaynak, hedef):
            hedef_dizin = os.path.join(taban, yol.strip("/"))
            os.makedirs(hedef_dizin, exist_ok=True)
            with open(os.path.join(hedef_dizin, "index.html"), "w", encoding="utf-8") as f:
                f.write(sayfa_html(damga, tip, 20))
    manifest.append(_kayit("/zam/2026-06/", "zam", "atlandi", satir=0,
                            sebep="ay oncesinde yeterli gecmis yok"))

    manifest_yolu = os.path.join(kaynak, "manifest.json")
    with open(manifest_yolu, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return kaynak, hedef, app_js_yolu, manifest_yolu


SIMDI = datetime.now(timezone.utc)


print("\n=== 1. SAGLAM KURULUM ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("saglam kurulum -> exit 0", kod == 0, cikti[-500:])
    ok("  'TAZELIK OK' ciktida", "TAZELIK OK" in cikti, cikti[-200:])


print("\n=== 2. URETILDI KAYDIN DOSYASI YOK ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    os.remove(os.path.join(dist, "market", "a101", "index.html"))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("dosyasi olmayan uretildi kaydi -> exit 1", kod == 1, kod)
    ok("  eksik sayfanin adi ciktida", "/market/a101/" in cikti, cikti[-600:])


print("\n=== 3. TURETILMIS BEKLENEN SAYFA MANIFESTTE HIC YOK ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, manifest_yolu = dist_kur(tmp, SIMDI)
    manifest_yaz(manifest_yolu, lambda m: [m.remove(k) for k in list(m) if k["yol"] == "/kategori/sut/"])
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("beklenen sayfa manifestte hic gorunmuyorsa -> exit 1", kod == 1, kod)
    ok("  'MANIFESTTE HIC GORUNMUYOR' ciktida", "manifestte hic gorunmuyor" in cikti, cikti[-800:])
    ok("  eksik yolun adi ciktida", "/kategori/sut/" in cikti, cikti[-800:])


print("\n=== 4. ATLANDI + SEBEP ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("atlandi + sebep dolu -> exit 0 (saglam kurulumun parcasi)", kod == 0, kod)

with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, manifest_yolu = dist_kur(tmp, SIMDI)
    manifest_yaz(manifest_yolu, lambda m: [k.update(sebep="") for k in m if k["tip"] == "zam"])
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("atlandi + sebep bos -> exit 1", kod == 1, kod)
    ok("  'sebep bos' ciktida", "sebep bos" in cikti, cikti[-600:])


print("\n=== 5. TANINMAYAN DURUM ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, manifest_yolu = dist_kur(tmp, SIMDI)
    manifest_yaz(manifest_yolu, lambda m: m[0].update(durum="beklemede"))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("taninmayan durum -> exit 1", kod == 1, kod)
    ok("  'TANINMAYAN DURUM' ciktida", "TANINMAYAN DURUM" in cikti, cikti[-600:])


print("\n=== 6. DAMGA YOK / BOZUK ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "market", "a101", "index.html")
    with open(hedef, "w", encoding="utf-8") as f:
        f.write('<!doctype html><html><head>'
                '<meta name="pazar-hub-tipi" content="market">'
                '<meta name="pazar-satir" content="20">'
                '</head><body>x</body></html>')
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("damga meta'si hic yoksa -> exit 1", kod == 1, kod)
    ok("  'DAMGA YOK' ciktida", "DAMGA YOK" in cikti, cikti[-600:])

with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "market", "a101", "index.html")
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html("yarin-ogleden-sonra", "market", 20))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("damga W3C Datetime biciminde degilse -> exit 1", kod == 1, kod)
    ok("  'DAMGA BOZUK' ciktida", "DAMGA BOZUK" in cikti, cikti[-600:])


print("\n=== 7. DAMGA YASI (ESIK_GUN'DEN IMPORT EDILEREK) ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "market", "a101", "index.html")
    eski = damga_yaz(SIMDI - timedelta(days=tk.ESIK_GUN + 1))
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html(eski, "market", 20))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok(f"damga ESIK_GUN({tk.ESIK_GUN})+1 gun eski -> exit 1", kod == 1, kod)

with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "market", "a101", "index.html")
    taze = damga_yaz(SIMDI - timedelta(days=1))
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html(taze, "market", 20))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok(f"damga 1 gun eski (ESIK_GUN={tk.ESIK_GUN} altinda) -> exit 0", kod == 0, cikti[-500:])


print("\n=== 8. /hal/ GEVSEK ESIK (ESIK_GUN_HAL) ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "hal", "index.html")
    damga3 = damga_yaz(SIMDI - timedelta(days=3))
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html(damga3, "hal", 20))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok(f"/hal/ 3 gun eski, ESIK_GUN({tk.ESIK_GUN}) asilir ama ESIK_GUN_HAL({tk.ESIK_GUN_HAL}) asilmaz -> exit 0",
       kod == 0, cikti[-500:])

with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "hal", "index.html")
    damga6 = damga_yaz(SIMDI - timedelta(days=6))
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html(damga6, "hal", 20))
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok(f"/hal/ 6 gun eski, ESIK_GUN_HAL({tk.ESIK_GUN_HAL}) da asilir -> exit 1", kod == 1, kod)


print("\n=== 9. pazar-satir META MANIFESTTEKI satir ILE UYUSMALI ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    hedef = os.path.join(dist, "market", "a101", "index.html")
    damga = damga_yaz(SIMDI - timedelta(hours=1))
    with open(hedef, "w", encoding="utf-8") as f:
        f.write(sayfa_html(damga, "market", 999))  # manifestteki 20'den farkli
    kod, cikti = calistir(dist, app_js_yolu, SIMDI)
    ok("pazar-satir meta manifestteki satir'dan farkliysa -> exit 1", kod == 1, kod)
    ok("  'uyusmuyor' ciktida", "uyusmuyor" in cikti, cikti[-700:])


print("\n=== 10. BEKLENEN KUME TURETILIYOR (sabit sayi YOK) ===")
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)

    genisletilmis_app_js = SAHTE_APP_JS.replace(
        "const MARKET_NAMES = {\n  a101:'A101', bim:'BİM'\n};",
        "const MARKET_NAMES = {\n  a101:'A101', bim:'BİM', yenimarket:'YeniMarket'\n};",
    )
    assert genisletilmis_app_js != SAHTE_APP_JS, "replace hicbir sey degistirmedi (sablon kaydi)"
    genis_app_js_yolu = os.path.join(tmp, "app_genis.js")
    with open(genis_app_js_yolu, "w", encoding="utf-8") as f:
        f.write(genisletilmis_app_js)

    eski_beklenen = tk.turetilmis_beklenen_sayfalar(app_js_yolu)
    yeni_beklenen = tk.turetilmis_beklenen_sayfalar(genis_app_js_yolu)
    ok("app.js'e market eklenince turetilmis kume kendiliginden 1 buyuyor",
       len(yeni_beklenen) == len(eski_beklenen) + 1,
       (len(eski_beklenen), len(yeni_beklenen)))
    ok("  yeni marketin yolu turetilmis kumede", "/market/yenimarket/" in yeni_beklenen, yeni_beklenen)

    # dist GUNCELLENMEDI (yeni marketin sayfasi hala yok) -- genisletilmis
    # app.js ile calistirinca bu artik EKSIK bir sayfa olarak yakalanmali.
    kod, cikti = calistir(dist, genis_app_js_yolu, SIMDI)
    ok("genisletilmis app.js ile calistirinca yeni marketin sayfasi eksik -> exit 1",
       kod == 1, kod)
    ok("  /market/yenimarket/ eksikligi ciktida", "/market/yenimarket/" in cikti, cikti[-800:])


print("\n=== 11. --manifest VERILMEDIGINDE ESKI DAVRANIS AYNEN KORUNUYOR ===")
# Gorev 7: --manifest opsiyonel. Verilmezse manifest, denetlenen dizinin
# (hub_dir) icinden okunmaya devam etmeli -- bugune kadarki tek dizin
# kurulumu (dist_kur()) hic degismemis gibi calismali.
with tempfile.TemporaryDirectory() as tmp:
    dist, app_js_yolu, _ = dist_kur(tmp, SIMDI)
    kod_manifestsiz, cikti_manifestsiz = calistir(dist, app_js_yolu, SIMDI)
    kod_acik, cikti_acik = calistir(
        dist, app_js_yolu, SIMDI, manifest_yolu=os.path.join(dist, "manifest.json"))
    ok("manifest_yolu verilmeden -> exit 0 (eski davranis)", kod_manifestsiz == 0, cikti_manifestsiz[-400:])
    ok("  ayni sonuc: manifest_yolu=<hub_dir>/manifest.json ACIKCA verilince de exit 0",
       kod_acik == 0, cikti_acik[-400:])
    ok("  ikisinin exit kodu ayni", kod_manifestsiz == kod_acik, (kod_manifestsiz, kod_acik))


print("\n=== 12. --manifest VERILDIGINDE: KAYIT BASKA DIZINDEN, SAYFALAR DENETLENENDEN ===")
# .hub/manifest.json (kaynak) + dist/ (hedef, sayfalarin gercek yayin
# konumu) ayri dizinlerde, ikisi de SAGLAM -- isim cakismasinin cozumu:
# manifest kaynaktan okunuyor, sayfalarin kendisi hedeften.
with tempfile.TemporaryDirectory() as tmp:
    kaynak, hedef, app_js_yolu, manifest_yolu = kurulum_ayri(tmp, SIMDI)
    kod, cikti = calistir(hedef, app_js_yolu, SIMDI, manifest_yolu=manifest_yolu)
    ok("manifest kaynakta, sayfalar hedefte, ikisi de saglam -> exit 0", kod == 0, cikti[-500:])
    ok("  'TAZELIK OK' ciktida", "TAZELIK OK" in cikti, cikti[-200:])
    ok("  ciktida kullanilan manifest yolu goruluyor", manifest_yolu in cikti, cikti[:400])


print("\n=== 13. KOPYA KAYBI SENARYOSU (asil kazanc: eski --hub .hub kurulumunun KACIRDIGI hata) ===")
# Manifest 'uretildi' diyor, kaynakta (.hub taklidi) sayfa VAR, ama
# denetlenen dizinde (dist taklidi) YOK -- prepare-public.mjs'in bir
# sayfayi kopyalamayi ATLADIGI durumu taklit eder. Eski kurulum
# ('--hub .hub', yani hem manifest hem sayfalar .hub'dan okunurdu) bu
# hatayi hic GOREMEZDI cunku .hub'daki sayfa oradaydi -- kontrol dist'e HIC
# BAKMAZDI. Bu, Gorev 7'nin asil kazandigi kapsam.
with tempfile.TemporaryDirectory() as tmp:
    kaynak, hedef, app_js_yolu, manifest_yolu = kurulum_ayri(tmp, SIMDI)
    # hedeften (dist taklidi) SADECE a101 sayfasini sil -- kaynakta (.hub
    # taklidi) YERINDE KALSIN.
    import shutil as _shutil
    _shutil.rmtree(os.path.join(hedef, "market", "a101"))
    ok("  on kosul: kaynakta a101 sayfasi hala var",
       os.path.exists(os.path.join(kaynak, "market", "a101", "index.html")), "")

    kod, cikti = calistir(hedef, app_js_yolu, SIMDI, manifest_yolu=manifest_yolu)
    ok("kopya kaybi (dist'te yok, .hub'da var) --hub dist --manifest ile -> exit 1",
       kod == 1, kod)
    ok("  eksik sayfanin dist yolu ciktida", "/market/a101/" in cikti, cikti[-800:])

    # ESKI KURULUMUN KORLUGUNUN KANITI: manifest de sayfalar da AYNI dizinden
    # (kaynak = .hub taklidi) okunsaydi -- yani eski '--hub .hub' davranisi --
    # bu kayip hic yakalanmazdi, cunku denetlenen dizinin kendisi (kaynak)
    # saglam.
    kod_eski_tarz, cikti_eski_tarz = calistir(kaynak, app_js_yolu, SIMDI)
    ok("  KANIT: ayni bozuk durumda eski tarz (--hub .hub, sayfalar VE manifest ayni dizinden) -> exit 0 (KACIRIR)",
       kod_eski_tarz == 0, cikti_eski_tarz[-500:])


print("\n=== 14. KOPYA BOZULMASI SENARYOSU (dist'teki sayfa bozuk, .hub'daki saglam) ===")
# Kaynaktaki (.hub) sayfa saglam ve taze, ama hedefteki (dist) kopyanin
# pazar-veri-damgasi meta'si BOZUK/ESKI -- kopyalama sirasinda bozulma
# (yarim yazma, eski surumden kalma dosya, vb.) taklidi. Kaynak saglam
# olmasi kontrolun hedefe (gercekten yayina giden dosyaya) baktigini
# kanitliyor -- kaynaga bakan bir kontrol bunu KACIRIRDI.
with tempfile.TemporaryDirectory() as tmp:
    kaynak, hedef, app_js_yolu, manifest_yolu = kurulum_ayri(tmp, SIMDI)
    hedef_sayfa = os.path.join(hedef, "market", "a101", "index.html")
    with open(hedef_sayfa, "w", encoding="utf-8") as f:
        f.write(sayfa_html("gecersiz-tarih-bicimi", "market", 20))

    kod, cikti = calistir(hedef, app_js_yolu, SIMDI, manifest_yolu=manifest_yolu)
    ok("dist'teki kopya bozuk damga tasiyor (.hub'daki saglam olsa bile) -> exit 1", kod == 1, kod)
    ok("  'DAMGA BOZUK' ciktida", "DAMGA BOZUK" in cikti, cikti[-800:])

    # KANIT: kaynagin (.hub) kendisi hala saglam -- yalnizca hedef (dist)
    # bozuldu.
    kod_kaynak, cikti_kaynak = calistir(kaynak, app_js_yolu, SIMDI)
    ok("  KANIT: kaynak (.hub) kendi basina hala saglam -> exit 0",
       kod_kaynak == 0, cikti_kaynak[-500:])


print("\n=== 15. WORKFLOW: deploy.yml hub kapisi ===")
# Gorev 7: hub sayfalari artik build zincirine giriyor ve deploy.yml,
# wrangler'dan ONCE bu betigi --hub kipinde calistiriyor. Ayni desen
# test_tazelik.py'nin "5. WORKFLOW" bolumunde: workflow YAML'i metin
# olarak okunur, adimlarin GORECELI SIRASI index() ile dogrulanir.
wf_yolu = os.path.join(_BASE, ".github", "workflows", "deploy.yml")
wf = open(wf_yolu, encoding="utf-8").read()

ok("deploy.yml --hub kontrolunu iceriyor",
   "veri_tazelik_kontrol.py" in wf and "--hub" in wf, "")
ok("  kontrol artik --hub dist kullaniyor (.hub DEGIL -- yayina giden denetlenmeli)",
   "--hub dist" in wf, "")
ok("  kontrol --manifest .hub/manifest.json ile kaydi ayri veriyor",
   "--manifest .hub/manifest.json" in wf, "")
ok("  kontrol 'npm run build'den SONRA geliyor",
   wf.index("npm run build") < wf.index("--hub"), "")
ok("  kontrol wrangler-action'dan ONCE geliyor",
   wf.index("--hub") < wf.index("wrangler-action"), "")

# continue-on-error YOK: bu kapinin TEK amaci isi kirmizi yapip deploy'u
# durdurmak. Genel bir "dosyada hic gecmiyor" kontrolu yetmez -- adimi
# "- name: ...Tazelik Kontrolu" basligindan bir sonraki "- name:"/"- uses:"a
# kadar dilimleyip SADECE o blokta ariyoruz. YAML DIREKTIFI araniyor
# ("continue-on-error:", ikinokta ile) -- yoksa adim ustundeki aciklayici
# yorum satirlari ("... continue-on-error YOK ...") kendi kendini FAIL ettirir.
_hub_adim_basi = wf.index("Hub Sayfalari Tazelik Kontrolu")
_sonraki_adim = wf.find("\n      - ", _hub_adim_basi)
_hub_adim_blogu = wf[_hub_adim_basi:_sonraki_adim if _sonraki_adim != -1 else len(wf)]
ok("  kontrol ADIMINDA continue-on-error YOK",
   "continue-on-error:" not in _hub_adim_blogu, _hub_adim_blogu)

ok("setup-python var", "setup-python" in wf, "")

print("\n=== 16. package.json BUILD ZINCIRI SIRASI ===")
pkg = open(os.path.join(_BASE, "package.json"), encoding="utf-8").read()
ok("build zincirinde hub-uret.mjs var", "hub-uret.mjs" in pkg, "")
ok("  hub-uret.mjs, anasayfa-uret.mjs'ten SONRA",
   pkg.index("anasayfa-uret.mjs") < pkg.index("hub-uret.mjs"), "")
ok("  hub-uret.mjs, prepare-public.mjs'ten ONCE",
   pkg.index("hub-uret.mjs") < pkg.index("prepare-public.mjs"), "")


print("\n%d gecti, %d basarisiz" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
