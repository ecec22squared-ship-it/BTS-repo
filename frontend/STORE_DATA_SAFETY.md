# Google Play Console — Data Safety Form Answers

Copy/paste into Play Console → App content → Data safety.

---

## Section 1: Data Collection & Security

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS everywhere) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (via email to universal4050@gmail.com) |

---

## Section 2: Data Types — Declare each data type

### Personal Info
- **Email address** — Collected ✅, Shared ❌
  - Optional: No (required for Google Sign-In)
  - Purpose: App functionality, Account management
- **Name** — Collected ✅, Shared ❌
  - Optional: No
  - Purpose: App functionality, Account management
- **User IDs** — Collected ✅, Shared ❌
  - Purpose: App functionality, Account management, Fraud prevention & security
- Address, Phone, Race/Ethnicity, Political/Religious beliefs, Sexual orientation, Other personal info — **Not collected**

### Financial Info
- **Purchase history** — Collected ✅, Shared ❌
  - Optional: No (required to process subscriptions)
  - Purpose: App functionality, Purchases
- Credit/debit card, Bank info, Other financial info — **Not collected** (Stripe handles; we never receive)

### Location, Web Browsing, Contacts, Calendar, SMS, Health & Fitness, Photos & Videos, Audio
- **None collected**

### App Activity
- **App interactions** — Collected ✅, Shared ❌
  - Purpose: App functionality, Personalization, Analytics (internal)
- **Other user-generated content** — Collected ✅, Shared ❌
  - Examples: character names, backstories, gameplay choices
  - Purpose: App functionality
- **In-app search history** — Not collected
- **Installed apps** — Not collected
- **Other actions** — Not collected

### App Info & Performance
- **Crash logs** — Collected ✅, Shared ❌
  - Purpose: Analytics
- **Diagnostics** — Collected ✅, Shared ❌
  - Purpose: Analytics
- **Other app performance data** — Not collected

### Device/Other Identifiers
- **Device or other IDs** — **Not collected** (we rely on Google account ID only)

---

## Section 3: Third-Party Partners

Declare only services that receive user data:

| Partner | Data sent | Purpose | Is user data shared? |
| --- | --- | --- | --- |
| Google Sign-In | Auth tokens, email, name | Account management | No (auth only) |
| Stripe | Amount, tier, tokenized user ID | Purchases | No (payment processing only) |
| Anthropic & Google AI (via Emergent) | Game session context (current scene, character data) | App functionality (AI narrative) | No (one-directional, under Anthropic/Google's privacy policies) |

**No ads networks. No analytics aggregators. No data brokers.**

---

## Section 4: Google Play Policies Self-Attestations

| Item | Answer |
| --- | --- |
| App contains ads? | **No** |
| App uses deceptive behavior? | **No** |
| App contains real-money gambling? | **No** |
| App contains user-generated content? | **Yes** (character backstories, text input during gameplay) |
| App contains financial features? | **Yes** (paid subscriptions + coin packs via Stripe) |
| Target audience & content — Target age group? | **13 and older** |
| App appeals to children? | **No** (narrative RPG with mature themes like war & conflict) |
| News app? | **No** |
| COVID-19 app? | **No** |

---

## Section 5: Required URLs

| Field | Value |
| --- | --- |
| Privacy Policy URL | **[Your hosted URL of `privacy-policy.html`]** |
| Data deletion URL/method | Email: `universal4050@gmail.com` (described in Privacy Policy § 5) |

---

## Section 6: Resulting Data-Safety Card (what users will see on the Play Store)

```
Data privacy
• No data shared with third parties  Learn more
• Data is encrypted in transit
• You can request that data be deleted

This app may collect these data types:
  Personal info: Name, Email address, User IDs
  Financial info: Purchase history
  App activity: App interactions, Other user-generated content
  App info and performance: Crash logs, Diagnostics
```

That's your Play Store data-safety card. Clean and reassuring to users.
