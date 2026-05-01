#!/bin/bash

echo "=== Hal fiyatlari cekiliyor... ==="
python hal_scraper.py
if [ $? -ne 0 ]; then
  echo "[UYARI] hal_scraper.py basarisiz oldu, mevcut veri kullanilacak."
fi

echo "=== Market fiyatlari cekiliyor... ==="
python scraper.py
if [ $? -ne 0 ]; then
  echo "[UYARI] scraper.py basarisiz oldu, mevcut veri kullanilacak."
fi

echo "=== Sunucu baslatiliyor... ==="
exec gunicorn server:app --bind "0.0.0.0:${PORT:-8000}" --workers 1 --timeout 120
