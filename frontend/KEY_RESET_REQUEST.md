# Google Play — Upload Key Reset Request (READY TO SUBMIT)

> **Status:** Certificate extracted, build pipeline ready. You can submit this **right now**.
> **Package:** `com.ecsquaredgaming.beyondthestars`
> **App:** Beyond the Stars
> **Developer:** EC² · universal4050@gmail.com

---

## 🎯 What This Does

You're asking Google Play to **replace the locked upload key** for your `Beyond the Stars` listing.

| Key | SHA1 | Status |
|---|---|---|
| **Current locked upload key** (lost) | `6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1` | ❌ No longer accessible |
| **New upload key** (EAS-managed) | `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5` | ✅ Active, used by GitHub Actions build |

After Google approves (~1–3 business days), all our GitHub-Actions-built AABs will be accepted by Play Console with zero further changes.

---

## 📎 STEP 1 — Grab the Certificate File

The PEM file is already committed at:
```
C:\Users\Neutrano\Documents\BTS-repo\upload_certificate.pem
```

After your next `git pull`, just open that file. You'll attach it to Google's form.

> **Contents preview:**
> ```
> -----BEGIN CERTIFICATE-----
> MIIDKTCCAhGgAwIBAgIIRDNiolH/RxQwDQYJKoZIhvcNAQELBQAwQjEJMAcGA1UE
> ... (truncated, 1155 bytes total)
> -----END CERTIFICATE-----
> ```

---

## 🌐 STEP 2 — Open Google's Form

👉 **https://support.google.com/googleplay/android-developer/contact/key**

Fill in the form fields:

| Field | Value |
|---|---|
| **Email** | universal4050@gmail.com |
| **Developer account name** | EC² |
| **Package name** | `com.ecsquaredgaming.beyondthestars` |
| **App name** | Beyond the Stars |
| **Number of apps affected** | 1 |
| **Reason for request** | *(paste the script in Step 3 below)* |
| **Upload certificate (attach file)** | `upload_certificate.pem` (from Step 1) |
| **Confirmation checkboxes** | ☑ All applicable |

---

## ✍️ STEP 3 — Justification Script (copy-paste into form)

```
Hello Google Play Trust & Safety team,

I am the registered developer of "Beyond the Stars"
(package name: com.ecsquaredgaming.beyondthestars), published
under the account universal4050@gmail.com / EC².

I am submitting an upload key reset request because the
original upload key used for the previous closed-testing
release of this title is no longer accessible. The
fingerprint of that original (lost) upload key is:

  SHA1: 6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1

I have generated a new upload keystore — managed by
Expo Application Services (EAS) — with the following
fingerprint:

  SHA1:   BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5
  SHA256: 75:87:97:A1:F6:57:A0:67:58:6B:9E:76:C2:CE:48:EB:B6:E6:AE:1D:86:8A:DD:73:19:70:C9:10:73:BE:E4:F9

The PEM-encoded upload certificate is attached as
`upload_certificate.pem`. Please register this as the
authoritative upload key for `com.ecsquaredgaming.beyondthestars`
going forward.

I confirm:
  ✓ I retain full control of the developer account
  ✓ The new upload key is securely stored
  ✓ The package name will NOT change
  ✓ Play App Signing remains enabled — end-user APK
    delivery and app integrity are unaffected
  ✓ I am the sole authorised submitter for this title
  ✓ This is a non-malicious operational request related
    to key loss, not an account transfer or impersonation

Please contact me at universal4050@gmail.com or via the
Play Console messaging center if any additional
verification is required.

Thank you very much for your time and assistance.

Best regards,
EC²
Beyond the Stars
universal4050@gmail.com
```

---

## 📤 STEP 4 — Submit & Wait

- **Typical response time:** 24–72 business hours
- Google replies via email to `universal4050@gmail.com`
- You may receive a follow-up asking to confirm identity (sometimes a screenshot of Play Console while logged in)

---

## ✅ STEP 5 — After Approval

1. **Re-trigger the GitHub Actions workflow** (or I can do it for you):
   - https://github.com/ecec22squared-ship-it/BTS-repo/actions → Run workflow
2. Download the new AAB artifact (signed with `BF:17:03:44…`)
3. Upload to Play Console → Closed Testing → Create new release
4. ✅ Play Console accepts it (because the upload key matches)

---

## 🆘 If Google Denies / Asks for More Info

Most common follow-up: "Can you confirm you still control the developer account?" — just reply with a screenshot of your Play Console (logged in, showing the Beyond the Stars listing).

Less common: "Can you provide the original upload certificate fingerprint?" — you already have it: `SHA1: 6B:2F:46:87…` (in your justification text above).

---

## 📎 Reference

| Item | Value |
|---|---|
| Developer | EC² |
| Email | universal4050@gmail.com |
| Package | `com.ecsquaredgaming.beyondthestars` |
| **Lost upload key SHA1** | `6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1` |
| **New upload key SHA1** | `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5` |
| New upload key SHA256 | `75:87:97:A1:F6:57:A0:67:58:6B:9E:76:C2:CE:48:EB:B6:E6:AE:1D:86:8A:DD:73:19:70:C9:10:73:BE:E4:F9` |
| Valid from | 2026-05-08 01:52 UTC |
| Valid to | 2053-09-23 01:52 UTC (27 years) |
| Form URL | https://support.google.com/googleplay/android-developer/contact/key |
| Cert file | `upload_certificate.pem` (in repo root) |
