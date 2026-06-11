# Google Play — Upload Key Reset (Self-Serve via Play Console)

> **Status:** Self-serve flow confirmed by Google support (Cody, Play Developer Support). No manual review queue.
> **Wait time:** 48-hour cooldown after submission before the new key activates.
> **Cert ready:** `upload_certificate.pem` is committed in repo root.

---

## ⚡ The 6-Step Path (from Cody's email)

Google's process is now **fully automated inside Play Console**:

| Step | Action |
|---|---|
| 1 | Open Play Console → select **Beyond the Stars** |
| 2 | **Test and release → App integrity** |
| 3 | **Play app signing → Settings** |
| 4 | Click **"Request upload key reset"** |
| 5 | Paste reason (see below) + attach `upload_certificate.pem` |
| 6 | Click **Request** |

Then ⏳ **48-hour buffer** → the new upload key (`BF:17:03:44…`) activates → we trigger the GitHub Actions build → upload AAB.

---

## 📎 Where the PEM File Lives on Your PC

After `git pull origin main`:
```
C:\Users\Neutrano\Documents\BTS-repo\upload_certificate.pem
```

When the Play Console form asks for the PEM, browse to that file and attach it.

---

## ✍️ Reason Text (paste into Step 4's reason field)

Keep it short — Cody confirmed it's now automated, so no need for the long justification. Try this:

```
The original upload key for this app was lost and is no longer
accessible. I have generated a new upload key (PEM attached,
SHA1: BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5)
and am requesting it be registered as the authoritative upload
key going forward. Play App Signing remains enabled; this
affects only the upload process. Package name unchanged.
```

---

## ⏰ 48-Hour Timeline

| Time | What's happening |
|---|---|
| **T+0** | You click Request in Play Console |
| **T+0 to T+48h** | OLD key (`6B:2F:46:87…`) still active — **DON'T upload an AAB during this window** (it would be rejected with old-key expectation) |
| **T+48h** | NEW key (`BF:17:03:44…`) activates — you receive confirmation email |
| **T+48h** | Trigger GitHub Actions build → download AAB → upload to Play Console → ✅ accepted |

---

## 🚀 When the 48 Hours Are Up — Tell Me Three Words

Just say "Google key activated" in chat and I'll:
1. Re-trigger the workflow (`workflow_dispatch` via API)
2. Walk you to the AAB artifact download
3. Help you finalize the Play Console release

---

## ✅ Pre-Reset Checklist (do before clicking Request)

- [ ] Confirm you're logged into Play Console as `universal4050@gmail.com`
- [ ] Verify `upload_certificate.pem` opens correctly (right-click → Open with Notepad) — should show `-----BEGIN CERTIFICATE-----` … `-----END CERTIFICATE-----`
- [ ] No pending AAB uploads in-flight (cancel any drafts in Closed Testing)
- [ ] You have ~5 minutes uninterrupted (the form has multiple confirmations)

---

## 📎 Reference

| Item | Value |
|---|---|
| App | Beyond the Stars |
| Package | `com.ecsquaredgaming.beyondthestars` |
| **Old key SHA1** (lost) | `6B:2F:46:87:1D:35:10:15:36:C0:88:25:66:D7:A8:D4:1B:65:8F:A1` |
| **New key SHA1** (in PEM) | `BF:17:03:44:6E:B7:82:4D:4D:C9:64:8F:CA:41:37:A5:54:5D:47:A5` |
| New key SHA256 | `75:87:97:A1:F6:57:A0:67:58:6B:9E:76:C2:CE:48:EB:B6:E6:AE:1D:86:8A:DD:73:19:70:C9:10:73:BE:E4:F9` |
| Cert file | `upload_certificate.pem` (repo root) |
| Valid until | 2053-09-23 (27 years) |
| Cooldown | 48 hours from submission |
