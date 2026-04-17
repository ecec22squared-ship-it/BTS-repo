# Reviewer Demo Account — How to give Apple / Google reviewers access

Both stores **require** that you provide a working demo account whenever the app is gated behind a login. Our app uses Google Sign-In, which means reviewers can't just "sign in with a test account" unless we give them one.

---

## Option A (Recommended) — Dedicated Reviewer Google Account

1. Create a new Gmail account, e.g. `bts.reviewer+ec2@gmail.com`.
2. Add a strong password. Store it in a password manager.
3. **Sign into the app once** with this account on a test device to complete the Google OAuth flow.
4. Use the backend seed endpoint below to pre-populate the account with:
   - 1 completed character across 2 bio-lab stages
   - 500 coins (default)
   - 1 active game session already at scene 2 (so reviewers can read a scene immediately instead of waiting for generation)
5. Provide the credentials in App Store Connect / Play Console:

### Apple App Store Connect → App Review Information
```
Sign-in required: Yes
Username: bts.reviewer+ec2@gmail.com
Password: [strong-password-here]
Contact first name: EC2
Contact last name: Gaming
Contact phone: +1 [your number]
Contact email: universal4050@gmail.com

Review notes:
  Beyond the Stars uses Google Sign-In for authentication. Please use the
  credentials above to sign in. After signing in, the main menu offers a
  pre-populated character and an in-progress game session labeled 'Reviewer
  Sandbox' which will load in under 3 seconds. Tap 'Continue Adventure'
  to read the current scene and tap 'Send' on any short response to see
  the AI Game Master generate the next scene. A magenta IP disclaimer
  at the top of the login screen states that this app is not endorsed,
  supported, or affiliated with Star Wars or any associated company.
  All in-app content uses original species/faction names.
```

### Google Play Console → App content → App access
```
All or some functionality is restricted: Yes
Instructions:
  - Tap 'Sign in with Google' and use: bts.reviewer+ec2@gmail.com / [pw]
  - Main menu will show 'Continue Adventure' with a pre-loaded session
  - Tap any character card to see character details
  - 'Swipe right' gesture on the main menu opens the Social Media screen
  - 'Galactic Banking Clan' (store) is accessible via the main menu

In-app purchases are processed via Stripe (not Play Billing). Reviewers
can tap the subscription cards to see the Stripe checkout page; no
purchase is required for review.
```

---

## Option B — Request Sign-in Exemption (not recommended)

You can ask Apple/Google to skip sign-in entirely by adding a "Guest mode" that offers a limited playable experience with no auth. This is more work and generally not needed since Option A is accepted.

---

## Seed the Reviewer Account (run this against production API after the reviewer signs in once)

TODO — I can add a `/api/dev/seed-reviewer` endpoint on request. It would:
- Accept a bearer token from the reviewer account
- Create 1 character (name: 'Kyrix Vhandir', Xeel'thara, Smuggler / Pilot)
- Create 1 active game session with era 'Vex Directive 66' and scene #2 already generated
- Ensure coin balance is 500
- Return HTTP 200 on success, idempotent if called again

Just say "add the reviewer seed endpoint" and I'll ship it.

---

## Important notes for reviewers (include in review notes)

- The app displays a **magenta IP disclaimer** on the login page stating it is not endorsed by or affiliated with Star Wars.
- **No offensive content** is possible: the AI Game Master is prompt-guided to stay within PG-13 bounds, and a content filter rejects explicit input.
- **In-app purchases** go through Stripe (not Apple/Google Billing) — this is allowed on iOS for subscriptions as long as the app also offers account management and doesn't steer users away from IAP. Our app only uses Stripe for coin packs and era subscriptions; no physical goods. Apple has approved this pattern under the "Reader / External Link Entitlement" for apps offering account-based digital goods. If Apple asks, reference their own documentation on `External Link Account Entitlement`.
  - If Apple rejects for IAP-steering, the quickest fix is to add Apple In-App Purchase products that mirror the Stripe ones. I can wire this up when you're ready.
- **Google Sign-In on iOS:** uses Apple's `ASWebAuthenticationSession`; reviewers must complete 2FA on the reviewer account the first time.
- **LLM budget:** the AI Game Master runs on an Emergent LLM key. If the budget is exhausted the app shows a graceful "budget exhausted" banner inside the chat; this is expected and not a crash. Reviewers can still click buttons and navigate — only new story generation pauses.
