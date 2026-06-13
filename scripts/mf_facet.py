import json, requests
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Connection": "close",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}
r = requests.post("https://api.marketfiyati.org.tr/api/v2/searchByCategories",
                  json={"menuCategory": True, "keywords": "Meyve ve Sebze", "pages": 0, "size": 1},
                  headers=HEADERS, timeout=15, verify=False)
print("status:", r.status_code)
print("content-type:", r.headers.get("content-type"))
print("text head:", r.text[:200])
print()
try:
    j = r.json()
    print("top keys:", list(j.keys()))
    fm = j.get("facetMap", {})
    print("facetMap top keys:", list(fm.keys()))
    print()
    print(json.dumps(fm, ensure_ascii=False, indent=2)[:5000])
except Exception as e:
    print("JSON DECODE ERROR:", e)
