import re, sys, subprocess, os
slugs = sys.argv[1:]
for s in slugs:
    html = subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", "--max-time", "25", f"https://opengameart.org/content/{s}"], capture_output=True, text=True).stdout
    lic = re.search(r'field-name-field-art-licenses.*?</div>\s*</div>', html, re.S)
    lic_txt = re.sub(r"<[^>]+>", " ", lic.group(0)) if lic else ""
    if "CC0" not in lic_txt: print(f"SKIP {s}: license {' '.join(lic_txt.split())[:60]}"); continue
    files = sorted(set(re.findall(r'https://opengameart\.org/sites/default/files/(?!styles/|audio_preview/)[^"\'<> ]+\.(?:zip|ogg|wav|mp3|flac|rar|7z)', html)))
    os.makedirs(f"oga/{s}", exist_ok=True)
    for u in files[:6]:
        out = f"oga/{s}/" + u.split("/")[-1]
        subprocess.run(["curl", "-s", "-L", "--max-time", "180", "-o", out, u])
        if out.endswith(".zip"): subprocess.run(["unzip", "-q", "-o", out, "-d", f"oga/{s}"])
    print(f"OK {s}: {len(files)} files")
