"""
Antalya Hal Fiyatlari Scraper
Kaynak: hal.gov.tr/Sayfalar/FiyatDetaylari.aspx
T.C. Ticaret Bakanlığı Hal Kayıt Sistemi gunluk fiyat listesi.
"""

import json
import os
import re
import statistics
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

SOURCE_URL = "https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx"

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(DATA_DIR, "hal.json")
MAX_RETRIES = 3

# Satir bazli mutlak fiyat esigi KALDIRILDI (eskiden MAX_PRICE = 500).
# Kaba bir korumaydi ve 9 gercek urunu tamamen yok ediyordu: Ahududu, Frenk
# Uzumu, Kuskonmaz, Passionfruit, Isirgan, Tamarind, Turmeric, Pshalis, Mercan
# Kosk. Yerine iki asamali, urun baglaminda calisan kontrol geldi.

# 1) URUN-ICI AYKIRI SATIR: bir satirin fiyati, o urunun EN COK ISLEM GOREN
#    satirinin bu kat sayisindan yuksekse veri hatasi sayilir ve atilir.
#    Neden 20: 10.08.2026 bulteninde bu esigin attigi 9 satirin HEPSI "Iyi Tarim"
#    ve baskin fiyatin 30-55 kati (Adacayi 4180 vs 76 = 55x, Ispanak 842 vs 22 =
#    38x). Bu bir premium kademe degil, hata. K=10 denendi: 1261 kg hacimli
#    Kuzukulagi satirini da atiyordu — fazla agresif. K=20 gercek hacimli
#    satirlara dokunmuyor.
#    Hacim agirligi bu iSi TEK BASINA yapamiyor: Adacayi'nda saglam satir 8 kg,
#    hatali satir 4 kg; agirlikli ortalama 1444 TL cikiyordu (dogrusu 76,48).
AYKIRI_KAT = 20

# 2) URUN BAZLI AKIL SAGLIGI: temizlikten sonra hala bu tutarin ustundeyse
#    urun tamamen dusurulur. Temizlik sonrasi en pahali gercek urun Frenk Uzumu
#    1102,75 TL (132 kg gercek hacim), o yuzden 2000 rahat bir tavan.
URUN_MAX_FIYAT = 2000

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9",
}


def fetch_with_retry(url, method='get', **kwargs):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if method == 'post':
                resp = sess.post(url, **kwargs)
            else:
                resp = sess.get(url, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)
    return None


def title_case(s):
    """'DOMATES' -> 'Domates', 'YER FISTIGI' -> 'Yer Fistigi'"""
    if not s:
        return s
    small = {
        've', 'veya', 'ile', 'için', 'de', 'da', 'bu', 'ne', 'ama', 'fakat',
        'kırmızı', 'beyaz', 'siyah', 'yeşil', 'sarı', 'mavi', 'turuncu', 'mor',
        'kuru', 'taze', ' Organik', 'iyi', 'tarim', 'geleneksel', 'konvansiyonel'
    }
    words = s.split()
    result = []
    for i, w in enumerate(words):
        lower_w = w.lower()
        if i == 0 or lower_w not in small:
            result.append(w.capitalize())
        else:
            result.append(lower_w)
    return ' '.join(result)


def parse_excel_response(content):
    """Excel (HTML format) ciktisini parse eder."""
    try:
        text = content.decode('utf-16')
    except Exception:
        return [], ""

    soup = BeautifulSoup(text, 'html.parser')
    rows = soup.find_all('tr')
    if not rows:
        return [], ""

    products = []
    tarih_str = ""

    for row in rows[1:]:
        cols = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
        if len(cols) < 5:
            continue

        if cols[0].startswith('Bulten Tarihi'):
            m = re.search(r'\d{2}[-./]\d{2}[-./]\d{4}', cols[0])
            if m:
                tarih_str = m.group(0)
            continue

        if cols[0] in ('Urün Adı', 'Ürün Adı', '', '12345678910...'):
            continue

        # Kaynak tablo kolonlari (10.08.2026 bulteninden dogrulandi):
        #   0 Urun Adi | 1 Urun Cinsi | 2 Urun Turu | 3 Ortalama Fiyat
        #   4 Islem Hacmi | 5 Birim Adi
        # Her satir bir (urun x cins x tur) kombinasyonunun O GUNKU ortalamasi;
        # "Islem Hacmi" o kombinasyonda gerceklesen miktar, yani dogru agirlik.
        ad = title_case(cols[0])
        birim = cols[5] if len(cols) > 5 else 'Kg'
        fiyat_str = cols[3] if len(cols) > 3 else ''
        fiyat = parse_fiyat(fiyat_str)

        if not fiyat:
            continue

        products.append({
            "ad": ad,
            "cinsi": cols[1] if len(cols) > 1 else "",
            "turu": cols[2] if len(cols) > 2 else "",
            "fiyat": fiyat,
            "hacim": parse_fiyat(cols[4]) if len(cols) > 4 else None,
            "birim": birim,
            "sehir": "TR",
        })

    if not tarih_str:
        m = re.search(r'\d{2}[-./]\d{2}[-./]\d{4}', text)
        if m:
            tarih_str = m.group(0)

    return products, tarih_str


def _aykiri_satirlari_ele(satirlar):
    """Bir urunun satirlari icinde veri hatasi olanlari ayirir.

    Referans: o urunun EN COK ISLEM GOREN satirinin fiyati — o gun gercekten en
    cok alinip satilan fiyat, elimizdeki en guvenilir capa. Bu fiyatin
    AYKIRI_KAT katindan yuksek satirlar hata sayilir.
    Donen: (kalan_satirlar, atilan_satirlar)
    """
    hacimli = [s for s in satirlar if (s.get('hacim') or 0) > 0]
    if len(satirlar) < 2 or not hacimli:
        return satirlar, []
    referans = max(hacimli, key=lambda s: s['hacim'])['fiyat']
    if not referans or referans <= 0:
        return satirlar, []
    sinir = referans * AYKIRI_KAT
    kalan = [s for s in satirlar if s['fiyat'] <= sinir]
    atilan = [s for s in satirlar if s['fiyat'] > sinir]
    if not kalan:
        return satirlar, []
    return kalan, atilan


def _birlesik_fiyat(satirlar):
    """Bir urunun (urun x cins x tur) satirlarindan TEK temsili fiyat.

    HACIM AGIRLIKLI ORTALAMA kullanilir: sum(fiyat*hacim) / sum(hacim).
    Kaynakta her satir zaten o kombinasyonun gunluk ortalamasi, "Islem Hacmi"
    ise o kombinasyonda gerceklesen miktar; yani agirlikli ortalama "o gun
    gercekten odenen kilo basina ortalama" demek.

    Neden duz ortalama degil: 10.08.2026 bulteninde elma 12 satir; bir satir
    747.438 kg'yi 28,51 TL'den, baska bir satir 2 kg'yi 158,85 TL'den gormus.
    Duz ortalama bu ikisini esit sayip 93,68 TL diyordu.

    Neden medyan da degil — olcum (ayni bulten, leave-one-out kararlilik testi;
    bir satir eksildiginde ciktinin oynama yuzdesi, gunden gune degisen sey tam
    olarak bu):
        duz ortalama            medyan sapma %8,6
        medyan                  medyan sapma %9,4
        HACIM AGIRLIKLI         medyan sapma %1,8   <-- secildi
        hacim agirlikli medyan  medyan sapma %0,0 ama p90 %73 (basamak fonksiyonu,
                                atladiginda sert atliyor) ve buyuklugu atiyor

    Hacim politikasi:
      - hacim<=0 / eksik olan satir AGIRLIKTAN CIKAR. Uydurma agirlik verilmez;
        veri o satirda islem olmadigini soyluyor.
      - Bir urunun TUM satirlarinda hacim yoksa medyana dusulur (duz ortalamaya
        degil) — agirlik bilgisi yokken medyan uc degerlere daha dayanikli.
        10.08.2026 bulteninde bu duruma dusen urun sayisi: 0.
    """
    fiyatlar = [s['fiyat'] for s in satirlar if s.get('fiyat')]
    if not fiyatlar:
        return None
    hacimliler = [s for s in satirlar if s.get('fiyat') and (s.get('hacim') or 0) > 0]
    if not hacimliler:
        return round(statistics.median(fiyatlar), 2)
    toplam_hacim = sum(s['hacim'] for s in hacimliler)
    return round(sum(s['fiyat'] * s['hacim'] for s in hacimliler) / toplam_hacim, 2)


def merge_products(products):
    """Ayni isimli (urun x cins x tur) satirlarini tek urune indirger.

    Satirlarin ozeti de ciktiya tasinir: kac satirdan geldigi, toplam islem
    hacmi ve fiyat araligi. Boylece "tek sayi" nereden geliyor sorusu veriden
    cevaplanabilir.

    'turler' BILINCLI olarak ciktiya yazilmiyor: 9,8 KB tutuyordu (dosyanin
    %24'u) ve hicbir tuketici okumuyor. Satir seviyesinde okunmaya devam
    ediyor (parse_excel_response), yalnizca istemciye gonderilmiyor.
    """
    gruplar = {}
    for p in products:
        gruplar.setdefault(p['ad'].lower(), []).append(p)

    result = []
    atilan_satirlar = []
    dusen_urunler = []
    for satirlar in gruplar.values():
        ilk = satirlar[0]
        kalan, atilan = _aykiri_satirlari_ele(satirlar)
        for a in atilan:
            atilan_satirlar.append((ilk['ad'], a['fiyat'], a.get('hacim') or 0, a.get('turu') or ''))

        fiyatlar = [s['fiyat'] for s in kalan if s.get('fiyat')]
        if not fiyatlar:
            continue
        hacim = round(sum((s.get('hacim') or 0) for s in kalan), 2)
        fiyat = _birlesik_fiyat(kalan)

        # Urun bazli akil sagligi. Sessiz degil.
        # NOT: "hacim=0 ise dusur" kurali denendi ve VAZGECILDI — hacmi bilinmeyen
        # ama fiyati makul bir urunu atmak fazla ileri gidiyor, ve tek gercek vaka
        # (Mercan Kosk 4800 TL) zaten fiyat tavanindan dusuyor. Hacim bilgisi
        # yoksa _birlesik_fiyat medyana dusuyor, o yeterli.
        if fiyat is None or fiyat > URUN_MAX_FIYAT:
            dusen_urunler.append((ilk['ad'], fiyat, 'fiyat URUN_MAX_FIYAT=%s ustunde' % URUN_MAX_FIYAT))
            continue

        result.append({
            'ad': ilk['ad'],
            'fiyat': fiyat,
            'birim': ilk['birim'],
            'sehir': ilk['sehir'],
            'hacim': hacim,
            'satir_sayisi': len(kalan),
            'fiyat_min': min(fiyatlar),
            'fiyat_max': max(fiyatlar),
        })

    _temizligi_bildir(atilan_satirlar, dusen_urunler)
    return result


def _temizligi_bildir(atilan_satirlar, dusen_urunler):
    """Eleme sessiz olmasin: ne atildi, neden atildi, hepsi log'a."""
    if atilan_satirlar:
        print("  [AYKIRI SATIR] %d satir atildi (urun-ici en cok islem goren fiyatin %dx ustu):"
              % (len(atilan_satirlar), AYKIRI_KAT))
        for ad, fiyat, hacim, turu in sorted(atilan_satirlar, key=lambda x: -x[1]):
            print("    %-28s %10.2f  hacim=%-9.0f %s" % (ad[:28], fiyat, hacim, turu))
    if dusen_urunler:
        print("  [URUN DUSTU] %d urun akil sagligi kontrolunden gecemedi:" % len(dusen_urunler))
        for ad, fiyat, sebep in sorted(dusen_urunler, key=lambda x: -(x[1] or 0)):
            print("    %-28s %10s  %s" % (ad[:28], ("%.2f" % fiyat) if fiyat is not None else "-", sebep))


def parse_fiyat(text):
    """'80,00' gibi metni float'a cevirir."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned in ("", "-"):
        return None
    numeric = re.sub(r"[^\d.,]", "", cleaned)
    if not numeric:
        return None
    if "," in numeric and "." in numeric:
        numeric = numeric.replace(".", "").replace(",", ".")
    elif "," in numeric:
        numeric = numeric.replace(",", ".")
    try:
        return float(numeric)
    except ValueError:
        return None


HISTORY_FILE = os.path.join(DATA_DIR, "hal_gecmis.json")


def hal_gecmis_kaydet(urunler, bugun=None, dosya=None):
    """Hal fiyatlarinin gecmisini biriktirir. scraper.py'deki gecmis_kaydet()
    deseninin aynisi: yalnizca DEGER DEGISTIGINDE kayit eklenir, ayni gun ikinci
    kez kosulursa mukerrer yazilmaz. Format: { "<ad>": [{"t","f"}, ...] }
    Market kirilimi yok, kaynak tek (hal.gov.tr TR geneli bulteni).

    GERIYE DONUK DOLDURMA YAPILMIYOR — bilincli karar.
    Git'te data/hal.json'in 86 gunluk snapshot'i duruyor ama o dosyalar
    hacmi yok sayan DUZ ORTALAMA ile uretildi; cok satirli urunlerin %100'unde
    yanlis degerler iceriyorlar (Semizotu 120,89 TL yerine 19,38 TL olmaliydi).
    Geriye doldurmak gurultuyu de beraberinde getirirdi. Gecmis BUGUNDEN
    itibaren, hacim agirlikli duzeltilmis degerlerle birikmeye baslar.
    """
    if bugun is None:
        bugun = datetime.now().strftime("%Y-%m-%d")
    if dosya is None:
        dosya = HISTORY_FILE

    if os.path.exists(dosya):
        try:
            with open(dosya, "r", encoding="utf-8") as f:
                gecmis = json.load(f)
        except Exception as e:
            print(f"  [UYARI] hal_gecmis.json okunamadi: {e} — bu kosuda gecmis yazilmayacak")
            return 0
    else:
        gecmis = {}

    yeni_kayit = 0
    for u in urunler:
        ad = (u.get("ad") or "").strip()
        fiyat = u.get("fiyat")
        if not ad or fiyat is None:
            continue
        anahtar = ad.lower()
        kayitlar = gecmis.setdefault(anahtar, [])
        son = kayitlar[-1] if kayitlar else None
        if son and son.get("t") == bugun:
            continue
        if son and son.get("f") == fiyat:
            continue
        kayitlar.append({"t": bugun, "f": fiyat})
        yeni_kayit += 1

    with open(dosya, "w", encoding="utf-8") as f:
        json.dump(gecmis, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {yeni_kayit} yeni hal fiyat kaydi -> {dosya}")
    return yeni_kayit


def scrape():
    print("=" * 60)
    print("Hal Fiyatlari Scraper - TR geneli (hal.gov.tr)")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print(f"\nSayfa cekiliyor: {SOURCE_URL}")
    resp = fetch_with_retry(SOURCE_URL)
    if not resp:
        print("[HATA] Sayfa alinamadi.")
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')

    vs = soup.find('input', {'name': '__VIEWSTATE'}).get('value', '')
    vsg = soup.find('input', {'name': '__VIEWSTATEGENERATOR'}).get('value', '')
    ev = soup.find('input', {'name': '__EVENTVALIDATION'}).get('value', '')
    rd = soup.find('input', {'name': '__REQUESTDIGEST'}).get('value', '')
    date_input = soup.find('input', {'id': lambda i: i and 'dateControlDate' in i})
    btn_excel = soup.find('input', {'id': lambda i: i and 'btnExcel' in i})

    date_name = date_input.get('name')
    excel_name = btn_excel.get('name')

    today = datetime.now().strftime("%d.%m.%Y")
    print(f"  Tarih: {today}")

    data = {
        '__VIEWSTATE': vs,
        '__VIEWSTATEGENERATOR': vsg,
        '__EVENTVALIDATION': ev,
        '__REQUESTDIGEST': rd,
        date_name: today,
        excel_name: 'Export to Excel',
        '_wpcmWpid': '',
        'wpcmVal': '',
        'ctl00$ctl37$g_7e86b8d6_3aea_47cf_b1c1_939799a091e0$rblExcelOptions': '2',
    }

    print(f"\nExcel export cekiliyor...")
    resp2 = fetch_with_retry(SOURCE_URL, method='post',
                            data=data,
                            headers={'Content-Type': 'application/x-www-form-urlencoded'},
                            timeout=30)
    if not resp2:
        print("[HATA] Excel export alinamadi.")
        return None

    products, tarih_str = parse_excel_response(resp2.content)
    print(f"  {len(products)} urun parse edildi.")

    if not products:
        print("[UYARI] Hic urun bulunamadi.")
        return None

    products = merge_products(products)
    print(f"  {len(products)} urun (birlesik sonrasi)")

    output = {
        "kaynak": "hal.gov.tr",
        "sehir": "TR",
        "bulten_tarihi": tarih_str or today,
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun": len(products),
        "urunler": products,
    }

    # Mevcut hal.json'daki gorsel alanlarini koru (dosya sistemine gore, isim slug'i ile)
    import re as _re
    import unicodedata as _unicodedata

    def _slugify(ad):
        n = _unicodedata.normalize("NFKD", ad)
        n = n.encode("ascii", "ignore").decode("ascii")
        n = _re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
        return n or "urun"

    IMAGES_DIR = os.path.join(DATA_DIR, "hal-images")
    gorsel_eklenen = 0
    for p in output["urunler"]:
        slug = _slugify(p["ad"])
        dosya_adi = slug + ".jpg"
        dosya_yolu = os.path.join(IMAGES_DIR, dosya_adi)
        if os.path.isfile(dosya_yolu):
            p["gorsel"] = "data/hal-images/" + dosya_adi
            gorsel_eklenen += 1
    print(f"  Gorsel korundu/eslendi: {gorsel_eklenen}/{len(output['urunler'])} urun")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # hal.json her kosuda eziliyor; gecmis ayri dosyada birikiyor.
    print("\n--- Hal gecmis kaydi ---")
    hal_gecmis_kaydet(output["urunler"])

    print(f"\nTamamlandi: {len(products)} urun -> {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    scrape()