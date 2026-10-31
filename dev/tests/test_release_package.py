import hashlib
import importlib.util
import json
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "make-release.py"
SPEC = importlib.util.spec_from_file_location("release_builder", SCRIPT)
RELEASE_BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RELEASE_BUILDER)
build_release = RELEASE_BUILDER.build_release
load_release_files = RELEASE_BUILDER.load_release_files
manifest_references = RELEASE_BUILDER.manifest_references


class ReleasePackageTests(unittest.TestCase):
    def build_in_temp(self, directory: Path):
        return build_release(directory, ROOT)

    def test_archive_root_and_contents_match_literal_allowlist(self):
        allowlist = load_release_files(ROOT)
        with tempfile.TemporaryDirectory() as temp:
            zip_path, sums_path, count, digest = self.build_in_temp(Path(temp))
            with zipfile.ZipFile(zip_path) as archive:
                self.assertIsNone(archive.testzip())
                names = archive.namelist()
                self.assertEqual(names, allowlist)
                self.assertIn("manifest.json", names)
                self.assertEqual(names[0], "BRANDING.md")
                self.assertEqual(count, len(allowlist))
                manifest = json.loads(archive.read("manifest.json"))
                self.assertEqual(zip_path.name, f"great-tab-killer-v{manifest['version']}.zip")
                for name in names:
                    lower = name.lower()
                    self.assertFalse(lower.startswith(("dev/", "docs/", "tools/", ".git/", "assets/source/", "tests/")), name)
                    self.assertNotIn("tab_killer_logo", lower, name)
                    self.assertFalse(name.endswith(".zip"), name)
                self.assertTrue(all(info.create_system == 3 for info in archive.infolist()))
                self.assertTrue(all(info.flag_bits == 0 for info in archive.infolist()))
                self.assertTrue(all(not info.extra and not info.comment for info in archive.infolist()))
                self.assertTrue(all(info.compress_type == zipfile.ZIP_DEFLATED for info in archive.infolist()))
                expected_mode = (stat.S_IFREG | 0o644) << 16
                self.assertTrue(all(info.external_attr == expected_mode for info in archive.infolist()))
                self.assertTrue(manifest_references(manifest).issubset(set(names)))
            self.assertEqual(sums_path.read_text(encoding="ascii"), f"{digest}  {zip_path.name}\n")
            self.assertEqual(hashlib.sha256(zip_path.read_bytes()).hexdigest(), digest)

    def test_same_inputs_produce_identical_member_metadata(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_zip, _, _, _ = self.build_in_temp(Path(first))
            second_zip, _, _, _ = self.build_in_temp(Path(second))
            def fingerprint(path):
                with zipfile.ZipFile(path) as archive:
                    return [
                        (info.filename, info.file_size, info.date_time, info.CRC,
                         info.external_attr, info.create_system, info.flag_bits)
                        for info in archive.infolist()
                    ]
            self.assertEqual(fingerprint(first_zip), fingerprint(second_zip))

    def test_zip_uses_fixed_timestamps_sorted_names_and_normalized_permissions(self):
        with tempfile.TemporaryDirectory() as temp:
            zip_path, _, _, _ = self.build_in_temp(Path(temp))
            with zipfile.ZipFile(zip_path) as archive:
                infos = archive.infolist()
                self.assertEqual([info.filename for info in infos], sorted(info.filename for info in infos))
                self.assertTrue(all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in infos))
                self.assertTrue(all((info.external_attr >> 16) & 0o777 == 0o644 for info in infos))


if __name__ == "__main__":
    unittest.main()
