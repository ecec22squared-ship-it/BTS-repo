# Google Play — Upload Key Reset Request Kit

> **Package:** `com.ecsquaredgaming.beyondthestars`
> **App:** Beyond the Stars
> **Developer:** EC² · universal4050@gmail.com
> **Reason:** Existing upload key inaccessible; new EAS-managed keystore generated for the v1.0.0 (versionCode 2) stable release.

---

## 📋 What Google Needs

Google requires **two artifacts** to approve an upload-key reset:

1. **The new upload certificate** in PEM format (`upload_certificate.pem`)
2. **A short justification** explaining why the original upload key is unavailable

That's it. They do NOT need the private key. The new cert is what they pin going forward.

---

## 🛠️ STEP 1 — Extract the New Upload Certificate from EAS

Run these commands on your **Windows PC** inside the project directory:

### Option A — Easiest (uses EAS CLI directly)

```bash
cd path\to\beyond-the-stars
eas credentials -p android
```

> ⚠️ In EAS CLI 18.x there is **no `--profile` flag** on the `credentials` command. The profile is chosen inside the interactive menu.

Menu navigation (arrows + Enter):
1. **Select build profile** → choose **`production`**
2. **What do you want to do?** → choose **`Keystore: Manage everything needed to build your project`**
3. **Keystore actions** → choose **`Download existing keystore`**
   *(If you only see "Set up a new keystore" + "Use an existing keystore", that means EAS doesn't have one on file yet for production. In that case run a quick `eas build --profile production --no-wait` first so EAS generates one, then come back to this menu.)*
4. EAS writes `keystore.jks` to your current folder and prints:
   - **Keystore password**
   - **Key alias**
   - **Key password**
   
   👉 **Copy these three values** — you need them in Option B below.

### Option B — Direct PEM extraction from the downloaded keystore

Once you have `keystore.jks` from Step A, extract the PEM:

```bash
keytool -export -rfc ^
  -alias <ALIAS_FROM_EAS_OUTPUT> ^
  -file upload_certificate.pem ^
  -keystore keystore.jks ^
  -storepass <KEYSTORE_PASSWORD_FROM_EAS>
```

> EAS will print the alias and password when you view the keystore. Typical EAS-generated alias looks like `87ab23cd...` (random hex).

**Verify the PEM**:
```bash
keytool -printcert -file upload_certificate.pem
```

Confirm the SHA1 matches `6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1` ✅

You now have the file Google needs: **`upload_certificate.pem`**.

---

## 🌐 STEP 2 — Submit the Reset Request to Google

### 2a. Open the official form

👉 https://support.google.com/googleplay/android-developer/contact/key

(You can also reach it via: **Play Console → Setup → App integrity → App signing → Request upload key reset**.)

### 2b. Fill out the form

| Field | Value |
|---|---|
| **Developer account email** | universal4050@gmail.com |
| **App name** | Beyond the Stars |
| **Package name** | com.ecsquaredgaming.beyondthestars |
| **Reason for request** | *(paste the script from STEP 3 below)* |
| **New upload certificate (PEM)** | *(attach `upload_certificate.pem`)* |
| **Number of apps affected** | 1 |
| **Confirmation checkbox** | ☑ I understand my new upload key will replace the previous one |

---

## ✍️ STEP 3 — Pre-Written Justification (paste into "Reason" field)

> Copy everything between the lines below and paste it into the form's "Reason for request" / "Additional details" field. Edit only the bracketed `[…]` parts if needed.

```
─────────────────────────────────────────────────────────
Subject: Upload Key Reset Request — Beyond the Stars
        (com.ecsquaredgaming.beyondthestars)

Hello Google Play Trust & Safety team,

I am the registered developer of "Beyond the Stars"
(package name: com.ecsquaredgaming.beyondthestars), published
under the developer account universal4050@gmail.com / EC².

I am submitting a new build (version 1.0.0, versionCode 2) of
this title for an upcoming closed-testing track refresh. The
previous closed-testing release was signed with upload key
SHA1: BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5
which is no longer accessible to me. All efforts to recover
the original keystore have been exhausted.

For the new release I have generated a fresh upload keystore,
managed by Expo Application Services (EAS) Build, with the
following fingerprint:

  SHA1:   6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1
  SHA256: (auto-included in attached PEM)

The new upload certificate (PEM-encoded) is attached as
`upload_certificate.pem`. This is the certificate I am
requesting Google Play register as the authoritative upload
key for `com.ecsquaredgaming.beyondthestars`.

This is a non-malicious operational request related to a key
loss. The app has not been transferred, sold, or impersonated.
Play App Signing remains enabled on this title, so end-user
delivery and app integrity are unaffected.

I confirm:
  ✓ I retain full control of the developer account
  ✓ The new upload key is securely stored
  ✓ The package name will NOT change
  ✓ The Play App Signing key (managed by Google) is unchanged
  ✓ I am the sole authorised submitter for this title

If any additional verification is required, please contact me
at universal4050@gmail.com or via the Play Console messaging
center.

Thank you very much for your time and assistance.

Best regards,
EC²
Beyond the Stars
universal4050@gmail.com
─────────────────────────────────────────────────────────
```

---

## 📤 STEP 4 — Submit & Wait

- **Typical turnaround:** 24–72 business hours.
- Google will reply via email to `universal4050@gmail.com`.
- Once approved, the new SHA1 (`6B:2F:46:87…`) becomes your authoritative upload key.
- You can then upload the AAB you already built (`Build ID: c6a87f7e-1148-4db9-a967-a524c5ca7789`) — **no rebuild needed**.

---

## ✅ Post-Approval Checklist (do these in order)

1. **Receive Google's approval email** — it will confirm activation timestamp.
2. **Play Console → Production → Create new release** (or Closed Testing → Manage track).
3. **Upload your existing AAB** (`Build ID: c6a87f7e-1148-4db9-a967-a524c5ca7789`).
   - It should be accepted now that the upload key matches.
4. Add release notes from `STORE_LISTING.md` → "What's New (v1.0.0 build 2)" section.
5. Submit for review.
6. **(Firebase parallel task)** Register the new SHA1 `6B:2F:46:87…` in:
   - Firebase Console → Project Settings → Your Android app → SHA certificate fingerprints
   - Google Cloud Console → APIs & Services → Credentials → Your Android OAuth Client → Edit → add SHA1
   - *(This is needed for Google Sign-In to keep working on prod-signed builds. Already done on EAS preview, but production needs it too.)*

---

## 🆘 If Google Denies the Request

Rare, but possible if they can't verify identity. Fallback options in priority order:

1. **Reply to their email with additional proof** (developer account screenshot, EAS build URL showing the same project owner)
2. **Re-submit using Path B** (Play Console in-product "Request key reset" — slightly different routing, same outcome)
3. **Pivot to new package name** (`com.ecsquaredgaming.bts` or similar) and create a fresh listing — code changes already scoped in earlier conversation

---

## 📎 Quick-Reference: Files & Fingerprints

| Item | Value |
|---|---|
| EAS Build ID | `c6a87f7e-1148-4db9-a967-a524c5ca7789` |
| EAS Project ID | `ff6fa9e8-b967-4307-aee6-099524b4eb72` |
| Package | `com.ecsquaredgaming.beyondthestars` |
| Old upload SHA1 | `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5` |
| **New upload SHA1** | **`6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1`** |
| New cert file (you generate) | `upload_certificate.pem` |
| Developer email | universal4050@gmail.com |
