# Beyond the Stars — Marketing Landing Pages

Two-page static site to use as your marketing website URL for the stores.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Main landing — immersive text-based RPG pitch, features, screenshots, download CTAs, community |
| `chat.html`  | Chat & Share subpage — Holo-Comm Chamber, sharing features, Discord chat-mock preview, support/contact |
| `styles.css` | Shared dark sci-fi alien theme — animated star field, Orbitron display font, glassmorphism panels |

## One-Click Hosting — GitHub Pages (Free)

1. Create a **new public repository** on GitHub, e.g. `ec2-gaming/beyondthestars-site`
2. Upload **all files** from this directory, plus:
   - `../assets/images/icon.png` → upload as `icon.png` (root)
   - `../store_assets/privacy-policy.html` → upload as `privacy-policy.html` (root)
   - `../store_assets/feature-graphic-1024x500.png` → upload as `feature-graphic.png` (root)
   - `../store_assets/screenshots/` → upload entire folder as `screenshots/`
3. **Repo Settings → Pages → Source: Deploy from branch** → Branch: `main` / Folder: `/ (root)` → Save
4. Wait ~60 seconds. Your live URL will be: `https://<your-github-username>.github.io/beyondthestars-site/`
5. Paste that URL into:
   - Google Play Console → "Marketing website URL"
   - Apple App Store Connect → "Marketing URL"
6. Privacy policy lives at `<your-url>/privacy-policy.html` — paste that into both stores' Privacy Policy URL field.

## Local Preview

```bash
cd /app/frontend/landing
# copy assets for local preview
cp ../assets/images/icon.png .
cp ../store_assets/privacy-policy.html .
cp -r ../store_assets/screenshots .
cp ../store_assets/feature-graphic-1024x500.png feature-graphic.png

python3 -m http.server 8888
# visit http://localhost:8888/
```

## Custom Domain

If you later buy `beyondthestars.app` (or similar, ~$20/yr on Namecheap/Cloudflare):
1. In repo **Settings → Pages → Custom domain**, enter your domain.
2. Add a CNAME record at your registrar pointing `www` → `<username>.github.io`.
3. Enable **Enforce HTTPS** (auto-provisioned by GitHub).
