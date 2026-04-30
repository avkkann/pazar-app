"""
urunler.json birim normalizasyonu.
Her urune ekler:
  - birim_norm   : 'AGIRLIK' | 'ADET' | 'BILINMIYOR'
  - miktar_gram  : float | None  (KG→*1000, GR→as-is)
  - fiyat_per_kg : float | None  (sadece AGIRLIK urunlerde)
  - birim_etiketi: gosterim metni, ornek '1 Kg', '350 Gr', '1 Adet'
Urunler ayni JSON dosyasinin uzerine yazilir, yedek urunler_raw.json'a alinir.
"""
import json, re, shutil

SRC = "urunler.json"
BAK = "urunler_raw.json"

# ---- Yardimci Fonksiyonlar ----

def parse_agirlik(text):
    """'350 GR' -> (350.0, 'GR')  |  '1 KG' -> (1.0, 'KG')  |  None -> None"""
    if not text:
        return None, None
    m = re.search(r'([\d]+(?:[.,]\d+)?)\s*(KG|GR|LT|ML|CL)\b', text.upper())
    if not m:
        return None, None
    val = float(m.group(1).replace(',', '.'))
    unit = m.group(2)
    return val, unit


def to_gram(val, unit):
    """Gramaja cevirir. LT/ML/CL icin de yaklas."""
    if unit in ('KG',):   return val * 1000
    if unit in ('GR',):   return val
    if unit in ('LT',):   return val * 1000  # ml cinsinden
    if unit in ('ML',):   return val
    if unit in ('CL',):   return val * 10
    return None


def normalize_urun(u):
    """Tek urunu normalize eder, yeni alanlar ekler."""
    ad = u.get('ad', '')
    agirlik_str = u.get('agirlik_hacim') or ''

    # --- Birimi belirle ---
    val, unit = parse_agirlik(agirlik_str)

    # agirlik_hacim bos ise urun adinda ara
    if val is None:
        val, unit = parse_agirlik(ad)

    # "Adet" kontrolu - ad veya agirlik_hacim icerisinde
    ad_upper = ad.upper()
    is_adet = (
        'ADET' in ad_upper
        or 'ADET' in agirlik_str.upper()
        or re.search(r'\b\d+\s*ADET\b', ad_upper) is not None
        or (val is None and unit is None)  # hicbir agirlik birimi bulunamadi
    )

    if is_adet and val is None:
        # "1 Adet" gibi ifadeleri yakala
        m = re.search(r'(\d+)\s*[Aa]det', ad)
        adet_val = float(m.group(1)) if m else 1.0
        u['birim_norm'] = 'ADET'
        u['miktar_gram'] = None
        u['adet_miktar'] = adet_val
        u['birim_etiketi'] = f'{int(adet_val)} Adet' if adet_val == int(adet_val) else f'{adet_val} Adet'
    elif val is not None and unit in ('KG', 'GR', 'LT', 'ML', 'CL'):
        gram = to_gram(val, unit)
        u['birim_norm'] = 'AGIRLIK'
        u['miktar_gram'] = gram

        # Gosterim birimi
        if unit == 'KG':
            u['birim_etiketi'] = f'{val:g} Kg'
        elif unit == 'GR':
            u['birim_etiketi'] = f'{int(val)} Gr'
        elif unit == 'LT':
            u['birim_etiketi'] = f'{val:g} Lt'
        elif unit == 'ML':
            u['birim_etiketi'] = f'{int(val)} ml'
        else:
            u['birim_etiketi'] = f'{val:g} {unit.capitalize()}'
    else:
        u['birim_norm'] = 'BILINMIYOR'
        u['miktar_gram'] = None
        u['birim_etiketi'] = agirlik_str or '?'

    # --- Her markete fiyat_per_kg ekle ---
    for f in u.get('fiyatlar', []):
        if u['birim_norm'] == 'AGIRLIK' and u['miktar_gram'] and f.get('fiyat'):
            f['fiyat_per_kg'] = round(f['fiyat'] / u['miktar_gram'] * 1000, 2)
        else:
            f['fiyat_per_kg'] = None

    # Urun duzeyinde en dusuk kg fiyati
    kg_prices = [f['fiyat_per_kg'] for f in u.get('fiyatlar', []) if f.get('fiyat_per_kg')]
    u['en_dusuk_fiyat_per_kg'] = min(kg_prices) if kg_prices else None

    return u


# ---- Ana Islem ----

shutil.copy(SRC, BAK)
print(f"Yedek: {BAK}")

with open(SRC, encoding='utf-8') as f:
    data = json.load(f)

urunler = data['urunler']
data['urunler'] = [normalize_urun(u) for u in urunler]

# --- Istatistik ---
from collections import Counter
birim_sayac = Counter(u['birim_norm'] for u in data['urunler'])
print(f"\nNormalizasyon sonucu ({len(data['urunler'])} urun):")
for birim, sayi in birim_sayac.items():
    print(f"  {birim}: {sayi} urun")

# Kilo bazli karmasiklik ornekleri
print("\nFarkli gramajdaki ayni urun ornekleri (ilk 5):")
from collections import defaultdict
gruplar = defaultdict(list)
for u in data['urunler']:
    if u['birim_norm'] == 'AGIRLIK':
        baz = re.sub(
            r'\b\d+[\.,]?\d*\s*(Kg|Gr|Lt|Ml|Adet|kg|gr|lt|ml|adet)\b', '',
            u['ad'], flags=re.IGNORECASE
        ).strip()
        baz = re.sub(r'\s+', ' ', baz)
        gruplar[baz].append(u)

n = 0
for baz, urunler_g in sorted(gruplar.items()):
    gramlar = {u['miktar_gram'] for u in urunler_g}
    if len(gramlar) > 1:
        print(f"  '{baz}'")
        for u in urunler_g:
            pkgs = [f"{f['fiyat']} TL ({f['fiyat_per_kg']} TL/Kg, {f['market']})"
                    for f in u['fiyatlar'] if f['fiyat']]
            print(f"    {u['ad']:40} {u['birim_etiketi']:10} | {' | '.join(pkgs[:2])}")
        n += 1
        if n >= 5:
            break

with open(SRC, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nGuncellendi: {SRC}")
