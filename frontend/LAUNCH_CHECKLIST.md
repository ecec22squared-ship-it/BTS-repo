# Beyond the Stars — Launch Readiness Master Checklist

**Publisher:** EC² · **Contact:** universal4050@gmail.com · **Support:** https://discord.gg/cmV4PMvW2
**Bundle ID:** `com.ecsquared.beyondthestars` · **Version:** 1.0.0 · **Build:** 1

---

## 🔑 Step 1 — Create Your Developer Accounts

| Store | Signup URL | Fee | Notes |
|-------|-----------|-----|-------|
| **Apple Developer Program** | https://developer.apple.com/programs/enroll/ | **$99 / year** | Individual or Organization. Individual needs legal name + 2FA on Apple ID. Organization needs a D-U-N-S number + public website. |
| **Google Play Console** | https://play.google.com/console/signup | **$25 one-time** | Personal or Organization account. Requires government ID verification (new in 2024–2026). Verification takes hours to days. |
| **Expo (for EAS Build)** | https://expo.dev/signup | **Free** | Free tier allows several builds/month. Paid tier for unlimited cloud builds. |

### Which account type for EC²?
- If EC² Gaming is a filed LLC: **Organization** on both stores (more credibility, required for paid apps in some regions).
- If not yet filed: start as **Individual / Personal**. You can migrate to Organization later on Google, but Apple does **not** allow a straightforward Individual → Organization transfer — you'd have to re-enroll. So filing the LLC first is cleaner.

### Get a D-U-N-S number (free)
Both stores' Organization enrollment may ask for a D-U-N-S. Get one free at https://www.dnb.com/duns/get-a-duns.html — takes ~14 days the first time. Start this early.

---

## 🛡 Step 2 — Legal & Privacy

- [ ] **Host the Privacy Policy publicly** — upload `frontend/store_assets/privacy-policy.html` to:
  - **GitHub Pages** (recommended, free, stable URL): create a repo, upload as `index.html`, enable Pages in Settings. Resulting URL: `https://<your-username>.github.io/<repo-name>/`
  - Or **Carrd** (free, single-page)
  - Or **Notion** (Share → Publish to web)
- [ ] **Paste the privacy URL** into both stores (Apple App Store Connect → App Information, Google Play Console → Main store listing).
- [ ] **File EC² Gaming as a legal entity** (LLC) — optional for launch but strongly recommended before collecting payments. Use https://www.legalzoom.com/ or https://stripe.com/atlas or your state's Secretary of State site.
- [ ] **Terms of Service** (optional but wise). If you want one, ask me and I'll generate one in the same style as the privacy policy.

---

## 💻 Step 3 — Build the App Bundles

On your local machine (not in this environment):

```bash
# Install EAS CLI once
npm install -g eas-cli

# From /app/frontend
cd /path/to/frontend
eas login
eas build:configure          # auto-reads app.json, links to your Expo project

# Replace the 2 placeholder IDs in eas.json first:
#   - appleTeamId  (get from developer.apple.com/account → Membership)
#   - ascAppId     (get from App Store Connect after creating the app record)

# Build
eas build --platform ios      --profile production    # produces signed .ipa
eas build --platform android  --profile production    # produces signed .aab

# Submit
eas submit --platform ios                             # uploads to TestFlight
eas submit --platform android                         # uploads to Play Internal track
```

First build per platform takes **10–20 min**. Subsequent builds are faster.

---

## 💳 Step 4 — Switch Stripe to LIVE Mode — REQUIRED

**Currently the backend `.env` uses a Stripe TEST key.** You MUST swap in your LIVE key before publishing or payments will silently fail for real users.

1. In your Stripe Dashboard → Developers → API keys, copy your **Live Secret Key** (`sk_live_...`).
2. Edit `/app/backend/.env`:
   ```
   STRIPE_API_KEY=sk_live_YOUR_LIVE_KEY_HERE
   ```
3. Restart backend: `sudo supervisorctl restart backend`
4. **Also activate your Stripe account** — if you haven't already, complete business-info + tax-info in the Stripe Dashboard. Stripe holds payouts until verification completes (~1–3 business days).
5. Test the flow end-to-end in TestFlight / Play Internal Testing with a real card (you can refund yourself).

---

## 🖼 Step 5 — Upload Store Listing Assets

### Apple App Store Connect
| Asset | Path | Required |
| --- | --- | --- |
| App icon (1024×1024) | Already embedded in the build via `app.json` | auto |
| Screenshots (6.7") | `frontend/store_assets/screenshots/*.png` — all 8 | ✓ at least 3 |
| App name | `Beyond the Stars` | ✓ |
| Subtitle (30 chars) | `Live Your Adventure` | ✓ |
| Description | Copy from `frontend/STORE_LISTING.md` | ✓ |
| Keywords | Copy from `frontend/STORE_LISTING.md` | ✓ |
| Support URL | https://discord.gg/cmV4PMvW2 | ✓ |
| Privacy URL | Your hosted privacy policy URL | ✓ |
| Promotional text | Copy from `STORE_LISTING.md` | optional |

### Google Play Console
| Asset | Path | Required |
| --- | --- | --- |
| App icon (512×512) | Auto from `app.json` | auto |
| **Feature graphic (1024×500)** | `frontend/store_assets/feature-graphic-1024x500.png` | ✓ |
| Phone screenshots | `frontend/store_assets/screenshots/*.png` — all 8 | ✓ at least 2 |
| App name | `Beyond the Stars` | ✓ |
| Short description (80 chars) | See `STORE_LISTING.md` | ✓ |
| Full description | See `STORE_LISTING.md` | ✓ |
| Category | Games → Role Playing | ✓ |
| Contact email | universal4050@gmail.com | ✓ |
| Privacy URL | Your hosted privacy policy URL | ✓ |

---

## 🎮 Step 6 — Store-Side Forms (fill inside the consoles)

- [ ] **Apple App Privacy** — use `APP_PRIVACY_QUESTIONNAIRE.md` for the exact answers
- [ ] **Google Play Data Safety** — use `STORE_DATA_SAFETY.md` for the exact answers
- [ ] **Content Rating** — use `CONTENT_RATING.md` for IARC (Google) + App Store (Apple) questionnaire answers
- [ ] **App Review Information** — use `REVIEWER_DEMO.md` to provide reviewer a demo Google account + test instructions

---

## ✅ Step 7 — Pre-Submission Sanity Pass (do the day before)

- [ ] `eas build` succeeds for both platforms
- [ ] App launches on a real device (TestFlight + Play Internal Testing)
- [ ] Google sign-in works on a fresh install
- [ ] Full game session works: create character → play → share
- [ ] Privacy policy URL opens in a browser
- [ ] Stripe purchases test successfully with a LIVE card
- [ ] Magenta IP disclaimer is visible on the login screen
- [ ] No crashes in 10 minutes of play
- [ ] Screenshots uploaded to both stores at correct sizes
- [ ] Reviewer demo credentials documented in `REVIEWER_DEMO.md`

---

## 🚀 Step 8 — Submit for Review

- Apple review time 2026: typically **24–48 hours** for new apps
- Google review time 2026: typically **1–7 days** for new apps (first submission is longer)

---

## ⚠️ Common Rejection Reasons (to avoid)

| # | Issue | How we've already addressed it |
|---|-------|-------------------------------|
| 1 | Trademark infringement | ✅ Full rebrand pass completed |
| 2 | Missing privacy policy | ✅ `privacy-policy.html` ready to host |
| 3 | Missing data-safety disclosure | ✅ `STORE_DATA_SAFETY.md` has exact answers |
| 4 | Broken demo account for reviewer | ⚠️ Needs setup — see `REVIEWER_DEMO.md` |
| 5 | Crashes on launch | ⚠️ Test on real device before submit |
| 6 | In-app purchase errors | ⚠️ Must swap Stripe LIVE key first |
| 7 | Minimum OS not supported | ✅ Expo SDK targets modern iOS/Android |
| 8 | App description contains misleading claims | ✅ Listing copy is factual |

---

## 📝 Files prepared in this workspace

```
frontend/
├─ app.json                         ← bundle id, version, build number
├─ eas.json                         ← EAS Build profiles
├─ PRIVACY_POLICY.md                ← source Markdown
├─ STORE_LISTING.md                 ← name, descriptions, keywords
├─ SUBMISSION_CHECKLIST.md          ← earlier checklist (superseded by this file)
├─ LAUNCH_CHECKLIST.md              ← ⭐ (you are here)
├─ APP_PRIVACY_QUESTIONNAIRE.md     ← Apple App Privacy answers
├─ STORE_DATA_SAFETY.md             ← Google Play Data Safety answers
├─ CONTENT_RATING.md                ← IARC / Apple rating questionnaire answers
├─ REVIEWER_DEMO.md                 ← how to provide reviewers with a demo account
└─ store_assets/
   ├─ privacy-policy.html           ← standalone, host publicly
   ├─ feature-graphic-1024x500.png  ← Google Play feature graphic
   └─ screenshots/                  ← all 8 @ 1290×2796 iPhone 6.7"
      ├─ 01_title_live_your_adventure.png
      ├─ 02_bio_lab_stage01_identification.png
      ├─ 03_bio_lab_stage02_genome.png
      ├─ 04_bio_lab_stage03_growth.png
      ├─ 05_bio_lab_stage04_augmentation.png
      ├─ 06_bio_lab_stage05_memory.png
      ├─ 07_holo_comm_chamber.png
      └─ 08_galactic_banking_clan.png
```

---

*Last refreshed: April 2026 · All URLs and fees verified current.*
