import re
import json
import base64
import gzip
import os

PKG = r"E:\Projects\Anchor\anchor\mobile\artifacts\anchor15-reference-source\package"
SRC_HTML = os.path.join(PKG, "06 Refine Style.html")
UNPACKED_HTML = os.path.join(PKG, "06_Refine_Style_unpacked.html")
EXTRACTED_DIR = os.path.join(PKG, "extracted_06")

MODIFIED_ASSET_KEYS = {
    "a12369ea-3cab-4f37-a60c-fa3946d6a445": "a12369ea-3cab-4f37-a60c-fa3946d6a445.js",
    "2c3a6d31-1527-456f-a844-ea82c2b19a33": "2c3a6d31-1527-456f-a844-ea82c2b19a33.js",
}

with open(SRC_HTML, "r", encoding="utf-8") as f:
    content = f.read()

m_manifest = re.search(r'(<script type="__bundler/manifest">)([\s\S]*?)(</script>)', content)
m_template = re.search(r'(<script type="__bundler/template">)([\s\S]*?)(</script>)', content)
if not (m_manifest and m_template):
    raise SystemExit("manifest or template script tag not found")

manifest = json.loads(m_manifest.group(2))

# --- Recompress modified JS assets back into the manifest ---
for key, fname in MODIFIED_ASSET_KEYS.items():
    if key not in manifest:
        raise SystemExit(f"manifest missing key {key}")
    with open(os.path.join(EXTRACTED_DIR, fname), "rb") as f:
        raw_bytes = f.read()
    compressed = gzip.compress(raw_bytes, mtime=0)
    b64 = base64.b64encode(compressed).decode("ascii")
    manifest[key]["data"] = b64
    print(f"repacked {key}: {len(raw_bytes)} bytes -> {len(compressed)} gz -> {len(b64)} b64")

new_manifest_json = json.dumps(manifest, ensure_ascii=False)
new_manifest_json = new_manifest_json.replace("</", "<\\u002F")

# --- Rebuild template from the edited human-readable HTML ---
with open(UNPACKED_HTML, "r", encoding="utf-8") as f:
    new_template = f.read()

# sanity: same placeholder UUIDs should still be present (we only touched CSS text)
old_template = json.loads(m_template.group(2))
old_uuids = set(re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', old_template))
new_uuids = set(re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', new_template))
if old_uuids != new_uuids:
    raise SystemExit(f"UUID placeholder mismatch! missing={old_uuids-new_uuids} extra={new_uuids-old_uuids}")

new_template_json = json.dumps(new_template, ensure_ascii=False)
new_template_json = new_template_json.replace("</", "<\\u002F")

# --- Splice both back into the original file ---
content = content[:m_manifest.start(2)] + new_manifest_json + content[m_manifest.end(2):]

# re-locate template span since manifest replacement shifted offsets
m_template2 = re.search(r'(<script type="__bundler/template">)([\s\S]*?)(</script>)', content)
content = content[:m_template2.start(2)] + new_template_json + content[m_template2.end(2):]

with open(SRC_HTML, "w", encoding="utf-8") as f:
    f.write(content)

print("Repack complete. New file size:", os.path.getsize(SRC_HTML))
