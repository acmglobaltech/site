# ACM Global Tech — acmglobaltech.com

Static marketing site for ACM Global Tech (white-label banking & payments
platform for credit unions, banks, healthcare). Owner org on GitHub: `hanzoai`
(remote `hanzoai/acmglobaltech`) + `acmglobaltech/site` (issues live here).

## Build & run
- **Source of truth:** content fragments in `src/pages/**.html` (each with a
  leading `<!--META {json} -->` block). `node build.mjs` renders 75 static pages
  (shared mega-menu header, footer, modals, full SEO head) into clean-URL folders
  + `sitemap.xml` + `robots.txt`. GitHub Pages serves the output. **Edit
  `src/pages/`, never the built `*/index.html`.**
- Shared assets: `script.js`, `styles.css` (cache-busted via `ASSET_V` in
  `build.mjs` — bump on every asset change).
- Local: `python3 -m http.server 8090` (8080 is often taken by another project).

## Wix integration (dynamic backend)
The site is static; Wix provides the dynamic backend, fronted by ONE Cloudflare
Worker (`wix/worker.js`, live at `https://acm-contact.zeekay.workers.dev`) that
holds the Wix API key as a secret. See `wix/README.md` for deploy + owner setup.

- `POST /contact` — every form/CTA/popup/newsletter → Wix CRM contact, tagged
  `custom.website-lead`, details folded into `custom.acm-message-…`. Frontend
  helper `acmSubmitLead()` in `script.js` is the single submit path (mailto only
  on network failure).
- `GET /slots` + `POST /book` — Wix Bookings (scheduler modal). Dormant until the
  owner installs the Bookings app + sets `BOOKINGS_SERVICE_ID` (var in
  `wrangler.toml`); degrades to the contact form meanwhile.
- Client login (`/login/`) — Wix Members headless OAuth via `@wix/sdk` loaded
  on demand, client-side. Dormant until `WIX_CONFIG.WIX_CLIENT_ID` is set;
  shows request-access meanwhile. Renders a client dashboard (sales tool) on
  login.

Wix site id `cb3bb9a2-6ded-4155-9463-a8eca41842b6`, account id
`379fb1dd-5d55-4243-878f-d782b1397fbc`. CF account `94a3e3f299092abb1feda2a7481ea845`.

## Conventions
- No dates in files/branches. No AI-slop summary files — update this file.
- Leadership: Michael Gladczuk (Founder & CEO), Zach Kelling (Chief Scientist).
  Email info@acmglobaltech.com, office +1 (407) 279-0314.
