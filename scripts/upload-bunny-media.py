#!/usr/bin/env python3
"""Upload generated NAVA listing WebP files to Bunny Storage.

Reads the Bunny Storage write password from BUNNY_STORAGE_PASSWORD.
No credential is stored in the repository.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MEDIA = ROOT / "lbnb-v0-live-07" / "site" / "media" / "listings"


def upload_one(path: Path, *, password: str, zone: str, prefix: str) -> tuple[str, int]:
    remote = "/".join(part.strip("/") for part in (zone, prefix, path.name) if part.strip("/"))
    url = "https://storage.bunnycdn.com/" + urllib.parse.quote(remote, safe="/")
    data = path.read_bytes()
    req = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "AccessKey": password,
            "Content-Type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            status = resp.getcode()
            if status not in (200, 201):
                raise RuntimeError(f"Unexpected Bunny response {status} for {path.name}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Bunny upload failed for {path.name}: HTTP {exc.code} {body}") from exc
    return path.name, len(data)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media-dir", type=Path, default=DEFAULT_MEDIA)
    ap.add_argument("--zone", default=os.environ.get("BUNNY_STORAGE_ZONE", "lbnb-media"))
    ap.add_argument("--prefix", default="listings")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    password = os.environ.get("BUNNY_STORAGE_PASSWORD", "").strip()
    if not password:
        raise SystemExit("BUNNY_STORAGE_PASSWORD is not set")
    if not args.media_dir.exists():
        raise SystemExit(f"Media directory does not exist: {args.media_dir}")

    files = sorted(args.media_dir.glob("*.webp"))
    if not files:
        raise SystemExit("No WebP listing media found to upload")

    total = 0
    uploaded = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {
            pool.submit(upload_one, p, password=password, zone=args.zone, prefix=args.prefix): p
            for p in files
        }
        for fut in concurrent.futures.as_completed(futures):
            name, size = fut.result()
            uploaded += 1
            total += size
            if uploaded % 100 == 0 or uploaded == len(files):
                print(f"Uploaded {uploaded}/{len(files)} files ({total / 1024 / 1024:.1f} MiB sent)")

    print(f"PASS: uploaded {uploaded} listing photos to Bunny Storage zone {args.zone}/{args.prefix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
