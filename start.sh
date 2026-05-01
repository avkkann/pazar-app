#!/bin/bash

echo "=== Scraper'lar calistiriliyor... ==="
python run_scrapers.py
if [ $? -ne 0 ]; then
  echo "[UYARI] Scraper'lar basarisiz, mevcut JSON dosyalari kullanilacak."
fi

echo "=== Sunucu baslatiliyor... ==="
exec gunicorn server:app --bind "0.0.0.0:${PORT:-8000}" --workers 1 --timeout 120
