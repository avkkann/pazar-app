import sys, json, time, glob, requests
sys.path.insert(0, '.')
from scraper import _make_sid

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Connection": "close",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}

API = "https://api.marketfiyati.org.tr/api/v2/searchByCategories"

KATEGORILER = ["Meyve ve Sebze", "Et, Tavuk ve Balık",
               "Süt Ürünleri ve Kahvaltılık", "Temel Gıda",
               "İçecek", "Temizlik ve Kişisel Bakım",
               "Atıştırmalık ve Tatlı"]

print("=== BRAND TOPLAMA ===")
all_brands = {}
for cat in KATEGORILER:
    try:
        r = requests.post(API, json={"menuCategory": True, "keywords": cat, "pages":0, "size":25}, headers=HEADERS, timeout=15, verify=False)
        fm = r.json().get("facetMap", {})
        for b in fm.get("brand", []):
            name = b.get("name", "").strip()
            cnt = b.get("count", 0)
            if name and name not in ("Markasız", "Markasz"):
                all_brands[name] = max(all_brands.get(name, 0), cnt)
        print(f"  {cat}: {len(fm.get('brand', []))} brand")
        time.sleep(0.5)
    except Exception as e:
        print(f"  {cat}: ERR {e}")

top_brands = sorted(all_brands.items(), key=lambda x: -x[1])[:100]
print(f"\n=== TOPLAM {len(all_brands)} brand, top 100 ile arama ===")
for b, c in top_brands[:10]:
    print(f"  TOP: {b} ({c})")

def load_sids():
    sids = set()
    for f in glob.glob('data/*.json'):
        if 'gecmis' in f or 'hal' in f: continue
        try:
            d = json.load(open(f, encoding='utf-8'))
            vals = d.values() if isinstance(d, dict) else d
            for v in vals:
                if isinstance(v, dict) and v.get('_sid'):
                    sids.add(v['_sid'])
        except: pass
    return sids

bilinen = load_sids()
print(f"\nbilinen_sids: {len(bilinen)}")

mf_path = "data/marketfiyati.json"
try:
    mf_mevcut = json.load(open(mf_path, encoding='utf-8'))
except:
    mf_mevcut = []

MARKET_MAP = {
    "A101":"a101","BİM":"bim","Migros":"migros","CarrefourSA":"carrefour",
    "ŞOK":"sok","Hakmar":"hakmar","Tarım Kredi":"tarim_kredi",
    "a101":"a101","bim":"bim","migros":"migros","carrefour":"carrefour",
    "sok":"sok","hakmar":"hakmar","tarim_kredi":"tarim_kredi",
}

PAZAR_KAT_MAP = {
    "Meyve ve Sebze":"meyve", "Et, Tavuk ve Balık":"et",
    "Süt Ürünleri ve Kahvaltılık":"sut", "Temel Gıda":"gida",
    "İçecek":"icecek", "Temizlik ve Kişisel Bakım":"temizlik",
    "Atıştırmalık ve Tatlı":"atistirmalik",
}

def doniseur(it):
    mf_arr = []
    for d in (it.get("productDepotInfoList") or []):
        m_raw = d.get("marketAdi", "")
        mf_arr.append({
            "market": MARKET_MAP.get(m_raw, m_raw.lower()),
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
    sid = _make_sid(marka, ad, gramaj)
    fiyatlar = [m["fiyat"] for m in mf_arr if m.get("fiyat") is not None]
    return {
        "_sid": sid, "ad": ad, "marka": marka, "gramaj": gramaj,
        "kategori": PAZAR_KAT_MAP.get(it.get("menu_category"), "diger"),
        "main_category_mf": it.get("main_category"),
        "menu_category_mf": it.get("menu_category"),
        "market_fiyatlari": mf_arr,
        "en_dusuk_fiyat": min(fiyatlar) if fiyatlar else None,
        "resim": None, "kaynak": "marketfiyati", "mf_id": it.get("id"),
    }

t_start = time.time()
HARD_TIMEOUT = 720
yeni_eklenen = {}
ham_total = skip_bilinen = skip_dup = 0

for brand, max_cnt in top_brands:
    if time.time() - t_start > HARD_TIMEOUT:
        print(f"\nTIMEOUT ({HARD_TIMEOUT}s) - duruldu"); break
    if len(yeni_eklenen) >= 2000:
        print("2000 yeni - duruldu"); break
    brand_yeni = 0
    for p in range(6):
        try:
            r = requests.post(API, json={"menuCategory": True, "keywords": brand, "pages":p, "size":25}, headers=HEADERS, timeout=15, verify=False)
            items = r.json().get("content", []) or []
        except Exception as e:
            print(f"  {brand} p{p}: ERR {e}"); break
        if not items: break
        ham_total += len(items)
        sayfa_yeni = 0
        for it in items:
            prod = doniseur(it)
            if not prod["_sid"]: continue
            if prod["_sid"] in bilinen:
                skip_bilinen += 1; continue
            if prod["_sid"] in yeni_eklenen:
                skip_dup += 1; continue
            yeni_eklenen[prod["_sid"]] = prod
            sayfa_yeni += 1
            brand_yeni += 1
        time.sleep(0.5)
        if sayfa_yeni == 0: break
    if brand_yeni > 0:
        print(f"  {brand}: +{brand_yeni}  (toplam: {len(yeni_eklenen)})")

mf_final = mf_mevcut + list(yeni_eklenen.values())
json.dump(mf_final, open(mf_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

import os
print(f"\n=== ÖZET ===")
print(f"ham: {ham_total} | bilinen skip: {skip_bilinen} | dup skip: {skip_dup}")
print(f"yeni eklenen: {len(yeni_eklenen)}")
print(f"data/marketfiyati.json final: {len(mf_final)} ürün, {os.path.getsize(mf_path)/1024:.0f} KB")
print(f"süre: {time.time()-t_start:.0f}s")

from collections import Counter
kat_dag = Counter(p["kategori"] for p in yeni_eklenen.values())
print(f"\nyeni eklenenler kategori dağılımı:")
for k, c in kat_dag.most_common():
    print(f"  {k}: {c}")
