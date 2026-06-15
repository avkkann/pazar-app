import json, sys
sys.stdout.reconfigure(encoding='utf-8')
eski = json.load(open('tmp_eski_mf.json', encoding='utf-16'))
yeni = json.load(open('data/marketfiyati.json', encoding='utf-8'))
harman = {}
for p in eski:
    if p.get('_sid'): harman[p['_sid']] = p
eski_n = len(harman)
eklenen = 0
for p in yeni:
    if p.get('_sid') and p['_sid'] not in harman:
        harman[p['_sid']] = p
        eklenen += 1
liste = list(harman.values())
json.dump(liste, open('data/marketfiyati.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'eski: {eski_n} | yeni eklenen: {eklenen} | toplam: {len(liste)}')