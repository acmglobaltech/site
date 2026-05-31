# Wix backend wiring

The marketing site is hosted on GitHub Pages at
**https://hanzoai.github.io/acmglobaltech/** (later, on the custom domain).

The site is **statically** hosted, but it talks to **Wix** for:

| Capability        | Wired by              | Wix-side setup needed |
|-------------------|-----------------------|-----------------------|
| Contact form      | `fetch()` to a Velo HTTP function | enable Velo, paste `http-functions.js`, publish |
| Discovery Call    | `<a data-wix="bookings">` link    | create "Discovery Call" service in Wix Bookings |
| Payment Link      | `<a data-wix="payment-deposit">`  | create a Payment Link in Wix Payments |
| Members / login   | `<a data-wix="members">`          | enable Wix Members area |

All four are configured in **one** place: `WIX_CONFIG` at the top of `../script.js`.

---

## One-time Wix setup

### 1. Enable Velo and publish the contact endpoint

1. Open the Wix Editor for the site.
2. Top menu: **Dev Mode → Turn on Dev Mode** (this turns on Velo).
3. In the left panel, expand `Public & Backend → backend`.
4. Create a file called **`http-functions.js`** (must be that exact name).
5. Paste the entire contents of `wix/http-functions.js` into it.
6. Click **Publish** in the top-right.

The endpoint is now live at
`https://<your-wix-site>/_functions/contact`.

### 2. Create the "Discovery Call" booking service

1. In the Wix Editor: **Apps → Wix Bookings**.
2. Add a service called **"Discovery Call"**, 30 minutes, free.
3. Note the public URL — it'll look like
   `https://<your-wix-site>/book-online/discovery-call`.

### 3. Create a Payment Link for deposits

1. **Wix Dashboard → Payments → Payment Links → New Link**.
2. Name: **"Engagement Deposit"**, amount of your choice.
3. Copy the public URL.

### 4. Enable Members area

1. **Wix Editor → Add → Members Area → Add to Site**.
2. Wix auto-creates `/account/login`. Note it.

---

## Wire it into the static site

Edit `../script.js` and replace the four placeholder URLs in `WIX_CONFIG`:

```js
var WIX_CONFIG = {
  WIX_BASE: 'https://acmglobaltech.com',
  CONTACT_FORM_ENDPOINT: 'https://acmglobaltech.com/_functions/contact',
  BOOKINGS_URL: 'https://acmglobaltech.com/book-online/discovery-call',
  PAYMENT_LINK_DEPOSIT: 'https://acmglobaltech.com/payments/<link-id>',
  MEMBERS_LOGIN: 'https://acmglobaltech.com/account/login'
};
```

Commit, push to `main`, GitHub Pages auto-rebuilds within ~30s.

---

## CORS note

The Velo function in `http-functions.js` allows requests from
`https://hanzoai.github.io`. When the custom domain is live, update the
`Access-Control-Allow-Origin` header in that file to match
(or list both during the transition).
