# ACM Global Tech — Wix integration

The marketing site is a **static** site (GitHub Pages, domain `acmglobaltech.com`).
It talks to **Wix** for the dynamic pieces through a single **Cloudflare Worker**
that holds the Wix API key server-side (the static bundle is public, so the key
can never live in it).

**One backend, one way.** Everything dynamic goes through the Worker:

| Capability        | Route                  | Wix API                                   |
|-------------------|------------------------|-------------------------------------------|
| All forms + CTAs  | `POST /contact`        | CRM Contacts (`appendOrCreate`)           |
| Scheduling        | `GET /slots`           | Bookings Availability Calendar            |
| Scheduling        | `POST /book`           | Bookings Create Booking                   |
| Client login      | *(none — client-side)* | Wix Members headless OAuth (`@wix/sdk`)   |

- **Live Worker:** `https://acm-contact.zeekay.workers.dev`
- **Wix site:** `acm-global-tech` · site id `cb3bb9a2-6ded-4155-9463-a8eca41842b6`
  · account id `379fb1dd-5d55-4243-878f-d782b1397fbc`
- Frontend config lives at the top of `../script.js` (`WIX_CONFIG`).

CRM custom fields already created in the Wix account:
- Label **"Website Lead"** → `custom.website-lead`
- Text field **"ACM Message"** → `custom.acm-message-xnwsqpcqvzusxbypusvuucv`

---

## Deploy / update the Worker

```bash
cd wix
export CLOUDFLARE_EMAIL=...            # global API key auth (or use an API token)
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=94a3e3f299092abb1feda2a7481ea845
npx wrangler deploy                    # pushes worker.js
npx wrangler secret put WIX_API_KEY    # one time — paste the Wix API key
```

`wrangler.toml` holds the non-secret config (account/site/field/label ids,
allowed origins, optional `BOOKINGS_SERVICE_ID`). `.dev.vars` (gitignored) holds
the key for `npx wrangler dev`.

Quick check:

```bash
curl https://acm-contact.zeekay.workers.dev/                 # {"ok":true,...,"bookings":false}
curl -X POST https://acm-contact.zeekay.workers.dev/contact \
  -H 'Origin: https://acmglobaltech.com' -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com","interest":"White-Label Products"}'
```

The contact form, signup popups, newsletter, and lead-capture modals all POST to
`/contact` and create a CRM lead tagged **Website Lead**, with the request /
goal / interest / preferred-time folded into the **ACM Message** field. No
`mailto:` unless the network call itself fails.

---

## Turn ON scheduling (Wix Bookings) — owner setup

The scheduler UI is wired to the real Bookings API but stays dormant (it falls
back to the contact form) until the Bookings app is installed and a service
exists. The API currently returns `APP_NOT_INSTALLED`.

1. **Wix dashboard → App Market → install _Wix Bookings_.**
2. **Bookings → Services → add an appointment service** (e.g. "Discovery Call",
   30 min), assign a staff member, and set business / working hours.
3. **Get the service id.** It's in the service's dashboard URL, or:
   ```bash
   curl -X POST https://www.wixapis.com/bookings/v2/services/query \
     -H "Authorization: $WIX_API_KEY" \
     -H "wix-account-id: 379fb1dd-5d55-4243-878f-d782b1397fbc" \
     -H "wix-site-id: cb3bb9a2-6ded-4155-9463-a8eca41842b6" \
     -H 'Content-Type: application/json' -d '{"query":{"paging":{"limit":10}}}'
   ```
4. **Set it on the Worker:** uncomment `BOOKINGS_SERVICE_ID` in `wrangler.toml`
   with that id, then `npx wrangler deploy`.
5. Done. `GET /slots` now returns real availability and the "Book a discovery
   call" CTAs open a live time-picker that creates a real Wix booking (and
   mirrors it into CRM). Verify: the health check shows `"bookings":true`.

---

## Turn ON client login (Wix Members SSO) — owner setup

Login + the client dashboard live on `/login/`. The dashboard renders after a
real Wix member signs in. It stays in "request access" mode until a Headless
OAuth client exists.

1. **Wix dashboard → Settings → Headless → create an OAuth client** (for
   Visitors & Members). Copy the **Client ID** (no secret needed for OAuth).
2. **Add allowed redirect/login URIs:** `https://acmglobaltech.com/login/`
   (and `https://www.acmglobaltech.com/login/`). Add a logout URI of
   `https://acmglobaltech.com/login/`.
3. **Enable login** for the site's Members area and provision each client as a
   Wix **Member**.
4. **Set the client id** in `../script.js` → `WIX_CONFIG.WIX_CLIENT_ID`, rebuild
   (`node build.mjs`), and push.
5. Done. "Sign in to the portal" runs the Wix-managed OAuth flow; on return,
   `members.getCurrentMember()` populates the dashboard greeting and the portal
   reveals the client cards. Sign-out clears the session via Wix.

The login flow loads `@wix/sdk` + `@wix/members` on demand from a CDN
(`esm.sh`) — only on `/login/`, only when `WIX_CLIENT_ID` is set.

---

## CORS
`wrangler.toml → ALLOWED_ORIGINS` lists who may call the Worker: the live domain,
`hanzoai.github.io`, and `127.0.0.1:8090` / `localhost:8090` for local dev. Edit
+ redeploy to change.

## Rotate the Wix key
`npx wrangler secret put WIX_API_KEY` with the new value, and update `.dev.vars`
for local runs. Nothing else changes.
