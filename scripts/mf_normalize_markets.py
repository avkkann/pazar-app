import json
import sys

path = "data/marketfiyati.json"
data = json.load(open(path, encoding="utf-8"))

# Keşif: mevcut 6 dosyada market adlari {a101, bim, carrefour, migros, sok, tarim_kredi}
# marketfiyati.json'da da AYNI 6 market var — MAP gerekmiyor, sadece dogrulama.
MAP = {}

degisen_market = 0
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        m = f.get("market")
        if m in MAP:
            f["market"] = MAP[m]
            degisen_market += 1

# CLAUDE.md SEMA KORUMA: cardHTML/openDetay/ustKategori/placeholderRenk/halEsles
# u.ana_kategori alanini kullaniyor. marketfiyati.json'da yok — main_category_mf'den turetilmeli.
# Yoksa "ana_kategori degerleri ustKategori()'de eslenir. Bu sema bozulursa index.html komple patlar."
eklenen_ana = 0
for prod in data:
    if "ana_kategori" not in prod or not prod.get("ana_kategori"):
        ana = prod.get("main_category_mf") or prod.get("menu_category_mf") or prod.get("kategori", "Diger")
        prod["ana_kategori"] = ana
        eklenen_ana += 1

json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"market normalize: {degisen_market} alan degisti (MAP bos, zaten uyumluydu)")
print(f"ana_kategori eklendi: {eklenen_ana} urun")

# Dogrulama
markets_after = set()
for prod in data:
    for f in prod.get("market_fiyatlari", []):
        markets_after.add(f.get("market"))
print(f"sonraki market_seti ({len(markets_after)}): {sorted(markets_after)}")

ana_eksik = [p for p in data if not p.get("ana_kategori")]
print(f"ana_kategori eksik urun sayisi: {len(ana_eksik)}")
