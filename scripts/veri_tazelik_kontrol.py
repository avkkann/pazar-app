#!/usr/bin/env python3
"""
Veri tazelik kontrolu.

data/urunler_*.json dosyalarinin her birinin SON COMMIT tarihine bakar; herhangi
biri ESIK_GUN'den eskiyse net bir mesajla exit 1 verir.

Amaci hattı GORUNUR sekilde kirmiziya cevirmektir: 2026-07 sonunda
marketfiyati.org.tr "Temizlik ve Kişisel Bakım" kategorisini ikiye bolunce
scraper o dosyayi 12 gun boyunca hic yazmadi ama is yesil gecti ve kimse fark
etmedi. Bu kontrol o sessizligi bir daha mumkun kilmaz.

NOT: git gecmisi gerektirir. CI'da actions/checkout varsayilan olarak
--depth=1 (shallow) ceker; bu yuzden update-data.yml'da fetch-depth: 0 ayarli
olmalidir, yoksa HEAD'de degismeyen dosyalar icin commit gecmisi bulunamaz.
"""
import glob
import os
import subprocess
import sys
from datetime import datetime, timezone

ESIK_GUN = 2

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


def main():
    dosyalar = sorted(glob.glob(os.path.join(DATA_DIR, "urunler_*.json")))
    if not dosyalar:
        print("TAZELIK HATASI: data/urunler_*.json hic bulunamadi.")
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
        durum = "BAYAT" if yas > ESIK_GUN else "taze"
        print(f"  {ad:32s}  {zaman.date()}  {yas:5.1f} gun  {durum}")
        if yas > ESIK_GUN:
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


if __name__ == "__main__":
    sys.exit(main())
