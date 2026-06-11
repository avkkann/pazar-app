import json
MAP = {
    # büyük harfli → mevcut katalog (küçük + underscore)
    "A101": "a101",
    "BİM": "bim",
    "Migros": "migros",
    "CarrefourSA": "carrefour",
    "ŞOK": "sok",
    "Hakmar": "hakmar",
    "Tarım Kredi": "tarim_kredi",
    # MF'in orijinal slug'larını da yakala (zaten doğruysa no-op):
    "a101": "a101", "bim": "bim", "migros": "migros",
    "carrefour": "carrefour", "sok": "sok",
    "hakmar": "hakmar", "tarim_kredi": "tarim_kredi",
}
path = "data/marketfiyati.json"
data = json.load(open(path, encoding="utf-8"))
degisen = 0
unknown = set()
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        m = f.get("market")
        if m in MAP:
            if f["market"] != MAP[m]:
                f["market"] = MAP[m]
                degisen += 1
        else:
            unknown.add(m)
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"degisen: {degisen}")
if unknown:
    print(f"BILINMEYEN market'lar: {unknown}  -> MAP'e ekle!")

# Doğrulama:
after = set()
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        after.add(f.get("market"))
print(f"sonuc market_seti: {sorted(after)}")
