import json
MAP = {
    "a101": "A101",
    "bim": "BİM",
    "migros": "Migros",
    "carrefour": "CarrefourSA",
    "sok": "ŞOK",
    "tarim_kredi": "Tarım Kredi",
}
path = "data/marketfiyati.json"
data = json.load(open(path, encoding="utf-8"))
degisen = 0
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        m = f.get("market")
        if m in MAP:
            f["market"] = MAP[m]
            degisen += 1
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"degisen alan: {degisen}")
markets_after = set()
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        markets_after.add(f.get("market"))
print(f"sonraki market_seti: {sorted(markets_after)}")
