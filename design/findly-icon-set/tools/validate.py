# Icon set validator — checks every file in findly-icon-set.
# Run: python tools/validate.py
import json
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent   # findly-icon-set/
ASSETS = ROOT / "assets"

errors, warnings = [], []
def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

# ---------- SVG files ----------
EXPECTED_DIMS = {
    "assets/master/icon-master.svg": ("1254", "1254"),
    "assets/master/icon-flat.svg": ("1254", "1254"),
    "assets/app/icon-dark.svg": ("1254", "1254"),
    "assets/app/icon-circle.svg": ("512", "512"),
    "assets/app/apple-touch-icon.svg": ("180", "180"),
    "assets/app/icon-maskable.svg": ("512", "512"),
    "assets/glyph/glyph.svg": ("512", "604"),
    "assets/glyph/glyph-teal.svg": ("512", "604"),
    "assets/glyph/glyph-mono-black.svg": ("512", "604"),
    "assets/glyph/glyph-mono-white.svg": ("512", "604"),
    "assets/favicon.svg": ("64", "64"),
    "assets/sprite.svg": None,
}
for n in (16, 24, 32, 48, 64, 96, 128, 256, 512):
    EXPECTED_DIMS[f"assets/sizes/icon-{n}.svg"] = (str(n), str(n))

# signature strings each variant must / must not contain
EXPECTED_CONTENT = {
    "assets/master/icon-master.svg": [("url(#bg)", True), ("fTight", True), ("sqclip", True), ("barclip", True)],
    "assets/master/icon-flat.svg": [("url(#bg)", True), ("fTight", False), ("sqclip", True)],
    "assets/app/icon-dark.svg": [("url(#bgDark)", True), ("id=\"bgDark\"", True), ("url(#bg)\"", False)],
    "assets/app/icon-circle.svg": [('cx="627" cy="627" r="540"', True), ("sqclip", False)],
    "assets/app/apple-touch-icon.svg": [('<rect width="1254" height="1254"', True), ("sqclip", False)],
    "assets/app/icon-maskable.svg": [("scale(1.1)", True), ('<rect width="1254" height="1254"', True), ("sqclip", False)],
    "assets/glyph/glyph.svg": [("url(#fwhite)", True), ("sqp", False), ('viewBox="348 257 638 753"', True)],
    "assets/glyph/glyph-teal.svg": [("url(#fwhiteT)", True), ("url(#fwhite)\"", False), ('fill="#FFFFFF"/>', True)],
    "assets/glyph/glyph-mono-black.svg": [('fill="#000000"', True), ("url(#", False)],
    "assets/glyph/glyph-mono-white.svg": [('fill="#FFFFFF"', True), ("url(#", False)],
    "assets/favicon.svg": [("sqclip", True), ("fTight", False)],
    "assets/sprite.svg": [("findly-icon", True), ("findly-glyph-teal", True), ("currentColor", True)],
}
for n in (16, 24, 32, 48, 64):
    EXPECTED_CONTENT[f"assets/sizes/icon-{n}.svg"] = [("fTight", False), ("sqclip", True)]
for n in (96, 128, 256, 512):
    EXPECTED_CONTENT[f"assets/sizes/icon-{n}.svg"] = [("fTight", True), ("sqclip", True)]

svg_files = sorted(ASSETS.rglob("*.svg"))
expected_set = set(EXPECTED_DIMS)
found_set = {str(f.relative_to(ROOT)).replace("\\", "/") for f in svg_files}

for missing in sorted(expected_set - found_set):
    err(f"MISSING FILE: {missing}")
for extra in sorted(found_set - expected_set):
    warn(f"unexpected file: {extra}")

for f in svg_files:
    rel = str(f.relative_to(ROOT)).replace("\\", "/")
    text = f.read_text(encoding="utf-8")
    if not text.strip():
        err(f"{rel}: empty file"); continue
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        err(f"{rel}: XML parse error: {e}"); continue
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        err(f"{rel}: root element is {root.tag}")
    if not root.get("xmlns") and "http://www.w3.org/2000/svg" not in root.tag:
        err(f"{rel}: missing xmlns")
    if re.search(r"undefined|NaN", text):
        err(f"{rel}: contains undefined/NaN")
    if not root.get("viewBox"):
        err(f"{rel}: missing viewBox")

    w, h = root.get("width"), root.get("height")
    exp = EXPECTED_DIMS.get(rel)
    if exp and (w, h) != exp:
        err(f"{rel}: width/height = {w}/{h}, expected {exp[0]}/{exp[1]}")

    ids = re.findall(r'\bid="([^"]+)"', text)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        err(f"{rel}: duplicate ids: {dupes}")
    idset = set(ids)
    refs = re.findall(r"url\(#([^)]+)\)", text) + re.findall(r'(?:xlink:)?href="#([^"]+)"', text)
    unresolved = sorted({r for r in refs if r not in idset})
    if unresolved:
        err(f"{rel}: unresolved internal refs: {unresolved}")

    for needle, should_exist in EXPECTED_CONTENT.get(rel, []):
        if (needle in text) != should_exist:
            state = "missing" if should_exist else "unexpected"
            err(f'{rel}: {state} content: "{needle}"')

# ---------- site.webmanifest ----------
mf = ASSETS / "site.webmanifest"
try:
    mf_data = json.loads(mf.read_text(encoding="utf-8"))
    for icon in mf_data.get("icons", []):
        src = icon.get("src", "")
        if not (ASSETS / src).exists():
            err(f"assets/site.webmanifest: icon src not found: {src}")
        if icon.get("purpose") not in (None, "any", "maskable", "monochrome", "any maskable", "maskable any"):
            warn(f'assets/site.webmanifest: odd purpose "{icon.get("purpose")}"')
    if not mf_data.get("name"):
        warn("assets/site.webmanifest: no name field")
except json.JSONDecodeError as e:
    err(f"assets/site.webmanifest: invalid JSON: {e}")

# ---------- preview.html ----------
pv = ROOT / "preview.html"
pv_text = pv.read_text(encoding="utf-8")
local_refs = re.findall(r'(?:src|href)="([^"]+)"', pv_text)
for ref in local_refs:
    if ref.startswith(("http:", "https:", "data:", "#")):
        continue
    ref_path = ref.split("#", 1)[0]          # drop symbol fragments (sprite.svg#id)
    if not ref_path or (ROOT / ref_path).exists():
        continue
    err(f"preview.html: broken reference: {ref}")

# ---------- build script syntax ----------
import subprocess
r = subprocess.run(["node", "--check", str(ROOT / "tools" / "build.mjs")],
                   capture_output=True, text=True)
if r.returncode != 0:
    err(f"tools/build.mjs syntax error: {r.stderr.strip()}")

# ---------- misc ----------
if not (ROOT / "README.md").exists():
    err("README.md missing")

# ---------- report ----------
n_checked = len(svg_files) + 3
print(f"Checked {len(svg_files)} SVG files + webmanifest + preview.html + build.mjs")
if errors:
    print(f"\nFAIL — {len(errors)} problem(s):")
    for e in errors:
        print("  ✗", e)
    sys.exit(1)
print("All structural checks passed.")
for w in warnings:
    print("  ⚠", w)
