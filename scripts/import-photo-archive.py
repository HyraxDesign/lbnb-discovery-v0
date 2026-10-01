#!/usr/bin/env python3
"""Import the original LBNB photo archive into the live NAVA site.

The importer is deterministic: it links by the original 40-character SHA-like
filename stem already present in legacy media URLs. It never guesses by image
content. By default it only imports archive files whose stems are referenced by
lbnb-content-v0.json; pass --all to import every valid archive image.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "lbnb-v0-live-07" / "site"
CONTENT = SITE / "lbnb-content-v0.json"
MEDIA_DIR = SITE / "media" / "listings"
MEDIA_JS = SITE / "v151-media.js"
REPORT = ROOT / "scripts" / "photo-archive-import-report.json"
CDN_BASE = "https://lbnb-media.b-cdn.net/listings"
STEM_RE = re.compile(r"(?i)(?<![a-f0-9])([a-f0-9]{40})(?:\.(?:jpe?g|png|webp))?(?![a-f0-9])")
RECOVERED_RE = re.compile(r"const RECOVERED_MEDIA=new Set\((\[[^;]*?\])\);", re.S)
VALID_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def content_stems() -> set[str]:
    text = CONTENT.read_text(encoding="utf-8")
    return {m.group(1).lower() for m in STEM_RE.finditer(text)}


def archive_entries(zf: zipfile.ZipFile) -> dict[str, zipfile.ZipInfo]:
    out: dict[str, zipfile.ZipInfo] = {}
    for info in zf.infolist():
        if info.is_dir():
            continue
        p = Path(info.filename)
        if p.suffix.lower() not in VALID_EXTS:
            continue
        stem = p.stem.lower()
        if re.fullmatch(r"[a-f0-9]{40}", stem):
            out.setdefault(stem, info)
    return out


def convert(raw: bytes, target: Path, max_dim: int, quality: int) -> dict:
    source_sha = hashlib.sha256(raw).hexdigest()
    with Image.open(io.BytesIO(raw)) as original:
        original = ImageOps.exif_transpose(original).convert("RGB")
        source_size = list(original.size)
        original.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        original.save(target, "WEBP", quality=quality, method=6)
        output_size = list(original.size)
    with Image.open(target) as check:
        check.verify()
    return {
        "source_sha256": source_sha,
        "source_size": source_size,
        "output_size": output_size,
        "bytes": target.stat().st_size,
    }


def update_recovered_set(stems: set[str]) -> int:
    text = MEDIA_JS.read_text(encoding="utf-8")
    match = RECOVERED_RE.search(text)
    if not match:
        raise RuntimeError("Could not locate RECOVERED_MEDIA in v151-media.js")
    existing = {str(x).lower() for x in json.loads(match.group(1))}
    merged = sorted(existing | stems)
    replacement = "const RECOVERED_MEDIA=new Set(" + json.dumps(merged, separators=(",", ":")) + ");"
    text = text[: match.start()] + replacement + text[match.end() :]
    text = re.sub(
        r"return RECOVERED_MEDIA\.has\(stem\)\?`(?:\./media/listings|https://lbnb-media\.b-cdn\.net/listings)/\$\{stem\}\.webp`:\'\'",
        "return RECOVERED_MEDIA.has(stem)?`" + CDN_BASE + "/${stem}.webp`:''",
        text,
        count=1,
    )
    MEDIA_JS.write_text(text, encoding="utf-8")
    return len(merged)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("archive", type=Path, help="ZIP containing original photos")
    ap.add_argument("--all", action="store_true", help="Import every valid 40-char archive image, not only referenced images")
    ap.add_argument("--max-dim", type=int, default=1600)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--strict", action="store_true", help="Fail if any selected archive image cannot be decoded")
    args = ap.parse_args()

    if not args.archive.exists():
        ap.error(f"Archive does not exist: {args.archive}")
    if not CONTENT.exists() or not MEDIA_JS.exists():
        raise SystemExit("Run this script from the lbnb-discovery-v0 repository")

    referenced = content_stems()
    imported: list[dict] = []
    invalid: list[dict] = []
    skipped: list[str] = []

    with zipfile.ZipFile(args.archive) as zf:
        entries = archive_entries(zf)
        selected = sorted(entries if args.all else (set(entries) & referenced))
        for stem in selected:
            info = entries[stem]
            try:
                raw = zf.read(info)
                target = MEDIA_DIR / f"{stem}.webp"
                meta = {"stem": stem, "source": info.filename, "target": str(target.relative_to(ROOT))}
                if args.dry_run:
                    imported.append(meta)
                else:
                    meta.update(convert(raw, target, args.max_dim, args.quality))
                    imported.append(meta)
            except Exception as exc:
                invalid.append({"stem": stem, "source": info.filename, "error": str(exc)})

        skipped = sorted((set(entries) - set(selected)))

    recovered_count = None
    if not args.dry_run:
        recovered_count = update_recovered_set({x["stem"] for x in imported})

    report = {
        "archive": str(args.archive),
        "archive_named_images": len(entries),
        "content_referenced_stems": len(referenced),
        "matching_archive_images": len(set(entries) & referenced),
        "imported": len(imported),
        "invalid_count": len(invalid),
        "invalid": invalid,
        "not_selected": len(skipped),
        "recovered_media_count_after": recovered_count,
        "settings": {"max_dim": args.max_dim, "quality": args.quality, "all": args.all, "dry_run": args.dry_run, "strict": args.strict},
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not imported:
        return 2
    return 1 if args.strict and invalid else 0


if __name__ == "__main__":
    sys.exit(main())
