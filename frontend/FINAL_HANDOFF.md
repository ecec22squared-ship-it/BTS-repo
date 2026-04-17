# 🌌 FINAL HANDOFF — Beyond the Stars Launch Plan

**Everything I could do is done. Here's exactly what's ready — and exactly what only you can do.**

---

## ✅ What's Done In This Workspace (no action needed from you)

### App itself
- [x] Complete rebrand of all Disney/Lucasfilm trademarks — **470+ substitutions, twice-verified**
- [x] Magenta IP disclaimer on load page
- [x] Reviewer-account auto-seed (tested 18/18 assertions, using `ecec22squared@gmail.com`)
- [x] Bundle ID: `com.ecsquared.beyondthestars`
- [x] app.json metadata: EC² publisher, version 1.0.0, build 1, Android permissions scrubbed
- [x] Zero dev/debug artifacts (no `console.log`, `TODO`, or `debugger` left in source)
- [x] Backend healthy: `/api/` returns 200 `{"message":"Beyond the Stars: Galactic Text RPG API","version":"3.0.0"}`

### App-icon & splash assets
- [x] AI-generated 1024×1024 galaxy icon (via Gemini Nano Banana)
- [x] All derivatives regenerated: `icon.png`, `adaptive-icon.png`, `favicon.png`, `splash-image.png`, `splash-icon.png`

### Store-listing docs (paste-in ready)
- [x] `frontend/STORE_LISTING.md` — name, tagline, short/long desc, keywords
- [x] `frontend/APP_PRIVACY_QUESTIONNAIRE.md` — Apple App Privacy answers
- [x] `frontend/STORE_DATA_SAFETY.md` — Google Play Data Safety answers
- [x] `frontend/CONTENT_RATING.md` — IARC + App Store rating answers (expected: ESRB Teen / PEGI 12 / Apple 12+)
- [x] `frontend/REVIEWER_DEMO.md` — exact copy-paste for reviewer-notes field in both consoles
- [x] `frontend/LAUNCH_CHECKLIST.md` — master step-by-step checklist

### Marketing landing site
- [x] `frontend/landing/index.html` — sci-fi alien homepage (animated starfield, immersive text RPG pitch, 6 features, 8 screenshots, community cards, download CTAs, IP disclaimer, footer)
- [x] `frontend/landing/chat.html` — Holo-Comm Chamber subpage (Share Your Adventure cards, Chat With Travelers mock, triple support cards)
- [x] `frontend/landing/styles.css` — Orbitron + Inter fonts, 3-layer parallax stars, glassmorphism panels
- [x] `frontend/landing/terms-of-service.html` — new! hostable alongside privacy policy
- [x] `frontend/landing/privacy-policy.html` — hostable privacy policy
- [x] `frontend/landing/feature-graphic.png` — Google Play feature graphic (1024×500)
- [x] `frontend/landing/icon.png` — app icon (1024×1024)
- [x] `frontend/landing/screenshots/` — all 8 @ 1290×2796 (iPhone 6.7")
- [x] **`frontend/store_assets/beyondthestars-site.zip`** — 9.6 MB one-file upload, ready for GitHub drag-and-drop

### Build configuration
- [x] `frontend/eas.json` — development + preview + production profiles configured
- [x] `frontend/app.json` — bundle IDs, version, build numbers, permissions set

---

## 🔑 What Only You Can Do (ordered by urgency)

### 🚨 Must do before first build

| # | Task | Where | Time |
|---|------|-------|------|
| 1 | **Sign into the app once** with `ecec22squared@gmail.com` to trigger reviewer auto-seed | On your phone via Expo Go or in the web preview | 2 min |
| 2 | **Swap Stripe TEST → LIVE key** in `/app/backend/.env` — currently `sk_test_...` | Stripe Dashboard → Developers → API keys → copy `sk_live_…` | 5 min |
| 3 | Run `sudo supervisorctl restart backend` after swap | Terminal | 10 sec |
| 4 | Complete Stripe account verification (business + tax info) | Stripe Dashboard | 15 min, then 1–3 days of Stripe-side review |

### 🌐 Host the website (single biggest ROI, 5 minutes)

| # | Task | Where | Time |
|---|------|-------|------|
| 5 | Create a new **public** GitHub repository, e.g. `ec2-gaming/beyondthestars-site` | https://github.com/new | 1 min |
| 6 | **Unzip and upload** `frontend/store_assets/beyondthestars-site.zip` to the repo root | GitHub “Add file → Upload files” | 2 min |
| 7 | Repo Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, Folder: **/ (root)** → Save | Github Settings | 1 min |
| 8 | Wait 60 seconds, your URLs become:<br>`https://<your-username>.github.io/beyondthestars-site/` — Marketing URL<br>`https://<your-username>.github.io/beyondthestars-site/privacy-policy.html` — Privacy URL<br>`https://<your-username>.github.io/beyondthestars-site/terms-of-service.html` — Terms URL | — | 1 min |

### 📱 Build & submit the app

On **your local machine** (not possible to run from here):

```bash
git clone <your repo>    # or however you have the frontend locally
cd /path/to/frontend
npm install -g eas-cli
eas login                  # use your Expo account
eas build:configure        # links project to your Expo workspace

# Edit eas.json: replace the two placeholders
#   appleTeamId   → found at developer.apple.com/account → Membership
#   ascAppId      → found in App Store Connect after you create an app record

eas build --platform ios     --profile production
eas build --platform android --profile production

eas submit --platform ios      # uploads to TestFlight
eas submit --platform android  # uploads to Play Internal Testing
```

### 🎬 Create the app records (do in parallel with builds)

#### Apple App Store Connect (https://appstoreconnect.apple.com)
1. My Apps → **+** → New App
2. Name: **Beyond the Stars**, Primary language: English (US), Bundle ID: `com.ecsquared.beyondthestars`, SKU: `BTS-1001`
3. Click into the app → fill sections using `frontend/STORE_LISTING.md`
4. App Privacy → use answers from `frontend/APP_PRIVACY_QUESTIONNAIRE.md`
5. Age Rating → use answers from `frontend/CONTENT_RATING.md`
6. App Review Information → paste reviewer block from `frontend/REVIEWER_DEMO.md`
7. Upload 8 screenshots, paste Marketing URL & Privacy URL

#### Google Play Console (https://play.google.com/console)
1. All apps → **Create app**
2. Name: **Beyond the Stars**, Default language: English (US), Type: App, Free
3. Fill “Set up your app” dashboard left-to-right
4. Data safety → use answers from `frontend/STORE_DATA_SAFETY.md`
5. Content rating → use answers from `frontend/CONTENT_RATING.md`
6. App content → App access → paste reviewer block from `frontend/REVIEWER_DEMO.md`
7. Main store listing → upload 8 screenshots, feature graphic (`feature-graphic.png`), paste descriptions

---

## ❓ Frequently Asked Questions

**Q: Do I need a D-U-N-S number?**
Only if enrolling as an Organization. If you're filing as Individual / Personal, skip it.

**Q: What if Apple rejects because of Stripe-not-IAP?**
Ask me to “add Apple IAP products” — I'll wire up IAP SKUs that mirror the Stripe ones. Apple's External Link Account Entitlement allows our current pattern, but if the reviewer is strict you'd need both.

**Q: Can I change the reviewer email later?**
Yes — edit `REVIEWER_EMAIL` in `/app/backend/server.py` and restart backend.

**Q: What if the LLM budget runs out during review?**
The app shows a graceful notice instead of crashing (already implemented). Reviewers can still navigate all screens, it's just that new scene generation pauses. Top up budget before submitting.

**Q: How long will review take?**
Apple: 24–48 hours typically in 2026. Google: 1–7 days for first submission.

---

## 📂 Document Map

```
/app/frontend/
├─ LAUNCH_CHECKLIST.md              ← master checklist
├─ STORE_LISTING.md                 ← descriptions, keywords, tagline
├─ APP_PRIVACY_QUESTIONNAIRE.md     ← Apple App Privacy answers
├─ STORE_DATA_SAFETY.md             ← Google Play Data Safety answers
├─ CONTENT_RATING.md                ← age-rating questionnaire answers
├─ REVIEWER_DEMO.md                 ← reviewer notes + auto-seed details
├─ PRIVACY_POLICY.md                ← source for privacy-policy.html
├─ SUBMISSION_CHECKLIST.md          ← earlier checklist (superseded by LAUNCH_CHECKLIST)
├─ FINAL_HANDOFF.md                 ← 👈 you are here
├─ eas.json                         ← EAS Build profiles
├─ app.json                         ← bundle id, version, permissions
├─ landing/                        ← two-page marketing site (staged with assets)
│  ├─ index.html
│  ├─ chat.html
│  ├─ terms-of-service.html       ← NEW
│  ├─ privacy-policy.html
│  ├─ styles.css
│  ├─ icon.png
│  ├─ feature-graphic.png
│  └─ screenshots/                ← all 8 @ 1290×2796
└─ store_assets/
   └─ beyondthestars-site.zip     ← 🚀 ONE-FILE UPLOAD, 9.6MB
```

---

## 📞 When things go sideways

Come back and ask:
- “Apple rejected for IAP-steering” → I add Apple IAP SKUs
- “Play rejected for Data Safety mismatch” → I reconcile the form answers with actual behavior
- “Google Sign-In fails on production build” → we check OAuth client ID + redirect URIs
- “Crash reports coming in” → I wire up Sentry / free crash reporting
- “Want to add a Terms of Service acceptance checkbox at sign-up” → trivial frontend change

Good luck with launch. 🌌
