"""Rebrand script — remove all Disney/Lucasfilm trademarks from the codebase.

Replaces trademarked terms with original, alien-sounding substitutes.
Runs two passes: forward substitution, then a verification re-scan.

Leaves /app/frontend/LICENSING_OUTREACH/ untouched (intentional references).
Leaves /app/frontend/node_modules/ untouched.
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path("/app")

# --- Substitution table --------------------------------------------------
# Order matters: longer/more-specific phrases are replaced first so short
# words don't cannibalise longer ones (e.g. "Empire" before "Edge of the Dominion"
# would corrupt things; we put the long phrase first).

SUBSTITUTIONS = [
    # ---------- Signature phrases (user-specified) ----------
    ("A long time ago in a not so distant galaxy...", "A long time ago in a not so distant galaxy..."),
    ("A long time ago in a not so distant galaxy", "A long time ago in a not so distant galaxy"),
    ("a long time ago in a not so distant galaxy", "a long time ago in a not so distant galaxy"),

    # ---------- Long multi-word phrases ----------
    ("Edge of the Dominion", "Edge of the Dominion"),
    ("edge of the dominion", "edge of the dominion"),
    ("The Replicant Wars", "The Replicant Wars"),
    ("Replicant Wars", "Replicant Wars"),
    ("replicant wars", "replicant wars"),
    ("Replicant Sentinel", "Replicant Sentinel"),
    ("replicant sentinel", "replicant sentinel"),
    ("Vex Directive 66", "Vex Directive 66"),
    ("vex directive 66", "vex directive 66"),
    ("Neo-Concordat", "Neo-Concordat"),
    ("neo-concordat", "neo-concordat"),
    ("Elder Concordat", "Elder Concordat"),
    ("elder concordat", "elder concordat"),
    ("Galactic Dominion", "Galactic Dominion"),
    ("galactic dominion", "galactic dominion"),
    ("Qyrith Conclave", "Qyrith Conclave"),
    ("qyrith conclave", "qyrith conclave"),
    ("Qyrith Order", "Qyrith Order"),
    ("qyrith order", "qyrith order"),
    ("Qyrith Knight", "Qyrith Knight"),
    ("qyrith knight", "qyrith knight"),
    ("Qyrith Master", "Qyrith Master"),
    ("qyrith master", "qyrith master"),
    ("Vrakxul Adept", "Vrakxul Adept"),
    ("vrakxul adept", "vrakxul adept"),
    ("Vhor'Zul Station", "Vhor'Zul Station"),
    ("vhor'zul station", "vhor'zul station"),
    ("Insurgent Alliance", "Insurgent Alliance"),
    ("insurgent alliance", "insurgent alliance"),
    ("Dominion Sentinel", "Dominion Sentinel"),
    ("dominion sentinel", "dominion sentinel"),
    ("Vagrant Zephyr", "Vagrant Zephyr"),
    ("vagrant zephyr", "vagrant zephyr"),
    ("Dominion Interceptor", "Dominion Interceptor"),
    ("dominion interceptor", "dominion interceptor"),
    ("Striker-class", "Striker-class"),
    ("striker-class", "striker-class"),
    ("resonance-sensitive", "resonance-sensitive"),
    ("Resonance-sensitive", "Resonance-sensitive"),
    ("Resonance Sensitive", "Resonance Sensitive"),
    ("Resonance sensitive", "Resonance sensitive"),
    ("the Resonance", "the Resonance"),
    ("The Resonance", "The Resonance"),
    ("Vzorg the Bloated", "Vzorg the Bloated"),
    ("vzorg the bloated", "vzorg the bloated"),
    ("Supreme Regent", "Supreme Regent"),
    ("Dark Overlord", "Dark Overlord"),
    ("Eldyr Qyr'vhan", "Eldyr Qyr'vhan"),
    ("Eldyr", "Eldyr"),
    ("eldyr", "eldyr"),

    # ---------- "Galactic" -> "Galactic" (user-specified) ----------
    ("GALACTIC", "GALACTIC"),
    ("Galactic", "Galactic"),
    ("galactic", "galactic"),

    # ---------- Species (plurals & apostrophe variants first) ----------
    ("Krrrhash", "Krrrhash"),
    ("Krrrhash", "Krrrhash"),
    ("krrrhash", "krrrhash"),
    ("krrrhash", "krrrhash"),
    ("Xeel'thara", "Xeel'thara"),
    ("Xeel'thara", "Xeel'thara"),
    ("xeel'thara", "xeel'thara"),
    ("xeel'thara", "xeel'thara"),
    ("Xeel'thara", "Xeel'thara"),
    ("Xeel'thara", "Xeel'thara"),
    ("xeel'thara", "xeel'thara"),
    ("xeel'thara", "xeel'thara"),
    ("Qrin'dex", "Qrin'dex"),
    ("Qrin'dex", "Qrin'dex"),
    ("qrin'dex", "qrin'dex"),
    ("qrin'dex", "qrin'dex"),
    ("Vvvvvhothararararara", "Vvvvvhothararararara"),
    ("Vvvvvhothararararara", "Vvvvvhothararararara"),
    ("vvvvvhothararararara", "vvvvvhothararararara"),
    ("vvvvvhothararararara", "vvvvvhothararararara"),
    ("Vorthak", "Vorthak"),
    ("Vorthak", "Vorthak"),
    ("vorthak", "vorthak"),
    ("vorthak", "vorthak"),
    ("Kyrmirr", "Kyrmirr"),
    ("KYRMIRR", "KYRMIRR"),
    ("Kyrmirr", "Kyrmirr"),
    ("KYRMIRR", "KYRMIRR"),
    ("kyrmirr", "kyrmirr"),
    ("Kyrmir", "Kyrmir"),
    ("kyrmir", "kyrmir"),
    ("Vzorg", "Vzorg"),
    ("Vzorg", "Vzorg"),
    ("vzorg", "vzorg"),
    ("vzorg", "vzorg"),
    ("Thrylki", "Thrylki"),
    ("Thrylki", "Thrylki"),
    ("thrylki", "thrylki"),
    ("thrylki", "thrylki"),

    # ---------- Places ----------
    ("Xerath'ul", "Xerath'ul"),
    ("xerath'ul", "xerath'ul"),
    ("Corvax Prime", "Corvax Prime"),
    ("corvax prime", "corvax prime"),
    ("Ky'rrahsh", "Ky'rrahsh"),
    ("ky'rrahsh", "ky'rrahsh"),
    ("Xeel'tharia", "Xeel'tharia"),
    ("xeel'tharia", "xeel'tharia"),
    ("Vrak'Shaddain", "Vrak'Shaddain"),
    ("vrak'shaddain", "vrak'shaddain"),
    ("Korveth", "Korveth"),
    ("korveth", "korveth"),
    ("Aldoran", "Aldoran"),
    ("aldoran", "aldoran"),
    ("Enothral", "Enothral"),
    ("enothral", "enothral"),
    ("Dagrathul", "Dagrathul"),
    ("dagrathul", "dagrathul"),
    ("Nebora", "Nebora"),
    ("nebora", "nebora"),
    ("Mustavor", "Mustavor"),
    ("mustavor", "mustavor"),
    ("Vvvvvhothararararar", "Vvvvvhothararararar"),
    ("vvvvhotharararar", "vvvvvhothararararar"),
    ("Gryn'esis", "Gryn'esis"),
    ("gryn'esis", "gryn'esis"),

    # ---------- Characters / titles ----------
    ("Supreme Regent", "Supreme Regent"),
    ("supreme regent", "supreme regent"),
    ("Supreme Regent", "Supreme Regent"),
    ("supreme regent", "supreme regent"),
    ("Dark Overlord", "Dark Overlord"),
    ("dark overlord", "dark overlord"),
    ("Kyr'vel", "Kyr'vel"),
    ("kyr'vel", "kyr'vel"),
    ("Elder Qyrith", "Elder Qyrith"),
    ("elder qyrith", "elder qyrith"),
    ("Vzorg", "Vzorg"),
    ("vzorg", "vzorg"),
    ("Krrrhash-One", "Krrrhash-One"),
    ("krrrhash-one", "krrrhash-one"),
    ("Ryn Korveth", "Ryn Korveth"),
    ("ryn korveth", "ryn korveth"),
    ("Lady Alura", "Lady Alura"),
    ("Alura Aldoran", "Alura Aldoran"),
    ("Alura", "Alura"),
    ("alura", "alura"),
    ("Qyr'vhan", "Qyr'vhan"),
    ("qyr'vhan", "qyr'vhan"),
    ("Kyr'vel", "Kyr'vel"),

    # ---------- Equipment / tech ----------
    ("kyrix sabres", "kyrix sabres"),
    ("kyrix sabre", "kyrix sabre"),
    ("Kyrix Sabres", "Kyrix Sabres"),
    ("Kyrix Sabre", "Kyrix Sabre"),
    ("vitarex tank", "vitarex tank"),
    ("Vitarex tank", "Vitarex tank"),
    ("vitarex", "vitarex"),
    ("Vitarex", "Vitarex"),
    ("VITAREX", "VITAREX"),
    ("servitors", "servitors"),
    ("Servitors", "Servitors"),
    ("servitor", "servitor"),
    ("Servitor", "Servitor"),
    ("SERVITOR", "SERVITOR"),

    # ---------- Base factions (AFTER phrase replacements) ----------
    ("the Dominion's", "the Dominion's"),
    ("the Dominion", "the Dominion"),
    ("The Dominion", "The Dominion"),
    ("Dominion", "Dominion"),
    ("dominion", "dominion"),
    ("DOMINION", "DOMINION"),
    ("Insurgents", "Insurgents"),
    ("insurgents", "insurgents"),
    ("Insurgent", "Insurgent"),
    ("insurgent", "insurgent"),
    ("Qyrith", "Qyrith"),
    ("qyrith", "qyrith"),
    ("QYRITH", "QYRITH"),
    ("Vrakxul", "Vrakxul"),
    ("vrakxul", "vrakxul"),
    ("VRAKXUL", "VRAKXUL"),
]

# Files / directories to SKIP
SKIP_DIRS = {
    "node_modules",
    ".git",
    ".expo",
    "__pycache__",
    ".venv",
    "venv",
    ".backup",
    "LICENSING_OUTREACH",  # intentionally references Galactic for licensing pitch
    "store_assets",        # privacy-policy.html has disclaimer already, leave as-is
}

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


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return any(skip in parts for skip in SKIP_DIRS)


def iter_target_files():
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if p.is_file() and p.suffix in TARGET_EXTS and not should_skip(p):
                yield p
    for p in STANDALONE_FILES:
        if p.exists():
            yield p


def apply_substitutions(text: str) -> tuple[str, int]:
    total_hits = 0
    for old, new in SUBSTITUTIONS:
        if old in text:
            n = text.count(old)
            text = text.replace(old, new)
            total_hits += n
    return text, total_hits


def pass1_rebrand():
    print("=" * 70)
    print("PASS 1 — Applying substitutions")
    print("=" * 70)
    grand_total = 0
    files_changed = 0
    for path in iter_target_files():
        try:
            original = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue
        updated, hits = apply_substitutions(original)
        if hits > 0:
            path.write_text(updated, encoding="utf-8")
            print(f"  [{hits:>4}] {path.relative_to(ROOT)}")
            grand_total += hits
            files_changed += 1
    print(f"\nPass 1 complete — {grand_total} substitutions across {files_changed} files.\n")
    return grand_total


# Verification: look for any remaining trademarked terms.
SUSPECT_PATTERNS = [
    r"\bStar\s*Wars\b",
    r"\bQyrith\b",
    r"\bVrakxul\b",
    r"\bKrrrhash?\b",
    r"\bTwi'?leks?\b",
    r"\bQrin'dex(s)?\b",
    r"\bVvvvvhothararararara(s)?\b",
    r"\bVorthak(s)?\b",
    r"\bKyrmirr(s)?\b",
    r"\bKyrmir\b",
    r"\bVzorg?\b",
    r"\bThrylki?\b",
    r"\bOrder\s*66\b",
    r"\bClone\s*Wars\b",
    r"\bEdge\s*of\s*the\s*Empire\b",
    r"\bXerath'ul\b",
    r"\bCorvax Prime\b",
    r"\bKy'rrahsh\b",
    r"\bXeel'tharia\b",
    r"\bNar\s*Shaddaa\b",
    r"\bKorveth\b",
    r"\bAldoran\b",
    r"\bEnothral\b",
    r"\bDagrathul\b",
    r"\bNebora\b",
    r"\bVvvvvhothararararar\b",
    r"\bSupreme Regent\b",
    r"\bDark Overlord\b",
    r"\bKyr'vel\b",
    r"\bElder Qyrith\b",
    r"\bVzorg\b",
    r"\bKrrrhash-One\b",
    r"\bAlura\b",
    r"\bQyr'vhan\b",
    r"\bObi-?Wan\b",
    r"\bKyrix Sabres?\b",
    r"\bVitarex\b",
    r"\bServitors?\b",
    r"\bDominion Sentinels?\b",
    r"\bDeath\s*Star\b",
    r"\bMillennium\s*Falcon\b",
    r"\bTIE\s*fighter\b",
    r"\bX-?wing\b",
    r"\bthe\s*Force\b",
    r"\bNew\s*Republic\b",
    r"\bOld\s*Republic\b",
    r"\bGalactic\s*Empire\b",
]


def pass2_verify():
    print("=" * 70)
    print("PASS 2 — Verification re-scan")
    print("=" * 70)
    compiled = [re.compile(p, re.IGNORECASE) for p in SUSPECT_PATTERNS]
    issues = 0
    for path in iter_target_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue
        for rx, pat in zip(compiled, SUSPECT_PATTERNS):
            for m in rx.finditer(text):
                # Skip the word "galactic" in new replacements — it's permitted
                if m.group().lower().strip() in {"galactic"}:
                    continue
                line_no = text.count("\n", 0, m.start()) + 1
                line = text.splitlines()[line_no - 1].strip()[:120]
                print(f"  LEFTOVER {pat!r:40} {path.relative_to(ROOT)}:{line_no}")
                print(f"           > {line}")
                issues += 1
    if issues == 0:
        print("  ✓ Clean — no trademarked terms remain in scanned sources.")
    else:
        print(f"\n  ⚠ {issues} potential leftovers — review above lines manually.")
    print()
    return issues


def main():
    pass1_rebrand()
    remaining = pass2_verify()
    # Third pass: run once more to catch cascaded leftovers (e.g. "qyrith" inside "Insurgent Qyrith")
    print("=" * 70)
    print("PASS 3 — Second application (catches cascaded leftovers)")
    print("=" * 70)
    pass1_rebrand()
    remaining = pass2_verify()
    return 0 if remaining == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
