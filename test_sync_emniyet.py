# -*- coding: utf-8 -*-
"""sync_db.py silme emniyeti.

NEDEN VAR: silme geri donusu olmayan tek adim. Denetimde (2026-09-08)
kategori dosyasi eksik gelirse o kategorinin TUM urunlerinin veritabanindan
silindigi bulundu -- dosya okunamayinca sadece "UYARI ... atlaniyor" yazip
devam ediyordu. Bu test iki kapinin da GERCEKTEN kapandigini kanitlar.

Kapilar kaynaktan degil DAVRANISTAN olculur: main() sahte verilerle
calistirilir ve silme fonksiyonunun cagrilip cagrilmadigina bakilir.
"""
import json
import os
import sys
import tempfile
import importlib.util

GECTI = 0
KALDI = 0


def ok(ad, kosul, ipucu=""):
    global GECTI, KALDI
    if kosul:
        GECTI += 1
        print(f"  PASS  {ad}")
    else:
        KALDI += 1
        print(f"  FAIL  {ad}  -> {ipucu}")


def modul_yukle():
    yol = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_db.py")
    spec = importlib.util.spec_from_file_location("sync_db_test", yol)
    m = importlib.util.module_from_spec(spec)
    # Modul yuklenirken ag/ortam degiskeni istemesin diye sahte degerler
    os.environ.setdefault("SUPABASE_URL", "https://ornek.test")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "sahte")
    spec.loader.exec_module(m)
    return m


def kos(m, dosyalar, db_sidleri):
    """main()'i sahte veriyle calistirir. (silindi_mi, cikis_kodu) doner."""
    izler = {"silindi": False, "silinen_sayi": 0}

    m.kategori_urunlerini_yukle = lambda: dosyalar
    m.satirlara_donustur = lambda urunler: [{"_sid": u["_sid"]} for u in urunler]
    m.upsert = lambda satirlar: (len(satirlar), 0)
    m.db_sidlerini_getir = lambda: set(db_sidleri)

    def sahte_sil(silinecekler):
        izler["silindi"] = True
        izler["silinen_sayi"] = len(list(silinecekler))
        return izler["silinen_sayi"]

    m.eskileri_sil = sahte_sil

    kod = 0
    try:
        m.main()
    except SystemExit as e:
        kod = e.code if isinstance(e.code, int) else 1
    return izler, kod


def main():
    m = modul_yukle()
    U = lambda sid: {"_sid": sid}

    print("\n=== 1. KONTROL GRUBU: her sey yolundayken silme CALISMALI ===")
    # DB'de 100 satir, dosyalarda 99'u var -> 1 silinecek (yuzde 1, tavan alti)
    dosyalar = ([U(f"u{i}") for i in range(99)], [])
    izler, kod = kos(m, dosyalar, [f"u{i}" for i in range(100)])
    ok("normal kosuda silme CALISIYOR (arac kor degil)", izler["silindi"],
       "silme hic cagrilmadi -- test bir sey olcmuyor demektir")
    ok("  silinen sayisi 1", izler["silinen_sayi"] == 1, str(izler["silinen_sayi"]))
    ok("  cikis kodu 0", kod == 0, str(kod))

    print("\n=== 2. KAPI 1: kategori dosyasi eksikse HIC silinmemeli ===")
    dosyalar = ([U(f"u{i}") for i in range(50)], ["urunler_gida"])
    izler, kod = kos(m, dosyalar, [f"u{i}" for i in range(100)])
    ok("eksik dosya varken silme YAPILMIYOR", not izler["silindi"],
       "50 urun silinecekti")
    ok("  is kirmizi doniyor (cikis kodu 0 degil)", kod != 0, str(kod))

    print("\n=== 3. KAPI 2: tavani asan silme durdurulmali ===")
    # DB'de 1000, dosyada 900 -> 100 silinecek = yuzde 10 > tavan yuzde 5
    dosyalar = ([U(f"u{i}") for i in range(900)], [])
    izler, kod = kos(m, dosyalar, [f"u{i}" for i in range(1000)])
    ok("tavani asan silme YAPILMIYOR", not izler["silindi"], "100 satir silinecekti")
    ok("  is kirmizi doniyor", kod != 0, str(kod))

    print("\n=== 4. SINIR: tavanin hemen ALTINDA silme calismali ===")
    # DB'de 1000, dosyada 960 -> 40 silinecek = yuzde 4 < tavan yuzde 5
    dosyalar = ([U(f"u{i}") for i in range(960)], [])
    izler, kod = kos(m, dosyalar, [f"u{i}" for i in range(1000)])
    ok("tavan altindaki silme CALISIYOR (kapi fazla siki degil)", izler["silindi"],
       "mesru temizlik de engelleniyor")
    ok("  silinen sayisi 40", izler["silinen_sayi"] == 40, str(izler["silinen_sayi"]))

    print("\n=== 5. YUKLEYICI: bos/bozuk dosya EKSIK sayilmali ===")
    # kos() yukleyiciyi taklitle degistiriyor; GERCEGINI olcmek icin modulu
    # tazeden yukle. (Bu satir olmadan asagisi taklidi olcuyordu.)
    m = modul_yukle()
    with tempfile.TemporaryDirectory() as td:
        eski = os.getcwd()
        try:
            os.makedirs(os.path.join(td, "data"))
            for i, ad in enumerate(m.KATEGORI_DOSYALARI):
                p = os.path.join(td, "data", ad + ".json")
                with open(p, "w", encoding="utf-8") as f:
                    if i == 0:
                        f.write("[]")          # bos
                    elif i == 1:
                        f.write("{bozuk json")  # ayristirilamaz
                    else:
                        json.dump([{"_sid": f"k{i}"}], f)
            os.chdir(td)
            urunler, eksikler = m.kategori_urunlerini_yukle()
        finally:
            os.chdir(eski)
    ok("bos dosya eksik sayiliyor", m.KATEGORI_DOSYALARI[0] in eksikler, str(eksikler))
    ok("bozuk json eksik sayiliyor", m.KATEGORI_DOSYALARI[1] in eksikler, str(eksikler))
    ok("saglam dosyalar okunuyor", len(urunler) == len(m.KATEGORI_DOSYALARI) - 2,
       str(len(urunler)))

    print(f"\nPASS={GECTI}  FAIL={KALDI}")
    sys.exit(1 if KALDI else 0)


if __name__ == "__main__":
    main()
