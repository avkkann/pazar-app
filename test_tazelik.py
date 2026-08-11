# -*- coding: utf-8 -*-
"""Veri tazelik kontrolu testi.

NEDEN anasayfa.json da kontrol ediliyor: ana sayfanin DORT seridi artik
tamamen ona bagli. Gece kosusu kirilirsa kategori dosyalari bayatlar ve
kontrol kirmizi doner, ama anasayfa.json kendi basina uretilen bir dosya —
onun bayatligi ayri bir arizadir ve gorunmesi gerekir.

scripts/veri_tazelik_kontrol.py'yi dogrudan import eder, kopya mantik degil.
Kullanim: py test_tazelik.py
"""
import importlib.util
import os
import subprocess
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


print("\n=== 1. KONTROL EDILEN DOSYALAR ===")
izlenen = tk.izlenen_dosyalar()
adlar = sorted(os.path.basename(p) for p in izlenen)
ok("kategori dosyalari izleniyor",
   len([a for a in adlar if a.startswith("urunler_")]) >= 8, adlar)
ok("anasayfa.json izleniyor", "anasayfa.json" in adlar, adlar)
ok("hal.json izlenmiyor (ayri kaynak, ayri ritim)", "hal.json" not in adlar, adlar)
ok("il_marketler.json izlenmiyor (HAFTALIK is)", "il_marketler.json" not in adlar, adlar)

print("\n=== 2. ESIK KATEGORIYLE AYNI ===")
ok("ESIK_GUN = 2", tk.ESIK_GUN == 2, tk.ESIK_GUN)

print("\n=== 3. BAYATLIK KARARI ===")
simdi = datetime.now(timezone.utc)
ok("esikten yeni -> taze", not tk.bayat_mi(simdi - timedelta(days=1), simdi))
ok("esikten eski -> BAYAT", tk.bayat_mi(simdi - timedelta(days=3), simdi))
ok("tam esikte -> taze (sinir dahil)", not tk.bayat_mi(simdi - timedelta(days=2), simdi))
ok("zaman None -> BAYAT (gecmis bulunamadi)", tk.bayat_mi(None, simdi))

print("\n=== 4. GERCEK DEPODA KOSUYOR ===")
r = subprocess.run([sys.executable, os.path.join(_BASE, "scripts", "veri_tazelik_kontrol.py")],
                   cwd=_BASE, capture_output=True, text=True, timeout=180)
cikti = r.stdout + r.stderr
ok("betik cokmeden kosuyor", r.returncode in (0, 1), r.returncode)
ok("anasayfa.json ciktida gorunuyor", "anasayfa.json" in cikti, cikti[-400:])
ok("esik satiri basiliyor", "esik: 2 gun" in cikti, cikti[:200])
ok("bayat varsa exit 1, yoksa exit 0 tutarli",
   (r.returncode == 1) == ("TAZELIK HATASI" in cikti), r.returncode)

print("\n=== 5. WORKFLOW: anasayfa.json COMMIT EDILIYOR ===")
# anasayfa.json yalnizca build'de uretilseydi repoya hic islenmezdi ve
# git tabanli kontrol 2 gunde YANLIS ALARM verirdi. Bu yuzden uretim
# "Veri Guncelle" isine de eklendi ve commit ediliyor.
wf = open(os.path.join(_BASE, ".github", "workflows", "update-data.yml"),
          encoding="utf-8").read()
ok("update-data.yml anasayfa uretiyor", "anasayfa-uret.mjs" in wf, "")
ok("  node kurulumu var", "setup-node" in wf, "")
ok("  uretim SAHTE INDIRIM ANALIZI'nden SONRA",
   wf.index("anasayfa-uret.mjs") > wf.index("indirim_analiz.py"), "")
ok("  uretimden SONRA commit ediliyor",
   wf.rindex("git add") > wf.index("anasayfa-uret.mjs"), "")
ok("  tazelik kontrolu EN SONDA",
   wf.index("veri_tazelik_kontrol.py") > wf.index("anasayfa-uret.mjs"), "")

print("\n%d gecti, %d basarisiz" % (gecti, basarisiz))
sys.exit(1 if basarisiz else 0)
