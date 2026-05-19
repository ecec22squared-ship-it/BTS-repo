# GitHub Actions — Signed AAB Build Guide

> Build a Play-Store-ready signed AAB on GitHub's free runners using the existing EAS upload keystore (SHA1 `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5`).
>
> **Cost:** Free (GitHub Actions free tier = 2,000 min/month; one build ≈ 20 min).
> **Output:** Signed `app-release.aab` uploadable directly to Google Play Console.

---

## 🗂️ What's already in place

| File | Purpose |
|---|---|
| `.github/workflows/android-release.yml` | The workflow (already committed) |
| `app.json` | `versionCode` bumped to **3** to avoid duplicate-version rejection |
| `google-services.json` | Copied into the native android project during build |

---

## ✅ Pre-Flight Checklist

You'll need:
- [ ] EAS keystore file (`.jks`) downloaded to your Windows PC
- [ ] Keystore password, key alias, key password (from EAS)
- [ ] GitHub repo admin access for `BTS-repo`
- [ ] All 9 `EXPO_PUBLIC_*` env values (already in `eas.json`, just need to copy)

---

## 📦 STEP 1 — Download the EAS Keystore (Windows PC)

```bash
cd path\to\BTS-repo
eas credentials -p android
```

In the menu:
1. **Select build profile** → `production`
2. **What do you want to do?** → `Keystore: Manage everything needed to build your project`
3. **Keystore actions** → `Download existing keystore`

EAS writes `keystore.jks` to the current folder **and prints**:
```
Keystore password:    <COPY THIS>
Key alias:            47bbbc7c988c9dccdd64575931d7ac6b
Key password:         <COPY THIS>
```

📌 **Save all 3 values** somewhere safe (password manager) — you'll paste them into GitHub secrets next.

---

## 🔐 STEP 2 — Convert Keystore to Base64

In **PowerShell**:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("keystore.jks")) | Set-Clipboard
```

The base64 string is now on your clipboard, ready to paste as a GitHub secret.

*(If you prefer a file: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("keystore.jks")) | Out-File keystore.b64.txt -Encoding ascii`)*

---

## 🔑 STEP 3 — Add GitHub Secrets

Open: https://github.com/ecec22squared-ship-it/BTS-repo/settings/secrets/actions

Click **"New repository secret"** for each row below:

### A) Signing secrets (4 secrets)

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | paste from clipboard (Step 2) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password from Step 1 |
| `ANDROID_KEY_ALIAS` | `47bbbc7c988c9dccdd64575931d7ac6b` |
| `ANDROID_KEY_PASSWORD` | key password from Step 1 |

### B) Expo public env secrets (9 secrets — copy from `eas.json` production block)

| Secret name | Value |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | `https://game-deploy-kit.preview.emergentagent.com` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | `AIzaSyCirclfbeqfYdkYygRZc4ReFgazGDi2RPo` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `beyond-the-stars-4a570.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `beyond-the-stars-4a570` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `beyond-the-stars-4a570.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `81238382322` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `1:81238382322:android:6de9c6ab0cb42bf051626b` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `81238382322-8ns9rd022tc5qeov904gl3e0791m61bg.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | `81238382322-11lopviucaackjoh3d5kus89hn0ud4ee.apps.googleusercontent.com` |

> **Total: 13 secrets**

---

## 🚀 STEP 4 — Run the Build

Two ways to trigger:

### Option A — Manual (recommended for first run)

1. Open: https://github.com/ecec22squared-ship-it/BTS-repo/actions
2. Left sidebar → **"Android Release Build (AAB)"**
3. Top-right → **"Run workflow"** → branch `main` → **Run workflow**
4. Wait ~15–20 minutes. ☕

### Option B — Tag push (for future releases)

```bash
git tag v1.0.0-build3
git push origin v1.0.0-build3
```

Bonus: tag pushes also create a GitHub Release with the AAB attached.

---

## 📥 STEP 5 — Download the AAB

When the workflow finishes ✅:
1. Click the completed workflow run.
2. Scroll to bottom → **Artifacts** section → click **`app-release-aab`** to download.
3. Unzip → you have `app-release.aab` ready to upload to Play Console.

The workflow log will also print the AAB's signing cert — verify it shows:
```
SHA1: BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5
```
✅ This matches what Play Console expects.

---

## 📤 STEP 6 — Upload to Play Console

1. Play Console → **Beyond the Stars** → Testing → **Closed testing** → your track
2. **Create new release**
3. Upload the `app-release.aab` from Step 5
4. **Release notes** → paste the "What's New (v1.0.0 build 2)" block from `STORE_LISTING.md`
5. **Review release** → **Start rollout to Closed testing**
6. 🎉 Done.

---

## 🛠️ Troubleshooting

### ❌ Workflow fails on "Decode upload keystore"
- Cause: `ANDROID_KEYSTORE_BASE64` secret has extra whitespace/newlines.
- Fix: Re-copy with `[Convert]::ToBase64String(...) | Set-Clipboard` (it produces a single line).

### ❌ Workflow fails on "Build signed AAB" with `Keystore was tampered with, or password was incorrect`
- Cause: Wrong `ANDROID_KEYSTORE_PASSWORD` or `ANDROID_KEY_PASSWORD`.
- Fix: Re-run `eas credentials -p android` and copy the values again. Watch for typos / trailing spaces.

### ❌ Workflow's AAB has SHA1 `6B:2F:46:87…` (the wrong one)
- Cause: You uploaded the wrong keystore in `ANDROID_KEYSTORE_BASE64`.
- Fix: Confirm you downloaded the `production` profile keystore (not preview/development).

### ❌ Play Console: "Version code 3 has been used in a previous release"
- Cause: You uploaded build 3 already to a different track.
- Fix: Bump `versionCode` to **4** in `app.json` → commit → push → re-run workflow.

### ❌ Workflow fails on `expo prebuild` (asset error)
- Cause: A path in `app.json` references a missing file (icon, splash, etc).
- Fix: Workflow logs will point to the missing file. Add/restore it to `/assets/images/` and re-run.

---

## 🔄 Re-running Future Builds

Each subsequent build:
1. Bump `versionCode` in `app.json` (3 → 4 → 5 …)
2. Optionally bump `version` (`"1.0.0"` → `"1.0.1"`)
3. Commit + push
4. Trigger workflow (manual or tag push)

The signing secrets stay in place forever — you only set them once.

---

## 📊 Cost Tracking

| Resource | Usage per build | Free tier |
|---|---|---|
| GitHub Actions (Linux runner) | ~20 min | 2,000 min/month |
| Storage (AAB artifact, 30 days) | ~100 MB | 500 MB |

You can comfortably run **~100 builds/month** for free.

---

## 🔒 Security Notes

- The `.jks` keystore is **never committed** to the repo — it lives only as a GitHub secret + on your local PC.
- The `EXPO_PUBLIC_*` values are not sensitive (Expo bundles them into the client app anyway). They're in secrets just for convenience.
- The keystore download from EAS is **the only copy you should ever distribute**. If your PC dies, you can redownload via `eas credentials -p android` (EAS keeps it server-side until you explicitly delete).

---

## 📎 Quick Reference

| Item | Value |
|---|---|
| Repo | https://github.com/ecec22squared-ship-it/BTS-repo |
| Workflow file | `.github/workflows/android-release.yml` |
| Workflow page | https://github.com/ecec22squared-ship-it/BTS-repo/actions |
| Secrets page | https://github.com/ecec22squared-ship-it/BTS-repo/settings/secrets/actions |
| Target SHA1 | `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5` |
| Package | `com.ecsquaredgaming.beyondthestars` |
| Current versionCode | `3` |
