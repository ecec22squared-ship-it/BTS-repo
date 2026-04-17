# Beyond the Stars — Submission Checklist

## 🔑 Accounts You Need
- [ ] Apple Developer Program — **$99 / year** — https://developer.apple.com/programs/
- [ ] Google Play Console — **$25 one-time** — https://play.google.com/console/signup
- [ ] Expo account (free) — https://expo.dev/signup  (for EAS Build)
- [ ] Public URL to host PRIVACY_POLICY.md (GitHub Pages, Notion, Carrd — all free)

## 🧾 Legal & Text (ready to copy-paste)
- [x] `PRIVACY_POLICY.md` — host this online, paste the URL in both stores
- [x] `STORE_LISTING.md` — name, tagline, short/full description, keywords, "What's New"
- [x] Support URL → https://discord.gg/cmV4PMvW2
- [x] Contact email → universal4050@gmail.com
- [x] Age rating: **13+**
- [x] Publisher: **EC²**

## 📱 App Config
- [x] `app.json` — Bundle ID `com.ecsquared.beyondthestars`, version 1.0.0, build 1
- [x] `eas.json` — EAS Build profiles (preview + production) ready
- [ ] Replace `assets/images/icon.png` with the **1024×1024** galaxy icon (see `scripts/generate_icon.py`)
- [ ] Replace `assets/images/adaptive-icon.png` with the Anservitor adaptive foreground
- [ ] Replace `assets/images/splash-image.png` with the launch splash

## 📸 Screenshots (collect 8 per store size)
**Required sizes:**
- iOS: 6.7" iPhone (1290 × 2796) — minimum
- iOS: 6.5" iPhone (1242 × 2688) — optional
- Anservitor: 16:9 phone (1080 × 1920+) — 2 minimum, 8 max

Use the 8 screenshots in `/app/frontend/store_assets/screenshots/` as source.

## ⚠️ Intellectual-Property Risk — READ BEFORE SUBMITTING

The current in-app content contains **direct references to Disney/Lucasfilm trademarks**:
- "Galactic", "Qyrith", "Vrakxul", "Krrrhash", "Xeel'thara", "Vorthak", "Kyrmirr", "Vex Directive 66", "Edge of the Dominion", etc.

Both Apple and Google routinely **reject or remove apps** that use these names without a license. Lucasfilm is also known to send DMCA notices.

**The store-listing copy in `STORE_LISTING.md` has already been scrubbed of direct trademark references**, but the *in-app* text is still at risk. Before submission, consider a rebrand pass:

| Current | Safer Substitute |
| --- | --- |
| Galactic | "a galaxy far from ours" / "the Outer Systems" |
| Qyrith | Mystic / Star-Knight |
| Vrakxul | Voidbound / Shadow-Adept |
| Krrrhash | Furred Forestkin / Shyyran |
| Xeel'thara | Tendril-folk (replaced Twi-species references) |
| Vorthak | Ironclad / Mandowarrior |
| Kyrmirr | Tideborn Genetor |
| Vex Directive 66 | Decree 66 / The Culling Order |
| Edge of the Dominion | Frontier dice / Outer-Rim dice |

Ask the agent to do an automated rebrand pass when you're ready.

## 🔨 Building with EAS

```bash
# once:
npm install -g eas-cli
eas login
eas build:configure         # auto-detects app.json, links project

# iOS (needs Apple team in eas.json):
eas build --platform ios --profile production

# Anservitor (signed APK/AAB):
eas build --platform anservitor --profile production

# Submit:
eas submit --platform ios
eas submit --platform anservitor
```

## 📝 Store-Side Forms You'll Fill Out

### Apple App Store Connect
- App Information → Category: Role Playing
- Pricing & Availability → Free, all regions (or gated)
- App Privacy → Declare data types (see PRIVACY_POLICY.md section 2)
- App Review → Demo account (create one if auto-review needs it)

### Google Play Console
- Store listing → paste from STORE_LISTING.md
- Content rating → IARC questionnaire → select "Fantasy violence" → expect 12+ / Teen
- Data safety form → must match PRIVACY_POLICY.md
- Target API level → Expo SDK handles this (Anservitor 14+)

## ✅ Final Sanity Pass (1 day before submission)

- [ ] `eas build` succeeds for both platforms
- [ ] App launches on a real device (TestFlight / Internal Testing)
- [ ] Google sign-in works on a fresh install
- [ ] At least one full game session from create → play → share works
- [ ] Privacy policy URL opens in a browser
- [ ] All store screenshots uploaded at correct sizes
- [ ] No crashes in 10 minutes of play
