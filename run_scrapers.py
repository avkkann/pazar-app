"""
Her iki scraper'i sirayla calistirir.
Railway Cron Job komutu: python run_scrapers.py
Zamanlama: 0 6 * * *  (her gun saat 06:00)
"""

import sys
from datetime import datetime

import hal_scraper
import scraper


def main():
    print("=" * 60)
    print(f"Scraper baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n[1/2] Hal fiyatlari cekiliyor...")
    hal_result = hal_scraper.scrape()
    if not hal_result:
        print("[UYARI] Hal verisi alinamadi.")

    print("\n[2/2] Market fiyatlari cekiliyor...")
    market_result = scraper.scrape()
    if not market_result:
        print("[UYARI] Market verisi alinamadi.")

    print("\n" + "=" * 60)
    print(f"Bitis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if not hal_result and not market_result:
        print("Her iki scraper da basarisiz oldu.")
        sys.exit(1)
    print("Tamamlandi.")


if __name__ == "__main__":
    main()
