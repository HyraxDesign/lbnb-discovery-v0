"""Recover exact Drive originals; verify bytes before optimizing for the site."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import re
import time
from urllib.request import urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def recover(item, source_root=None):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", item["id"]):
        raise ValueError("Invalid Drive ID")
    if not re.fullmatch(r"lbnb-v0-live-07/site/media/listings/[a-f0-9]{40}\.webp", item["path"]):
        raise ValueError("Invalid output path")
    last_error = None
    for attempt in range(4):
        try:
            if source_root:
                stem = item["title"].split(".")[0]
                source = next(source_root.rglob(stem + "*"))
                raw = source.read_bytes()
            else:
                url = "https://drive.google.com/uc?export=download&id=" + item["id"]
                with urlopen(url, timeout=90) as response:
                    raw = response.read()
            if hashlib.sha256(raw).hexdigest() != item["source_sha256"]:
                raise ValueError("Original checksum mismatch: " + item["title"])
            with Image.open(io.BytesIO(raw)) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                output = ROOT / item["path"]
                output.parent.mkdir(parents=True, exist_ok=True)
                image.save(output, "WEBP", quality=82, method=6)
            with Image.open(output) as check:
                check.verify()
            return item["path"]
        except Exception as error:
            last_error = error
            if source_root:
                break
            time.sleep(2 ** attempt)
    raise RuntimeError(item["title"] + ": " + str(last_error))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path)
    args = parser.parse_args()
    manifest = json.loads((ROOT / "scripts/drive-media-manifest.json").read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        for count, path in enumerate(pool.map(lambda item: recover(item, args.source_root), manifest), 1):
            if count % 40 == 0:
                print(f"Verified and recovered {count}/{len(manifest)} photos", flush=True)
    print(f"PASS: all {len(manifest)} exact originals recovered and decoded", flush=True)
