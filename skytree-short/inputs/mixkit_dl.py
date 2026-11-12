import re, sys, json, time, urllib.request, pathlib, html

BASE = pathlib.Path('/tmp/claude-0/-home-user-Main/08a2a9c2-14f7-5064-bf63-1413b8087efd/scratchpad/sfx/mixkit')
BASE.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0'}
cats = sys.argv[1].split(',')
per = int(sys.argv[2])
manifest = []
mf = BASE / 'manifest.json'
if mf.exists():
    manifest = json.loads(mf.read_text())
seen = {m['id'] for m in manifest}

def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        d = r.read()
    return d if binary else d.decode('utf-8', 'replace')

for c in cats:
    try:
        page = get(f'https://mixkit.co/free-sound-effects/{c}/')
    except Exception as e:
        print('skip', c, e)
        continue
    items = re.findall(r'preview-url-value="https://assets.mixkit.co/active_storage/sfx/(\d+)/\d+-preview.mp3".*?item-grid-card__title">\s*(.*?)\s*</h2>', page, flags=re.S)
    n = 0
    for iid, title in items:
        if iid in seen:
            continue
        title = html.unescape(title.strip())
        try:
            data = get(f'https://assets.mixkit.co/active_storage/sfx/{iid}/{iid}-preview.mp3', True)
        except Exception as e:
            print('fail', iid, e)
            continue
        fn = f'{c}__{iid}__' + re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-') + '.mp3'
        (BASE / fn).write_bytes(data)
        manifest.append({'id': iid, 'cat': c, 'title': title, 'file': fn, 'bytes': len(data)})
        seen.add(iid)
        n += 1
        if n >= per:
            break
        time.sleep(0.2)
    print(c, 'got', n, 'of', len(items))
mf.write_text(json.dumps(manifest, indent=1))
print('total', len(manifest))
