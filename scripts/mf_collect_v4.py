import sys, json, glob, time, requests, os
from collections import Counter
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, '.')
from scraper import _make_sid, HEADERS

SESSION = requests.Session()
retry = Retry(total=5, backoff_factor=1.5, status_forcelist=[500,502,503,504], allowed_methods=["POST"])
SESSION.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10))

API = "https://api.marketfiyati.org.tr/api/v2/searchByCategories"
HARD_TIMEOUT = 1500
MAX_PAGES_PER_CAT = 200
HEDEF_YENI = 3000

SLUG_KISA = {
    "meyve-ve-sebze": "meyve",
    "et-tavuk-balik": "et",
    "sut-urunleri-ve-kahvaltilik": "sut",
    "temel-gida": "gida",
    "icecek": "icecek",
    "temizlik-ve-kisisel-bakim": "temizlik",
    "atistirmalik-ve-tatli": "atistirmalik",
}
CATEGORIES = [
    ("meyve-ve-sebze", "Meyve ve Sebze"),
    ("et-tavuk-balik", "Et, Tavuk ve Balık"),
    ("sut-urunleri-ve-kahvaltilik", "Süt Ürünleri ve Kahvaltılık"),
    ("temel-gida", "Temel Gıda"),
    ("icecek", "İçecek"),
    ("temizlik-ve-kisisel-bakim", "Temizlik ve Kişisel Bakım"),
    ("atistirmalik-ve-tatli", "Atıştırmalık ve Tatlı"),
]

def load_bilinen_sids():
    sids = set()
    for f in glob.glob('data/*.json'):
        try:
            d = json.load(open(f, encoding='utf-8'))
            vals = d if isinstance(d, list) else (d.values() if isinstance(d, dict) else [])
            for v in vals:
                if isinstance(v, dict) and v.get('_sid'):
                    sids.add(v['_sid'])
        except Exception:
            pass
    return sids

def doniseur(it, slug_kisa):
    mf = []
    for d in (it.get("productDepotInfoList") or []):
        mf.append({
            "market": d.get("marketAdi"),
            "fiyat": d.get("price"),
            "birim_fiyat": d.get("unitPrice"),
            "birim_fiyat_val": d.get("unitPriceValue"),
            "depo": d.get("depotName"),
            "depo_id": d.get("depotId"),
            "lat": d.get("latitude"),
            "lng": d.get("longitude"),
            "indirim": d.get("discount"),
            "indirim_oran": d.get("discountRatio"),
            "promosyon": d.get("promotionText"),
        })
    ad = it.get("title","")
    marka = it.get("brand","")
    gramaj = it.get("refinedVolumeOrWeight","")
    sid = _make_sid(slug_kisa, ad)
    fiyatlar = [m["fiyat"] for m in mf if m.get("fiyat") is not None]
    return {
        "_sid": sid,
        "ad": ad, "marka": marka, "gramaj": gramaj,
        "kategori": slug_kisa,
        "main_category_mf": it.get("main_category"),
        "menu_category_mf": it.get("menu_category"),
        "market_fiyatlari": mf,
        "en_dusuk_fiyat": min(fiyatlar) if fiyatlar else None,
        "resim": None,
        "kaynak": "marketfiyati",
        "mf_id": it.get("id"),
    }

# ============== API CAP TESTI ==============
print("=== API SIZE CAP TESTI (Meyve ve Sebze) ===")
cap = 25
for s in [25, 50, 100, 200]:
    try:
        r = SESSION.post(API, json={"menuCategory": True, "keywords": "Meyve ve Sebze", "pages": 0, "size": s},
                          headers=HEADERS, timeout=15, verify=False)
        n = len(r.json().get("content") or [])
        print(f"  size_req={s:3} -> dondu={n}")
        if n > 0:
            cap = max(cap, n)
    except Exception as e:
        print(f"  size_req={s}: ERR {e}")
print(f"  -> kullanilacak cap: {cap}\n")

# ============== ANA AKIŞ ==============
bilinen = load_bilinen_sids()
print(f"bilinen_sids: {len(bilinen)}")
secilenler = {}
ham_count = skip_bilinen = skip_dup = 0
start = time.time()
timeout_oldu = False

for slug, cat_name in CATEGORIES:
    slug_kisa = SLUG_KISA.get(slug, "urun")
    hata_sayac = 0
    for page in range(MAX_PAGES_PER_CAT):
        if time.time() - start > HARD_TIMEOUT:
            timeout_oldu = True
            break
        if len(secilenler) >= HEDEF_YENI:
            print(f"  [HEDEF] {HEDEF_YENI} yeni urune ulasildi, duruluyor.")
            timeout_oldu = True
            break
        try:
            payload = {"menuCategory": True, "keywords": cat_name, "pages": page, "size": cap}
            r = SESSION.post(API, json=payload, headers=HEADERS, timeout=15, verify=False)
            r.raise_for_status()
            items = (r.json().get("content") or [])
            hata_sayac = 0
        except Exception as e:
            hata_sayac += 1
            print(f"  {cat_name} p{page}: ERR {e} (ardisik hata: {hata_sayac})")
            if hata_sayac >= 3:
                print(f"  {cat_name}: 3 ardisik hata, kategoriden cikiliyor")
                break
            time.sleep(5)
            continue
        if not items:
            print(f"  {cat_name} p{page}: ham=0 (kategori bitti)"); break
        ham_count += len(items)
        page_yeni = 0
        for it in items:
            prod = doniseur(it, slug_kisa)
            if not prod["_sid"]: continue
            if prod["_sid"] in bilinen:
                skip_bilinen += 1; continue
            if prod["_sid"] in secilenler:
                skip_dup += 1; continue
            secilenler[prod["_sid"]] = prod
            page_yeni += 1
        print(f"  {cat_name} p{page}: ham={len(items)} yeni={page_yeni} toplam={len(secilenler)} | t={time.time()-start:.0f}s")
        time.sleep(0.4)
    if timeout_oldu:
        print(f"  [TIMEOUT] {HARD_TIMEOUT}s asildi, duruluyor.")
        break

elapsed = time.time() - start

# ============== JSON KAYDI ==============
out_path = os.path.join("data", "marketfiyati.json")
liste = list(secilenler.values())
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(liste, f, ensure_ascii=False, indent=2)
size_kb = os.path.getsize(out_path) / 1024

# ============== RAPOR ==============
print("\n=== ÖZET ===")
print(f"API cap: {cap}")
print(f"hedef: {HEDEF_YENI} | ulasildi: {'EVET' if len(secilenler) >= HEDEF_YENI else 'HAYIR'}")
print(f"ham: {ham_count} | bilinen skip: {skip_bilinen} | dup skip: {skip_dup} | final yeni: {len(secilenler)} | sure: {elapsed:.1f}s | timeout: {timeout_oldu}")
print(f"dosya: {out_path} | boyut: {size_kb:.1f} KB")

kat_dag = Counter(p["kategori"] for p in secilenler.values())
print("\nkategori dağılımı (gercek):")
for k, c in kat_dag.most_common():
    print(f"  {k:18}: {c}")

marka_dag = Counter(p["marka"] for p in secilenler.values() if p.get("marka"))
print("\nen cok urun gelen 10 marka:")
for m, c in marka_dag.most_common(10):
    print(f"  {m[:25]:25}: {c}")