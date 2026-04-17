"""Capture 8 store-listing screenshots of Beyond the Stars in iPhone 6.7" size."""
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "store_assets" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 430, "height": 932}  # iPhone 6.7"
BASE = "http://localhost:3000"


def capture(page, path: str):
    page.screenshot(path=str(OUT / path), full_page=False)
    print(f"  saved {path}")


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=3)
        page = ctx.new_page()

        # 01 - Title / Live Your Adventure
        print("01 - Title")
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(4000)
        capture(page, "01_title_live_your_adventure.png")

        # 02 - Bio-lab Stage 01 (Identification Terminal)
        print("02 - Stage 01 Identification")
        page.goto(f"{BASE}/character/create", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(4000)
        capture(page, "02_bio_lab_stage01_identification.png")

        # Fill name
        page.fill('input[placeholder="Enter character name"]', "Ryn Velora")
        page.wait_for_timeout(300)

        # 03 - Stage 02 Genome
        print("03 - Stage 02 Genome")
        page.get_by_text("Next", exact=True).click(force=True)
        page.wait_for_timeout(800)
        capture(page, "03_bio_lab_stage02_genome.png")

        # 04 - Stage 03 Growth
        print("04 - Stage 03 Growth Chamber")
        page.get_by_text("Xeel'thara", exact=True).click(force=True)
        page.wait_for_timeout(300)
        page.get_by_text("Next", exact=True).click(force=True)
        page.wait_for_timeout(800)
        capture(page, "04_bio_lab_stage03_growth.png")

        # 05 - Stage 04 Augmentation
        print("05 - Stage 04 Augmentation")
        try:
            page.get_by_text("Smuggler", exact=True).first.click(force=True)
        except Exception:
            page.get_by_text("Bounty Hunter", exact=True).first.click(force=True)
        page.wait_for_timeout(300)
        page.get_by_text("Next", exact=True).click(force=True)
        page.wait_for_timeout(800)
        capture(page, "05_bio_lab_stage04_augmentation.png")

        # 06 - Stage 05 Memory Imprint
        print("06 - Stage 05 Memory Imprint")
        try:
            page.get_by_text("Pilot", exact=True).first.click(force=True)
        except Exception:
            try:
                page.get_by_text("Scoundrel", exact=True).first.click(force=True)
            except Exception:
                pass
        page.wait_for_timeout(300)
        page.get_by_text("Next", exact=True).click(force=True)
        page.wait_for_timeout(800)
        capture(page, "06_bio_lab_stage05_memory.png")

        # 07 - Holo-Comm Chamber
        print("07 - Holo-Comm Chamber")
        page.goto(f"{BASE}/social", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(4000)
        capture(page, "07_holo_comm_chamber.png")

        # 08 - Galactic Banking Clan
        print("08 - Galactic Banking Clan")
        page.goto(f"{BASE}/store", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(4000)
        capture(page, "08_galactic_banking_clan.png")

        browser.close()
    print(f"\nAll screenshots saved to: {OUT}")


if __name__ == "__main__":
    main()
