"""Rebrand the internal-only dev files that weren't shipped but still hold Star Wars refs.
Targets: memory/PRD.md, backend_test.py, test_result.md, app.json description.
Reuses the substitution tables from rebrand.py and rebrand_phase2.py.
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path("/app")

# Load tables from both previous scripts
def load_table(path):
    spec = importlib.util.spec_from_file_location("t", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

t1 = load_table(ROOT / "frontend" / "scripts" / "rebrand.py")
t2 = load_table(ROOT / "frontend" / "scripts" / "rebrand_phase2.py")

# Combined table (phase 1 first so longer phrases go first)
TABLE = list(t1.SUBSTITUTIONS) + list(t2.PHASE2)

# Additional internal-file specific substitutions
EXTRA = [
    ("com.starwars.edgeoftheempire", "com.ecsquared.beyondthestars"),
    ("edge-of-the-empire-rpg", "beyond-the-stars-rpg"),
    ("Star Wars: Edge of the Empire", "Galactic: Edge of the Dominion"),
    ("starwars", "galactic"),
]
TABLE = EXTRA + TABLE

TARGETS = [
    ROOT / "memory" / "PRD.md",
    ROOT / "backend_test.py",
    ROOT / "test_result.md",
    ROOT / "frontend" / "app.json",   # just in case any description still has stale refs
]

DISCLAIMER_GUARD = "not Endorsed, Supported, or Affiliated with Star Wars"


def rebrand_file(path):
    if not path.exists():
        print(f"  SKIP (missing): {path}")
        return 0
    text = path.read_text(encoding="utf-8")
    before = text
    for old, new in TABLE:
        if old in text:
            text = text.replace(old, new)
    # Apply a single pass only (avoid cascade)
    if text != before:
        path.write_text(text, encoding="utf-8")
        diff = sum(1 for _ in range(0))  # noqa
        print(f"  WROTE: {path.relative_to(ROOT)}")
        return 1
    print(f"  CLEAN: {path.relative_to(ROOT)}")
    return 0


for t in TARGETS:
    rebrand_file(t)

print("\nDone.")
