# Apple App Store Connect — App Privacy Questionnaire Answers

Copy/paste these exact answers when you fill out App Store Connect → App Privacy.

---

## ① Data Collection Summary

**"Do you or your third-party partners collect data from this app?"**
→ **Yes**

---

## ② Data Types Collected — check all that apply

### ◽ Contact Info
- ☑️ **Email Address** — from Google Sign-In
- ☑️ **Name** — display name from Google Sign-In
- ☐ Phone Number — no
- ☐ Physical Address — no

### ◽ Identifiers
- ☑️ **User ID** — Google account ID + internal UUID
- ☐ Device ID — no

### ◽ Usage Data
- ☑️ **Product Interaction** — character creation, scenario preferences, session metrics (only used to personalize your own scenarios)
- ☐ Advertising Data — no
- ☐ Other Usage Data — no

### ◽ Diagnostics
- ☑️ **Crash Data** — aggregated server logs only
- ☑️ **Performance Data** — aggregated server logs only
- ☐ Other Diagnostic Data — no

### ◽ User Content
- ☑️ **Other User Content** — character backstories the user writes, gameplay choices
- ☐ Photos or Videos — no
- ☐ Audio Data — no

### ◽ Financial Info
- ☑️ **Purchase History** — via Stripe (tier, amount, transaction ID only; no card data)
- ☐ Credit Info — no (Stripe handles; we never see card)
- ☐ Other Financial Info — no

### ◽ Search History / Browsing History / Sensitive Info / Health / Location / Contacts
- **None** — all unchecked

---

## ③ For EACH Data Type above, answer these 3 sub-questions:

### Email Address, Name, User ID
- **Used for tracking?** 🔴 **No**
- **Linked to user's identity?** 🟢 **Yes**
- **Purposes:** App Functionality ✅ · Authentication ✅

### Product Interaction, Crash Data, Performance Data, Other User Content
- **Used for tracking?** 🔴 **No**
- **Linked to user's identity?** 🟢 **Yes**
- **Purposes:** App Functionality ✅ · Analytics (internal only) ✅

### Purchase History
- **Used for tracking?** 🔴 **No**
- **Linked to user's identity?** 🟢 **Yes**
- **Purposes:** App Functionality ✅

---

## ④ Tracking

**"Does this app use data for tracking purposes?"**
→ **No**

(We don't use IDFA, don't share data with ad networks, don't cross-reference with third-party datasets.)

---

## ⑤ Third-Party Data Sharing

These third-party services receive specific data types:

| Partner | What they receive | Purpose |
| --- | --- | --- |
| **Google Sign-In** | Auth token exchange | Authentication |
| **Stripe** | Purchase amount, tier, user email (tokenized) | Payment processing |
| **Anthropic (via Emergent LLM)** | Current game session context (characters, recent scene) | Generate narrative text |
| **Google AI (Gemini, via Emergent LLM)** | Current game session context | Generate narrative text & images |

We do NOT share data with: advertising networks, data brokers, analytics aggregators, or third-party marketing services.

---

## ⑥ Privacy Nutrition Label Preview

On the App Store listing, users will see:

```
Data Used to Track You: — None—
Data Linked to You:
  • Contact Info (email, name)
  • User Content (game progress, character backstories)
  • Identifiers (user ID)
  • Financial Info (purchase history)
  • Usage Data (product interaction)
  • Diagnostics (crash & performance)
Data Not Linked to You: — None —
```

---

## ⑦ Other App Store Connect Fields

| Field | Value |
| --- | --- |
| Age Rating | 13+ (see `CONTENT_RATING.md`) |
| Category: Primary | Games |
| Category: Secondary | Role Playing |
| Copyright | © 2026 EC² |
| Routing App Coverage File | N/A |
| App Uses Non-Exempt Encryption | **No** (already declared in `app.json`) |
| Made for Kids | **No** |

*Have `PRIVACY_POLICY.md` hosted publicly before filling this out — Apple will want the URL.*
