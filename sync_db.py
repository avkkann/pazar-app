"""
Gecelik DB senkronizasyonu: scraper.py'nin urettigi kategori JSON dosyalarini
Supabase 'urunler' tablosuna yansitir. Ayni CI job icinde, scraper'dan hemen
sonra, ayni checkout uzerinde calisir (internetten tekrar indirme yapmaz).
Ayrica artik hicbir kategori dosyasinda gecmeyen urunleri DB'den siler.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

SUPABASE_URL = "https://gbgxxahhbfnulmyecxia.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    print("HATA: SUPABASE_SERVICE_ROLE_KEY ortam degiskeni ayarli degil.")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}
UPSERT_HEADERS = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}

BATCH_SIZE = 500

# Her kosuda bir kez uretilir; tum satirlar ayni damgayi tasir. DB'de bu deger
# "bu urun en son ne zaman senkronlandi" sorusunu cevaplar - hattin 3 hafta
# sessiz kalabilmesinin sebebi boyle bir damganin hic olmamasiydi.
SENKRON_ZAMANI = datetime.now(timezone.utc).isoformat()

KATEGORI_DOSYALARI = [
    "urunler_meyve", "urunler_et", "urunler_sut", "urunler_gida",
    "urunler_icecek", "urunler_temizlik", "urunler_atistirmalik", "urunler_dondurulmus",
]


def kategori_urunlerini_yukle():
    """(urunler, eksik_dosyalar) doner.

    ESKIDEN eksik dosya sessizce atlaniyordu ve main dogrudan silmeye
    geciyordu: bir kategori dosyasi okunamazsa o kategorinin TUM urunleri
    "artik gecerli degil" sayilip veritabanindan siliniyordu, geri donusu
    olmadan. Artik eksikler cagirana bildiriliyor ki silme iptal edilebilsin.
    Bos dosya da eksik sayilir -- 0 urun, dosyanin yarim yazildigi anlamina
    gelir ve ayni toptan silmeyi tetikler.
    """
    tum_urunler = []
    eksikler = []
    for dosya in KATEGORI_DOSYALARI:
        path = f"data/{dosya}.json"
        if not os.path.exists(path):
            print(f"UYARI: {path} bulunamadi")
            eksikler.append(dosya)
            continue
        try:
            with open(path, encoding="utf-8") as f:
                urunler = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"UYARI: {path} okunamadi: {e}")
            eksikler.append(dosya)
            continue
        if not urunler:
            print(f"UYARI: {path} BOS (0 urun)")
            eksikler.append(dosya)
            continue
        tum_urunler.extend(urunler)
    return tum_urunler, eksikler


def satirlara_donustur(urunler):
    satirlar = {}
    for u in urunler:
        sid = u.get("_sid")
        if not sid:
            continue
        satirlar[sid] = {
            "_sid": sid,
            "ad": u.get("ad", ""),
            "ana_kategori": u.get("ana_kategori"),
            "agirlik_hacim": u.get("agirlik_hacim"),
            "resim": u.get("resim"),
            "en_dusuk_fiyat": u.get("en_dusuk_fiyat"),
            "market_fiyatlari": u.get("market_fiyatlari") or [],
            "fiyat_gecmisi": u.get("fiyat_gecmisi") or [],
            "agirlik_hacim_gecmisi": u.get("agirlik_hacim_gecmisi") or [],
            "ilan_indirim_gecmisi": u.get("ilan_indirim_gecmisi") or [],
            "son_senkron": SENKRON_ZAMANI,
        }
    return list(satirlar.values())


def upsert(satirlar):
    url = f"{SUPABASE_URL}/rest/v1/urunler?on_conflict=_sid"
    basarili = 0
    hata = 0
    for i in range(0, len(satirlar), BATCH_SIZE):
        batch = satirlar[i:i + BATCH_SIZE]
        r = requests.post(url, headers=UPSERT_HEADERS, json=batch, timeout=30)
        if r.status_code not in (200, 201, 204):
            print(f"UPSERT HATA batch {i}: {r.status_code} {r.text[:300]}")
            hata += 1
        else:
            basarili += len(batch)
        time.sleep(0.2)
    return basarili, hata


def db_sidlerini_getir():
    tum_sidler = []
    offset = 0
    limit = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/urunler?select=_sid&limit={limit}&offset={offset}"
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"DB sid okuma HATA: {r.status_code} {r.text[:300]}")
            break
        batch = r.json()
        if not batch:
            break
        tum_sidler.extend(row["_sid"] for row in batch)
        if len(batch) < limit:
            break
        offset += limit
    return set(tum_sidler)


def eskileri_sil(silinecekler):
    silinecekler = list(silinecekler)
    silinen = 0
    for i in range(0, len(silinecekler), 100):
        chunk = silinecekler[i:i + 100]
        sid_list = ",".join(f'"{s}"' for s in chunk)
        url = f'{SUPABASE_URL}/rest/v1/urunler?_sid=in.({sid_list})'
        r = requests.delete(url, headers=HEADERS, timeout=30)
        if r.status_code not in (200, 204):
            print(f"SILME HATA chunk {i}: {r.status_code} {r.text[:300]}")
        else:
            silinen += len(chunk)
        time.sleep(0.2)
    return silinen


# Silme icin emniyet tabani: bir kosuda DB'nin bu oranindan fazlasi
# silinecekse durur ve insan onayi bekler. Gercek gunluk devir cok
# kucuk (yuzde birin altinda); yuzde 5 bol bir tavan, yani ancak
# gercekten bir sey bozulunca devreye girer.
SILME_TAVAN_ORANI = 0.05


def main():
    urunler, eksik_dosyalar = kategori_urunlerini_yukle()
    print(f"Kategori dosyalarindan okunan ham urun: {len(urunler)}")

    satirlar = satirlara_donustur(urunler)
    print(f"Tekil _sid sayisi: {len(satirlar)}")

    basarili, hata = upsert(satirlar)
    print(f"Upsert: {basarili}/{len(satirlar)} basarili, {hata} hatali batch")

    gecerli_sidler = set(row["_sid"] for row in satirlar)
    db_sidleri = db_sidlerini_getir()
    print(f"DB'deki toplam satir: {len(db_sidleri)}")

    silinecekler = db_sidleri - gecerli_sidler

    # ── SILME EMNIYETI ───────────────────────────────────────────────
    # Silme geri donusu olmayan tek adim; onunde iki kapi var.
    # KAPI 1: kategori dosyalarindan biri bile eksik/bozuk/bos ise HIC silme.
    # O dosyanin urunleri gecerli listede olmadigi icin hepsi "eski" gorunur
    # ve toptan silinirdi. Upsert zaten yapildi, yani veri guncel; sadece
    # temizlik atlaniyor ve is kirmizi doniyor.
    if eksik_dosyalar:
        print(f"\nSILME IPTAL: {len(eksik_dosyalar)} kategori dosyasi eksik/bozuk: "
              f"{', '.join(eksik_dosyalar)}")
        print("Upsert tamamlandi, temizlik atlandi. Dosyalar duzelince tekrar kos.")
        sys.exit(1)

    # KAPI 2: silinecek miktar DB'nin belirlenen oranini asiyorsa durdur.
    # Normal gunluk devir yuzde birin cok altinda; tavani asmasi "veri
    # tarafinda bir sey bozuldu" demektir, "bugun cok urun kalkti" demek degil.
    if db_sidleri and len(silinecekler) > len(db_sidleri) * SILME_TAVAN_ORANI:
        oran = len(silinecekler) / len(db_sidleri) * 100
        print(f"\nSILME IPTAL: {len(silinecekler)} satir silinecekti "
              f"(DB'nin yuzde {oran:.1f}'i, tavan yuzde {SILME_TAVAN_ORANI * 100:.0f}).")
        print("Bu kadar buyuk bir dusus normal degil. Veriyi kontrol edip elle onayla.")
        sys.exit(1)

    if silinecekler:
        print(f"Artik gecerli olmayan {len(silinecekler)} urun DB'den silinecek")
        silinen = eskileri_sil(silinecekler)
        print(f"Silinen: {silinen}")
    else:
        print("Silinecek eski urun yok.")

    print("\nDB SYNC TAMAMLANDI.")


if __name__ == "__main__":
    main()
