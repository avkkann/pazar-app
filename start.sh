#!/bin/bash
set -e

echo "=== Hal fiyatlari cekiliyor... ==="
python hal_scraper.py

echo "=== Market fiyatlari cekiliyor... ==="
python scraper.py

echo "=== Sunucu baslatiliyor... ==="
exec gunicorn server:app --bind 0.0.0.0:${PORT:-8000}
