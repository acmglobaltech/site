# ACM Global Tech — Wix integration

The marketing site is a **static** site (GitHub Pages). It talks to **Wix** for
the dynamic pieces. There are two ways to handle the contact form — this repo is
wired for **Option A** (uses your Wix API key).

| Capability      | Wired by                              | Setup |
|-----------------|---------------------------------------|-------|
| Contact form    | `fetch()` → Cloudflare Worker → Wix REST API | deploy `worker.js` (Option A) |
| Discovery Call  | `<a data-wix="bookings">`             | create the Bookings service in Wix |
| Payment Link    | `<a data-wix="payment-deposit">`      | create a Payment Link in Wix Payments |
| Members / login | `<a data-wix="members">`              | enable Wix Members area |

All link URLs live in **one** place: `WIX_CONFIG` at the top of `../script.js`.

**Wix site:** `acm-global-tech` · domain `https://www.acmglobaltech.com`
· site id `cb3bb9a2-6ded-4155-9463-a8eca41842b6`
· account id `379fb1dd-5d55-4243-878f-d782b1397fbc`

These CRM fields were already created in your Wix account via the API:
- Label **"Website Lead"** → `custom.website-lead`
- Text field **"ACM Message"** → `custom.acm-message-xnwsqpcqvzusxbypusvuucv`

---

## Option A — Cloudflare Worker proxy (uses the Wix API key) ✅ wired

The Wix API key is a **secret**. It can never go in the static site (the bundle
is public). The Worker holds it server-side and creates the CRM contact.

Verified working locally end-to-end: form → Worker → contact appears in Wix CRM
with name, email, phone, company, the "Website Lead" label, and the message.

### Deploy (one time)

```bash
cd wix
npx wrangler login                       # opens browser — log into your Cloudflare account
npx wrangler secret put WIX_API_KEY      # paste the Wix API key when prompted
npx wrangler deploy                      # prints the live URL, e.g.
                                         #   https://acm-contact.<subdomain>.workers.dev
```

Then put that URL (with `/contact`) into `../script.js`:

```js
CONTACT_FORM_ENDPOINT: 'https://acm-contact.<subdomain>.workers.dev/contact',
```

Commit + push; GitHub Pages rebuilds in ~30s. Done.

### Local dev / testing

`.dev.vars` (gitignored) already holds the key for local runs:

```bash
cd wix
npx wrangler dev --port 8787
curl -X POST http://localhost:8787/contact \
  -H 'Origin: https://hanzoai.github.io' -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com","interest":"Fintech","message":"hi"}'
```

### Files
- `worker.js` — the proxy (CORS, validation, honeypot, Wix REST call)
- `wrangler.toml` — non-secret config (account/site/field/label ids, allowed origins)
- `.dev.vars` — **local secret, never committed**

### Rotate the key
Set a new key value with `npx wrangler secret put WIX_API_KEY` and update
`.dev.vars`. Nothing else changes.

---

## Option B — Velo HTTP function (no API key) — alternative

If you'd rather not run a Worker, `http-functions.js` does the same thing inside
Wix itself (no key needed, because it runs server-side in Wix):

1. Wix Editor → **Dev Mode → Turn on Dev Mode**.
2. Code tree → `backend` → new file `http-functions.js` → paste that file → **Publish**.
3. Set `CONTACT_FORM_ENDPOINT` to `https://www.acmglobaltech.com/_functions/contact`.

Use **either** Option A **or** Option B, not both.

---

## Bookings / Payments / Members (both options)

- **Bookings:** Wix Apps → Wix Bookings → add a "Discovery Call" service (30 min).
  Its URL → `BOOKINGS_URL`.
- **Payments:** Wix Dashboard → Payments → Payment Links → new link.
  Its URL → `PAYMENT_LINK_DEPOSIT`.
- **Members:** Wix Editor → Add → Members Area. Login is `/account/login`.

## CORS
`wrangler.toml` → `ALLOWED_ORIGINS` lists who may POST the form. It currently
allows `https://hanzoai.github.io` and the live domain. Edit + redeploy to change.
