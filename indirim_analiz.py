"""
Sahte indirim supheli puan hesaplama.
urunler.fiyat_gecmisi uzerinden 4 sinyal ile supheli-indirim puani hesaplar,
sonucu urunler tablosuna geri yazar. Sessiz altyapi - henuz UI'da gosterilmiyor.
Ayni CI job icinde, sync_db.py'dan HEMEN SONRA calisir (guncel fiyat_gecmisi lazim).
"""
import json
import os
import sys
import time
import requests
from datetime import datetime, timedelta, timezone

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

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
BATCH_SIZE = 500
GUN_LIMIT = 90
VOLATILITE_ESIK = 0.12
DONGU_TOLERANS = 0.05


# ── SINYAL HESAPLAMA ────────────────────────────────────

def zirve_suresi_ve_dusus(gecmis):
    """onceki_fiyat, onceki_tarih'ten itibaren gecerliydi (degisiklikte kaydedildigi icin).
    son_tarih'te degistigine gore suresi tam olarak son_tarih - onceki_tarih."""
    if not gecmis or len(gecmis) < 2:
        return None, None
    son_tarih, son_fiyat = gecmis[-1]
    onceki_tarih, onceki_fiyat = gecmis[-2]
    if son_fiyat is None or onceki_fiyat is None or onceki_fiyat <= 0:
        return None, None
    if son_fiyat >= onceki_fiyat:
        return None, None
    dusus_yuzde = ((onceki_fiyat - son_fiyat) / onceki_fiyat) * 100
    try:
        d1 = datetime.strptime(onceki_tarih, "%Y-%m-%d")
        d2 = datetime.strptime(son_tarih, "%Y-%m-%d")
        zirve_suresi_gun = (d2 - d1).days
    except Exception:
        zirve_suresi_gun = None
    return zirve_suresi_gun, dusus_yuzde


def fiyat_volatilitesi(gecmis, gun_limit=GUN_LIMIT):
    """Son N gundeki kayitli fiyatlarin degisim katsayisi (std/ortalama)."""
    if not gecmis or len(gecmis) < 3:
        return None
    limit_tarih = (datetime.now() - timedelta(days=gun_limit)).strftime("%Y-%m-%d")
    fiyatlar = [f for t, f in gecmis if t >= limit_tarih and f is not None]
    if len(fiyatlar) < 3:
        return None
    ortalama = sum(fiyatlar) / len(fiyatlar)
    if ortalama <= 0:
        return None
    varyans = sum((f - ortalama) ** 2 for f in fiyatlar) / len(fiyatlar)
    return (varyans ** 0.5) / ortalama


def zirve_donguleri(gecmis, gun_limit=GUN_LIMIT, tolerans=DONGU_TOLERANS):
    """Son N gunde fiyatin dusup, onceki zirveye (tolerans dahilinde) kac kere
    geri dondugunu sayar. 2+ dongu = tekrarli pompa-indirim deseni."""
    if not gecmis or len(gecmis) < 3:
        return 0
    limit_tarih = (datetime.now() - timedelta(days=gun_limit)).strftime("%Y-%m-%d")
    seri = [(t, f) for t, f in gecmis if t >= limit_tarih and f is not None]
    if len(seri) < 3:
        return 0
    donguler = 0
    zirve = seri[0][1]
    dustu_mu = False
    for _, f in seri[1:]:
        if f < zirve * 0.97:
            dustu_mu = True
        elif dustu_mu and f >= zirve * (1 - tolerans):
            donguler += 1
            dustu_mu = False
        if f > zirve:
            zirve = f
    return donguler


def indirim_supheli_puan_hesapla(gecmis_raw):
    """4 sinyal: kisa zirve suresi, yuksek oynaklik, tekrarli dongu, asiri indirim orani.
    Su an aktif bir dusus yoksa (fiyat artti/degismedi/veri yetersiz) None doner."""
    gecmis = sorted(
        [g for g in (gecmis_raw or []) if g and len(g) == 2 and g[0] and g[1] is not None],
        key=lambda g: g[0],
    )
    zirve_suresi, dusus_yuzde = zirve_suresi_ve_dusus(gecmis)
    if dusus_yuzde is None:
        return None

    puan = 0
    sebepler = []

    if zirve_suresi is not None:
        if zirve_suresi <= 2:
            puan += 2
            sebepler.append("kisa_zirve")
        elif zirve_suresi <= 6:
            puan += 1
            sebepler.append("orta_zirve")

    volatilite = fiyat_volatilitesi(gecmis)
    if volatilite is not None and volatilite >= VOLATILITE_ESIK:
        puan += 1
        sebepler.append("yuksek_oynaklik")

    donguler = zirve_donguleri(gecmis)
    if donguler >= 2:
        puan += 2
        sebepler.append("tekrarli_dongu")
    elif donguler == 1:
        puan += 1
        sebepler.append("tek_dongu")

    if dusus_yuzde >= 50:
        puan += 1
        sebepler.append("asiri_yuksek_oran")

    return {"puan": puan, "sebepler": sebepler, "dusus_yuzde": round(dusus_yuzde)}


# ── DB OKUMA / YAZMA ────────────────────────────────────

def db_urunleri_getir():
    tum_urunler = []
    offset = 0
    limit = 1000
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/urunler"
               f"?select=_sid,en_dusuk_fiyat,fiyat_gecmisi&limit={limit}&offset={offset}")
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"DB okuma HATA: {r.status_code} {r.text[:300]}")
            break
        batch = r.json()
        if not batch:
            break
        tum_urunler.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return tum_urunler


def sonuclari_yaz(satirlar):
    url = f"{SUPABASE_URL}/rest/v1/rpc/indirim_puan_toplu_guncelle"
    basarili = 0
    hata = 0
    for i in range(0, len(satirlar), BATCH_SIZE):
        batch = satirlar[i:i + BATCH_SIZE]
        r = requests.post(url, headers=HEADERS, json={"guncellemeler": batch}, timeout=30)
        if r.status_code not in (200, 201, 204):
            print(f"RPC HATA batch {i}: {r.status_code} {r.text[:300]}")
            hata += 1
        else:
            basarili += len(batch)
        time.sleep(0.2)
    return basarili, hata


def main():
    urunler = db_urunleri_getir()
    print(f"DB'den okunan urun: {len(urunler)}")

    satirlar = []
    supheli_sayisi = 0
    dikkat_sayisi = 0
    for u in urunler:
        sid = u.get("_sid")
        if not sid:
            continue
        sonuc = indirim_supheli_puan_hesapla(u.get("fiyat_gecmisi"))
        if sonuc is None:
            satirlar.append({
                "_sid": sid,
                "indirim_supheli_puan": None,
                "indirim_supheli_sebepler": None,
                "indirim_supheli_dusus_yuzde": None,
            })
        else:
            if sonuc["puan"] >= 4:
                supheli_sayisi += 1
            elif sonuc["puan"] >= 2:
                dikkat_sayisi += 1
            satirlar.append({
                "_sid": sid,
                "indirim_supheli_puan": sonuc["puan"],
                "indirim_supheli_sebepler": sonuc["sebepler"],
                "indirim_supheli_dusus_yuzde": sonuc["dusus_yuzde"],
            })

    print(f"Aktif dusus olan urun: {sum(1 for s in satirlar if s['indirim_supheli_puan'] is not None)}")
    print(f"  Supheli (puan>=4): {supheli_sayisi}")
    print(f"  Dikkat (puan 2-3): {dikkat_sayisi}")

    basarili, hata = sonuclari_yaz(satirlar)
    print(f"Yazildi: {basarili}/{len(satirlar)} basarili, {hata} hatali batch")

    # BASARI DAMGASI. Bu adim workflow'da continue-on-error: true ile kosuyor —
    # veri akisini kesmemesi icin dogru, ama basarisiz olunca is YESIL geciyordu
    # ve "Bu indirimlere dikkat" seridi ESKI puanlarla uretiliyordu (2026-08-11
    # denetim bulgusu). Damga yazilmazsa veri_tazelik_kontrol.py bunu yakalayip
    # isi kirmiziya cevirir. Yalnizca GERCEKTEN yazma yapildiysa damgalaniyor.
    if basarili > 0:
        damga = os.path.join(_BASE_DIR, "data", "indirim_analiz_son.json")
        with open(damga, "w", encoding="utf-8") as f:
            json.dump({
                "tarih": datetime.now(timezone.utc).isoformat(),
                "urun": len(satirlar),
                "basarili_batch": basarili,
                "hatali_batch": hata,
                "supheli": supheli_sayisi,
                "dikkat": dikkat_sayisi,
            }, f, ensure_ascii=False, indent=1)
        print("Damga yazildi: data/indirim_analiz_son.json")
    else:
        print("[KRITIK] Hicbir batch yazilamadi — damga YAZILMADI, "
              "tazelik kontrolu bunu yakalayip isi kirmiziya cevirecek.")

    print("\nINDIRIM ANALIZI TAMAMLANDI.")


if __name__ == "__main__":
    main()