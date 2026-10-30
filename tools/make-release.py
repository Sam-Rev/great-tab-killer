#!/usr/bin/env python3
"""Build a deterministic extension ZIP from tools/release-files.txt."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent.parent
ALLOWLIST = ROOT / "tools" / "release-files.txt"
VERSION_RE = re.compile(r"\A\d+\.\d+\.\d+\Z")
FORBIDDEN_PREFIXES = ("dev/", "docs/", "tools/", "tests/", "assets/source/", ".git")
OWNER_LOGOS = {"Tab_Killer_logo.png", "Tab_Killer_logo_2.png", "Tab_Killer_logo 2.jpg"}


def load_release_files(root: Path = ROOT) -> list[str]:
    allowlist = root / "tools" / "release-files.txt"
    entries = [
        line.strip()
        for line in allowlist.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if len(entries) != len(set(entries)):
        raise ValueError("release-files.txt contains duplicate paths")
    for entry in entries:
        path = PurePosixPath(entry)
        if path.is_absolute() or ".." in path.parts or "*" in entry or "?" in entry:
            raise ValueError(f"allowlist entry must be a literal safe path: {entry}")
        if entry.startswith(FORBIDDEN_PREFIXES) or entry.split("/", 1)[0].startswith(".git"):
            raise ValueError(f"release allowlist includes an excluded path: {entry}")
        if len(path.parts) == 1 and entry in OWNER_LOGOS:
            raise ValueError(f"release allowlist includes an owner source logo: {entry}")
        if entry.endswith(".md") and entry != "BRANDING.md":
            raise ValueError(f"release allowlist includes non-runtime Markdown: {entry}")
        source = root.joinpath(*path.parts)
        if not source.is_file() or source.is_symlink():
            raise ValueError(f"allowlisted file is missing or is a symlink: {entry}")
    if "manifest.json" not in entries:
        raise ValueError("release allowlist must include manifest.json")
    return sorted(entries)


def manifest_references(manifest: dict) -> set[str]:
    refs: set[str] = set()
    for key in ("options_page",):
        if isinstance(manifest.get(key), str):
            refs.add(manifest[key])
    background = manifest.get("background", {})
    if isinstance(background.get("service_worker"), str):
        refs.add(background["service_worker"])
    for content_script in manifest.get("content_scripts", []):
        for key in ("js", "css"):
            refs.update(value for value in content_script.get(key, []) if isinstance(value, str))
    for icon_path in manifest.get("icons", {}).values():
        if isinstance(icon_path, str):
            refs.add(icon_path)
    action = manifest.get("action", {})
    if isinstance(action.get("default_popup"), str):
        refs.add(action["default_popup"])
    for icon_path in action.get("default_icon", {}).values():
        if isinstance(icon_path, str):
            refs.add(icon_path)
    return refs


def build_release(output_dir: Path, root: Path = ROOT) -> tuple[Path, Path, int, str]:
    files = load_release_files(root)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    version = manifest.get("version")
    if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
        raise ValueError(f"manifest version is not a stable three-part version: {version!r}")
    missing_refs = manifest_references(manifest) - set(files)
    if missing_refs:
        raise ValueError("manifest references files outside the release allowlist: " + ", ".join(sorted(missing_refs)))

    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / f"great-tab-killer-v{version}.zip"
    sums_path = output_dir / "SHA256SUMS.txt"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
        for entry in files:
            info = zipfile.ZipInfo(entry, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            info.compress_level = 9
            info.flag_bits = 0
            info.extra = b""
            info.comment = b""
            archive.writestr(info, (root / entry).read_bytes())

    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    sums_path.write_text(f"{digest}  {zip_path.name}\n", encoding="ascii", newline="\n")
    return zip_path, sums_path, len(files), digest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    zip_path, sums_path, count, digest = build_release(args.output_dir.resolve())
    print(f"ZIP: {zip_path} ({zip_path.stat().st_size} bytes; {count} files)")
    print(f"SHA256SUMS: {sums_path}")
    print(f"SHA-256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
