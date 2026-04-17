"""Phase 2 rebrand — catches Star Wars planet/concept names the first pass missed.

Run after rebrand.py. Targets only the app source directories, NOT the licensing
outreach docs or node_modules.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/app")

# Longer/multi-word phrases first so short words don't cannibalise them.
PHASE2 = [
    # Chiss species + organisation
    ("Chiss Ascendancy", "Chryxi Ascendancy"),
    ("chiss ascendancy", "chryxi ascendancy"),
    ("Chiss Defense Fleet", "Chryxi Defense Fleet"),
    ("chiss defense fleet", "chryxi defense fleet"),
    ("Chiss Space", "Chryxi Territories"),
    ("chiss space", "chryxi territories"),
    ("Chiss", "Chryxi"),
    ("chiss", "chryxi"),
    ("Charric-metal", "Vex-alloy"),
    ("charric-metal", "vex-alloy"),
    ("Charric", "Vex-alloy"),

    # Nightsister / Maz / Black Spire / Spice worlds
    ("Nightsister", "Shadowcoven"),
    ("nightsister", "shadowcoven"),
    ("Maz Kanata's", "Mazhara's"),
    ("Maz Kanata", "Mazhara"),
    ("maz kanata", "mazhara"),
    ("Black Spire Outpost", "Onyx Spire Outpost"),
    ("Black Spire", "Onyx Spire"),
    ("black spire", "onyx spire"),

    # Planet names with descriptors (longer phrases first)
    ("Kessel - Spice Mining World", "Kzz'el - Spice Mining World"),
    ("Ord Mantell - Scrapyard Planet", "Ord Mantyll - Scrapyard Planet"),
    ("Dathomir - Nightsister Domain", "Dathrym - Shadowcoven Domain"),
    ("Lothal - Outer Rim Frontier", "Lorthal - Rim Frontier"),
    ("Florrum - Pirate Haven", "Floxxum - Pirate Haven"),
    ("Takodana - Maz Kanata's Castle", "Tak'odrin - Mazhara's Keep"),
    ("Jakku - Desert Wasteland", "Jhakkar - Desert Wasteland"),
    ("Vandor - Frontier World", "Vhandir - Frontier World"),
    ("Bracca - Ship Breaking Yards", "Bhracca - Ship Breaking Yards"),
    ("Batuu - Black Spire Outpost", "Bhatuu - Onyx Spire Outpost"),

    # Individual planet names
    ("Kessel", "Kzz'el"),
    ("kessel", "kzz'el"),
    ("Ord Mantell", "Ord Mantyll"),
    ("ord mantell", "ord mantyll"),
    ("Dathomir", "Dathrym"),
    ("dathomir", "dathrym"),
    ("Lothal", "Lorthal"),
    ("lothal", "lorthal"),
    ("Florrum", "Floxxum"),
    ("florrum", "floxxum"),
    ("Takodana", "Tak'odrin"),
    ("takodana", "tak'odrin"),
    ("Jakku", "Jhakkar"),
    ("jakku", "jhakkar"),
    ("Vandor", "Vhandir"),
    ("vandor", "vhandir"),
    ("Bracca", "Bhracca"),
    ("bracca", "bhracca"),
    ("Batuu", "Bhatuu"),
    ("batuu", "bhatuu"),
    ("Mandalore", "Vhandalor"),
    ("mandalore", "vhandalor"),
    ("Nal Hutta", "Nal Vzorga"),
    ("nal hutta", "nal vzorga"),
    ("Bespin", "Byssin"),
    ("bespin", "byssin"),
    ("Ilum", "Ylym"),
    ("ilum", "ylym"),
    ("Yavin", "Yyvhen"),
    ("yavin", "yyvhen"),
    ("Kuat", "Kuath"),
    ("kuat", "kuath"),
    ("Byss", "Byzzar"),
    ("byss", "byzzar"),

    # Galactic regions — concrete SW naming
    ("Outer Rim", "The Rim"),
    ("outer rim", "the rim"),
    ("Inner Rim", "Inner Sectors"),
    ("inner rim", "inner sectors"),
    ("Mid Rim", "Middle Sectors"),
    ("mid rim", "middle sectors"),
    ("Deep Core", "Voidcore"),
    ("deep core", "voidcore"),
    ("Core Worlds", "Crown Worlds"),
    ("core worlds", "crown worlds"),
    ("Unknown Regions", "Uncharted Veil"),
    ("unknown regions", "uncharted veil"),
    ("Wild Space", "Wyld Reach"),
    ("wild space", "wyld reach"),
]

SKIP_DIRS = {"node_modules", ".git", ".expo", "__pycache__", ".venv", "venv", ".backup",
             "LICENSING_OUTREACH", "store_assets"}
TARGET_EXTS = {".py", ".tsx", ".ts", ".js", ".jsx", ".json", ".md", ".html"}

SCAN_ROOTS = [
    ROOT / "backend",
    ROOT / "frontend" / "app",
    ROOT / "frontend" / "src",
    ROOT / "frontend" / "scripts",
]
STANDALONE_FILES = [
    ROOT / "frontend" / "app.json",
    ROOT / "frontend" / "STORE_LISTING.md",
    ROOT / "frontend" / "SUBMISSION_CHECKLIST.md",
    ROOT / "frontend" / "PRIVACY_POLICY.md",
]


def should_skip(path):
    return any(skip in path.parts for skip in SKIP_DIRS)


def iter_files():
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if p.is_file() and p.suffix in TARGET_EXTS and not should_skip(p):
                yield p
    for p in STANDALONE_FILES:
        if p.exists():
            yield p


def main():
    total_hits = 0
    files_changed = 0
    for path in iter_files():
        # Skip the rebrand scripts themselves — they contain all the mappings
        if path.name in {"rebrand.py", "rebrand_phase2.py"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue
        original = text
        file_hits = 0
        for old, new in PHASE2:
            if old in text:
                n = text.count(old)
                text = text.replace(old, new)
                file_hits += n
        if file_hits > 0:
            path.write_text(text, encoding="utf-8")
            print(f"  [{file_hits:>4}] {path.relative_to(ROOT)}")
            total_hits += file_hits
            files_changed += 1
    print(f"\nPhase 2 complete — {total_hits} substitutions across {files_changed} files.")

    # Final verification
    print("\n=== Final verification ===")
    suspects = [
        r"\bStar\s*Wars\b", r"\bJedi\b", r"\bSith\b", r"\bWookiees?\b",
        r"\bTwi'?leks?\b", r"\bRodians?\b", r"\bBothans?\b", r"\bMandalorians?\b",
        r"\bKaminoans?\b", r"\bHutts?\b", r"\bEwoks?\b", r"\bOrder\s*66\b",
        r"\bClone\s*Wars\b", r"\bEdge\s*of\s*the\s*Empire\b", r"\bTatooine\b",
        r"\bCoruscant\b", r"\bKashyyyk\b", r"\bRyloth\b", r"\bNar\s*Shaddaa\b",
        r"\bCorellia\b", r"\bAlderaan\b", r"\bEndor\b", r"\bDagobah\b",
        r"\bNaboo\b", r"\bHoth\b", r"\bPalpatine\b", r"\bVader\b",
        r"\bSkywalker\b", r"\bYoda\b", r"\bJabba\b", r"\bChewbacca\b",
        r"\bLeia\b", r"\bKenobi\b", r"\bObi-?Wan\b", r"\bLightsabers?\b",
        r"\bBacta\b", r"\bDroids?\b", r"\bStormtroopers?\b", r"\bDeath\s*Star\b",
        r"\bNew\s*Republic\b", r"\bOld\s*Republic\b", r"\bGalactic\s*Empire\b",
        r"\bSeparatist\b", r"\bStar\s*Destroyer\b", r"\bDarth\s*\w+\b",
        r"\bRevan\b", r"\bKessel\b", r"\bDathomir\b", r"\bLothal\b",
        r"\bJakku\b", r"\bTakodana\b", r"\bBatuu\b", r"\bVandor\b",
        r"\bOrd\s*Mantell\b", r"\bBracca\b", r"\bFlorrum\b", r"\bMandalore\b",
        r"\bChiss\b", r"\bOuter\s*Rim\b", r"\bMid\s*Rim\b", r"\bInner\s*Rim\b",
        r"\bDeep\s*Core\b", r"\bCore\s*Worlds\b", r"\bWild\s*Space\b",
        r"\bUnknown\s*Regions\b", r"\bKuat\b", r"\bByss\b", r"\bNightsister\b",
        r"\bMaz\s*Kanata\b", r"\bBlack\s*Spire\b",
    ]
    compiled = [(re.compile(p, re.IGNORECASE), p) for p in suspects]
    # But allow the in-app disclaimer which must reference "Star Wars"
    ALLOWED_DISCLAIMER_FRAGMENT = "not Endorsed, Supported, or Affiliated with Star Wars"
    leftover = 0
    for path in iter_files():
        if path.name in {"rebrand.py", "rebrand_phase2.py"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue
        for rx, pat in compiled:
            for m in rx.finditer(text):
                # Skip allowed disclaimer
                surrounding = text[max(0, m.start() - 80):m.end() + 80]
                if ALLOWED_DISCLAIMER_FRAGMENT in surrounding:
                    continue
                line_no = text.count("\n", 0, m.start()) + 1
                line = text.splitlines()[line_no - 1].strip()[:110]
                print(f"  LEFTOVER {pat!r:38} {path.relative_to(ROOT)}:{line_no}")
                print(f"           > {line}")
                leftover += 1
    if leftover == 0:
        print("  ✓ CLEAN — no trademarks remain (except the allowed IP disclaimer).")
    else:
        print(f"  ⚠ {leftover} remaining — review above.")
    return 0 if leftover == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
