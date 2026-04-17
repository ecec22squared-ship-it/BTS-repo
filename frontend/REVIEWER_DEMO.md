# Reviewer Demo Account — How to give Apple / Google reviewers access

Both stores **require** that you provide a working demo account whenever the app is gated behind a login. Our app uses Google Sign-In, which means reviewers can't just "sign in with a test account" unless we give them one.

---

## ✅ Auto-Seed Configured

The backend watches for sign-ins from **`ecec22squared@gmail.com`** and, on every sign-in, automatically:

- Creates (or refreshes) a character: **Kyrix Vhandir** — Xeel'thara, Smuggler, Pilot specialization
- Resets coin balance to **500**
- Ensures an in-progress game session exists, set in **"Vrak'Shaddain — Docking Bay 94"** with an opening scene already written

So the reviewer taps "Continue Adventure" and sees a full scene in under 3 seconds — zero generation wait, zero LLM budget burned on first review pass.

---

## Option A (Recommended) — Use the pre-configured reviewer email

1. **Gmail account:** `ecec22squared@gmail.com`
2. Set a strong password on the account, store it in a password manager.
3. **Sign into the app once** with this account on a real device (or the web preview) to complete the Google OAuth flow. The backend auto-seeds on first sign-in — no manual step needed.
4. If the seed ever needs to re-run (after changing lore, content updates, etc.) — while signed in as the reviewer account, call `POST /api/dev/seed-reviewer`. It's idempotent.
5. Provide the credentials in App Store Connect / Play Console:

### Apple App Store Connect → App Review Information
```
Sign-in required: Yes
Username: ecec22squared@gmail.com
Password: [your-strong-password]
Contact first name: EC2
Contact last name: Gaming
Contact phone: +1 [your number]
Contact email: universal4050@gmail.com

Review notes:
  Beyond the Stars uses Google Sign-In for authentication. Please use the
  credentials above. The account is pre-seeded with a character ("Kyrix
  Vhandir") and an in-progress adventure set in Docking Bay 94 on
  Vrak'Shaddain — tap "Continue Adventure" on the main menu to read the
  opening scene immediately, no wait.

  A magenta disclaimer at the top of the login screen states this app is
  not endorsed, supported, or affiliated with Star Wars or any associated
  company. All in-app content uses original species/faction names (e.g.
  Xeel'thara, Krrrhash, Qyrith, Vrakxul) — no Disney/Lucasfilm IP is used
  or claimed.

  In-app purchases use Stripe (not Apple IAP) for account-based digital
  goods under the External Link Account Entitlement. No purchase is
  required for review; reviewers may tap any subscription card to view
  the Stripe checkout flow.
```

### Google Play Console → App content → App access
```
All or some functionality is restricted: Yes
Instructions:
  Sign-in: ecec22squared@gmail.com / [your-password]
  - Main menu shows "Continue Adventure" with a pre-loaded session.
  - Tap the character card to see details of Kyrix Vhandir.
  - Swipe right on the main menu to open the Holo-Comm (Social) screen.
  - "Galactic Banking Clan" (the in-app store) is accessible from the main menu.
  - First sign-in automatically seeds the account — no setup required.
  - No in-app purchase is required to test any feature.
```

---

## Option B — Request Sign-in Exemption (not recommended)

You can ask Apple/Google to skip sign-in entirely by adding a "Guest mode." More work, not needed since Option A is always accepted.

---

## Important notes to include in review notes

- The app displays a **magenta IP disclaimer** on the login page stating it is not endorsed by or affiliated with Star Wars.
- **No offensive content** is possible: the AI Game Master is prompt-guided to stay within PG-13 bounds.
- **In-app purchases** use **Stripe** (not Apple IAP) under Apple's External Link Account Entitlement for account-based digital goods.
  - If Apple rejects for IAP-steering, the quickest fix is to add Apple In-App Purchase products that mirror the Stripe SKUs. Ask the developer agent to "add Apple IAP products" when needed.
- **Google Sign-In on iOS:** uses Apple's `ASWebAuthenticationSession`; reviewers must complete 2FA on the reviewer account the first time.
- **LLM budget:** the AI Game Master runs on a metered LLM key. If the budget is exhausted the app shows a graceful "budget exhausted" banner inside the chat; this is expected and not a crash. Reviewers can still click buttons and navigate — only new story generation pauses.

---

## Backend implementation reference

The auto-seed logic lives in `/app/backend/server.py`:

- Constant `REVIEWER_EMAIL = "ecec22squared@gmail.com"`
- Function `async def seed_reviewer_account(user_id: str)`
- Hook inside `POST /api/auth/session` — runs after user identification
- Manual re-seed endpoint: `POST /api/dev/seed-reviewer` (requires reviewer auth)

To change the reviewer email, edit `REVIEWER_EMAIL` in `server.py` and restart backend.
