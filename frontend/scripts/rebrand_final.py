"""Final cleanup — fresh, clean substitution table (not polluted by corrupted earlier runs).
Targets: PRD.md, test_result.md, backend_test.py, tests/*.py.
"""
import sys
from pathlib import Path

ROOT = Path("/app")

# Clean substitution table, longer phrases first.
TABLE = [
    # Signature phrases
    ("A long time ago in a galaxy far, far away...", "A long time ago in a not so distant galaxy..."),
    ("A long time ago in a galaxy far, far away", "A long time ago in a not so distant galaxy"),
    ("a long time ago in a galaxy far, far away", "a long time ago in a not so distant galaxy"),

    # Package / tech identifiers
    ("com.starwars.edgeoftheempire", "com.ecsquared.beyondthestars"),
    ("starwars", "galactic"),
    ("edgeoftheempire", "beyondthestars"),
    ("edge-of-the-empire", "beyond-the-stars"),
    ("edge_of_the_empire", "beyond_the_stars"),

    # Long phrases
    ("Star Wars: Edge of the Empire", "Galactic: Edge of the Dominion"),
    ("Edge of the Empire", "Edge of the Dominion"),
    ("edge of the empire", "edge of the dominion"),
    ("The Clone Wars", "The Replicant Wars"),
    ("Clone Wars", "Replicant Wars"),
    ("Clone Trooper", "Replicant Sentinel"),
    ("clone trooper", "replicant sentinel"),
    ("Clone troopers", "Replicant sentinels"),
    ("clone troopers", "replicant sentinels"),
    ("the clones", "the sentinels"),
    ("Clones ", "Sentinels "),
    ("Order 66", "Vex Directive 66"),
    ("New Republic", "Neo-Concordat"),
    ("Old Republic", "Elder Concordat"),
    ("Galactic Empire", "Galactic Dominion"),
    ("the Empire", "the Dominion"),
    ("The Empire", "The Dominion"),
    ("Imperial", "Dominion"),
    ("imperial", "dominion"),
    ("Rebel Alliance", "Insurgent Alliance"),
    ("Rebels", "Insurgents"),
    ("Rebel", "Insurgent"),
    ("Stormtrooper", "Dominion Sentinel"),
    ("stormtrooper", "dominion sentinel"),
    ("Death Star", "Vhor'Zul Station"),
    ("death star", "vhor'zul station"),
    ("Jedi Council", "Qyrith Conclave"),
    ("Jedi Order", "Qyrith Order"),
    ("Jedi Knight", "Qyrith Knight"),
    ("Jedi Master", "Qyrith Master"),
    ("Jedi Temple", "Qyrith Temple"),
    ("Sith Lord", "Vrakxul Adept"),
    ("Star Destroyer", "Void Destroyer"),
    ("star destroyer", "void destroyer"),
    ("Millennium Falcon", "Vagrant Zephyr"),
    ("TIE fighter", "Dominion Interceptor"),
    ("X-wing", "Striker-class"),
    ("force-sensitive", "resonance-sensitive"),
    ("Force-sensitive", "Resonance-sensitive"),
    ("Force Sensitive", "Resonance Sensitive"),
    ("the Force", "the Resonance"),
    ("The Force", "The Resonance"),

    # Big "Star Wars" reference
    ("STAR WARS", "GALACTIC"),
    ("Star Wars", "Galactic"),
    ("star wars", "galactic"),

    # Species (plurals first)
    ("Twi'leks", "Xeel'thara"),
    ("Twi'lek", "Xeel'thara"),
    ("twi'leks", "xeel'thara"),
    ("twi'lek", "xeel'thara"),
    ("Twilek", "Xeel'thara"),
    ("Wookiees", "Krrrhash"),
    ("Wookiee", "Krrrhash"),
    ("wookiees", "krrrhash"),
    ("wookiee", "krrrhash"),
    ("Rodians", "Qrin'dex"),
    ("Rodian", "Qrin'dex"),
    ("rodians", "qrin'dex"),
    ("rodian", "qrin'dex"),
    ("Bothans", "Vhothara"),
    ("Bothan", "Vhothara"),
    ("bothans", "vhothara"),
    ("bothan", "vhothara"),
    ("Mandalorians", "Vorthak"),
    ("Mandalorian", "Vorthak"),
    ("mandalorians", "vorthak"),
    ("mandalorian", "vorthak"),
    ("Kaminoans", "Kyrmirr"),
    ("Kaminoan", "Kyrmirr"),
    ("kaminoan", "kyrmirr"),
    ("Hutts", "Vzorg"),
    ("Hutt", "Vzorg"),
    ("hutt", "vzorg"),
    ("Ewoks", "Thrylki"),
    ("Ewok", "Thrylki"),
    ("Trandoshans", "Tryndhazh"),
    ("Trandoshan", "Tryndhazh"),
    ("Zabraks", "Zhabarax"),
    ("Zabrak", "Zhabarax"),
    ("Togrutas", "Tugrytha"),
    ("Togruta", "Tugrytha"),
    ("Mon Calamari", "Mon Karamax"),
    ("Chiss", "Chryxi"),

    # Planets
    ("Tatooine", "Xerath'ul"),
    ("tatooine", "xerath'ul"),
    ("Coruscant", "Corvax Prime"),
    ("coruscant", "corvax prime"),
    ("Kashyyyk", "Ky'rrahsh"),
    ("Ryloth", "Xeel'tharia"),
    ("Nar Shaddaa's", "Vrak'Shaddain's"),
    ("Nar Shaddaa", "Vrak'Shaddain"),
    ("nar shaddaa", "vrak'shaddain"),
    ("Corellia", "Korveth"),
    ("corellia", "korveth"),
    ("Alderaan", "Aldoran"),
    ("Endor", "Enothral"),
    ("Dagobah", "Dagrathul"),
    ("Naboo", "Nebora"),
    ("Mustafar", "Mustavor"),
    ("Hoth", "Vhothar"),
    ("Kessel", "Kzz'el"),
    ("Ord Mantell", "Ord Mantyll"),
    ("Dathomir", "Dathrym"),
    ("Lothal", "Lorthal"),
    ("Florrum", "Floxxum"),
    ("Takodana", "Tak'odrin"),
    ("Jakku", "Jhakkar"),
    ("Vandor", "Vhandir"),
    ("Bracca", "Bhracca"),
    ("Batuu", "Bhatuu"),
    ("Mandalore", "Vhandalor"),
    ("Kuat", "Kuath"),
    ("Byss", "Byzzar"),
    ("Bespin", "Byssin"),
    ("Yavin", "Yyvhen"),

    # Characters
    ("Jabba the Hutt", "Vzorg the Bloated"),
    ("Jabba", "Vzorg"),
    ("Darth Sidious", "Supreme Regent"),
    ("Darth Vader", "Dark Overlord"),
    ("Darth Revan", "Dark Lord Kr'vex"),
    ("Palpatine", "Supreme Regent"),
    ("Vader", "Dark Overlord"),
    ("Skywalker", "Kyr'vel"),
    ("Yoda", "Elder Qyrith"),
    ("Chewbacca", "Krrrhash-One"),
    ("Han Solo", "Ryn Korveth"),
    ("Princess Leia", "Lady Alura"),
    ("Leia", "Alura"),
    ("Obi-Wan Kenobi", "Eldyr Qyr'vhan"),
    ("Obi-Wan", "Eldyr"),
    ("Kenobi", "Qyr'vhan"),
    ("Maz Kanata's", "Mazhara's"),
    ("Maz Kanata", "Mazhara"),

    # Equipment / tech
    ("lightsabers", "kyrix sabres"),
    ("lightsaber", "kyrix sabre"),
    ("Lightsaber", "Kyrix Sabre"),
    ("bacta tank", "vitarex tank"),
    ("Bacta tank", "Vitarex tank"),
    ("bacta", "vitarex"),
    ("Bacta", "Vitarex"),
    ("droids", "servitors"),
    ("Droids", "Servitors"),
    ("droid", "servitor"),
    ("Droid", "Servitor"),
    ("lekku", "lekkra"),
    ("Lekku", "Lekkra"),

    # Factions / government
    ("Jedi's", "Qyrith's"),
    ("Jedi", "Qyrith"),
    ("jedi", "qyrith"),
    ("Sith's", "Vrakxul's"),
    ("Sith", "Vrakxul"),
    ("sith", "vrakxul"),
    ("Separatist", "Fractionist"),
    ("separatist", "fractionist"),
    ("Nightsister", "Shadowcoven"),
    ("Black Spire Outpost", "Onyx Spire Outpost"),
    ("Black Spire", "Onyx Spire"),
    ("Charric-metal", "Vex-alloy"),
    ("Charric", "Vex-alloy"),

    # Galactic regions
    ("Outer Rim", "The Rim"),
    ("outer rim", "the rim"),
    ("Inner Rim", "Inner Sectors"),
    ("Mid Rim", "Middle Sectors"),
    ("Deep Core", "Voidcore"),
    ("Core Worlds", "Crown Worlds"),
    ("Unknown Regions", "Uncharted Veil"),
    ("Wild Space", "Wyld Reach"),
    ("Tingel Arm", "Vhaxen Arm"),
    ("Chiss Space", "Chryxi Territories"),

    # Republic (standalone -> Concordat)
    ("Republic ", "Concordat "),
    ("Republic.", "Concordat."),
    ("Republic,", "Concordat,"),
    ("Republic'", "Concordat'"),
    ("Republic era", "Concordat era"),
]

TARGETS = [
    ROOT / "memory" / "PRD.md",
    ROOT / "test_result.md",
    ROOT / "backend_test.py",
    ROOT / "tests" / "stress_test.py",
    ROOT / "tests" / "cross_player_test.py",
    ROOT / "tests" / "playthrough_test.py",
    ROOT / "tests" / "endurance_test.py",
    ROOT / "tests" / "test_v2_enhancements.py",
    ROOT / "tests" / "test_v3_scene_generation.py",
    ROOT / "backend" / "tests" / "test_v2_enhancements.py",
    ROOT / "backend" / "tests" / "test_v3_scene_generation.py",
]

# Don't accidentally break the intentional disclaimer.
DISCLAIMER_FRAGMENT = "not Endorsed, Supported, or Affiliated with Star Wars"


def rebrand_file(path):
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    original = text

    # Single forward pass — avoid cascade
    for old, new in TABLE:
        if old in text:
            text = text.replace(old, new)

    if text == original:
        return "clean"
    path.write_text(text, encoding="utf-8")
    return "wrote"


for t in TARGETS:
    r = rebrand_file(t)
    if r is None:
        print(f"  SKIP (missing): {t.relative_to(ROOT)}")
    elif r == "wrote":
        print(f"  WROTE: {t.relative_to(ROOT)}")
    else:
        print(f"  CLEAN: {t.relative_to(ROOT)}")
print("Done.")
