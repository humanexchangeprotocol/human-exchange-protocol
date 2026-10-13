#!/usr/bin/env python3
"""Set the app version everywhere the app carries it, in one step.

Usage:
  python3 tools/bump.py dev 2.135.0     # the testing build in dev/
  python3 tools/bump.py prod 2.134.0    # the production build at the root

It writes three places per channel: version.json (version + updated date),
sw.js (CACHE_VERSION) and hep-core.js (APP_VERSION). The website reads both
version.json files from GitHub Pages on its own (includes/app-version.php,
ten-minute cache), so nothing on the website is edited by hand.
Refuses a version without a patch number. Prints every change it made.
"""
import json, re, sys, datetime, pathlib

if len(sys.argv) != 3 or sys.argv[1] not in ('dev', 'prod'):
    sys.exit(__doc__)
channel, ver = sys.argv[1], sys.argv[2]
if not re.fullmatch(r'\d+\.\d+\.\d+', ver):
    sys.exit('Version must be major.minor.patch, e.g. 2.135.0')

root = pathlib.Path(__file__).resolve().parent.parent
base = root / 'dev' if channel == 'dev' else root

vj = base / 'version.json'
data = json.loads(vj.read_text())
old = data['version']
data['version'] = ver
data['updated'] = datetime.date.today().isoformat()
vj.write_text(json.dumps(data, indent=2) + '\n')
print(f'{vj.relative_to(root)}: {old} -> {ver}')

for name, pattern, repl in [
    ('sw.js', r"const CACHE_VERSION = '[\d.]+'", f"const CACHE_VERSION = '{ver}'"),
    ('hep-core.js', r"const APP_VERSION='[\d.]+'", f"const APP_VERSION='{ver}'"),
]:
    f = base / name
    text = f.read_text()
    new, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        sys.exit(f'Could not find the version line in {f.relative_to(root)}; nothing further changed.')
    f.write_text(new)
    print(f'{f.relative_to(root)}: set to {ver}')
