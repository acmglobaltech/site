/* ============================================================
 * ACM Global Tech — Wix proxy (Cloudflare Worker)
 * ------------------------------------------------------------
 * The static marketing site (GitHub Pages) talks to Wix through
 * this Worker. The Worker holds the Wix API key as a SECRET
 * (never shipped to the browser) and calls the Wix REST API.
 *
 * Routes:
 *   GET     /            health check
 *   POST    /contact     create/append a CRM contact (every form + CTA)
 *   GET     /slots       Wix Bookings availability for the booking service
 *   POST    /book        create a Wix Bookings booking
 *   OPTIONS *            CORS preflight
 *
 * Client login (Wix Members) is handled fully client-side with the
 * Wix headless JS SDK (OAuth) — it needs no Worker route.
 *
 * Vars (wrangler.toml) / secrets (wrangler secret put):
 *   WIX_API_KEY          the Wix API key  (SECRET)
 *   WIX_ACCOUNT_ID       379fb1dd-5d55-4243-878f-d782b1397fbc
 *   WIX_SITE_ID          cb3bb9a2-6ded-4155-9463-a8eca41842b6
 *   ALLOWED_ORIGINS      comma-separated allowed origins
 *   MESSAGE_FIELD_KEY    custom.acm-message-xnwsqpcqvzusxbypusvuucv
 *   LEAD_LABEL_KEY       custom.website-lead
 *   BOOKINGS_SERVICE_ID  Wix Bookings service id (enables /slots + /book)
 * ============================================================ */

const WIX = 'https://www.wixapis.com';
const CONTACTS_URL = `${WIX}/contacts/v4/contacts?allowDuplicates=true`;
const AVAILABILITY_URL = `${WIX}/availability-calendar/v1/availability/query`;
const BOOKINGS_URL = `${WIX}/bookings/v2/bookings`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, service: 'acm-wix-proxy', bookings: !!env.BOOKINGS_SERVICE_ID }, 200, cors);
    }

    // Reject browsers we don't recognise (defence in depth; CORS already blocks).
    if (origin && !isAllowed(origin, env)) return json({ error: 'origin not allowed' }, 403, cors);

    try {
      if (url.pathname === '/contact' && request.method === 'POST') return await handleContact(request, env, cors);
      if (url.pathname === '/slots' && request.method === 'GET') return await handleSlots(url, env, cors);
      if (url.pathname === '/book' && request.method === 'POST') return await handleBook(request, env, cors);
    } catch (err) {
      return json({ error: 'server error', detail: String(err && err.message || err) }, 500, cors);
    }
    return json({ error: 'not found' }, 404, cors);
  }
};

/* ---------- /contact : CRM lead ---------- */

async function handleContact(request, env, cors) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'invalid JSON body' }, 400, cors); }

  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  if (!name || !email) return json({ error: 'name and email are required' }, 400, cors);

  // Honeypot: if the hidden "website" field is filled, silently accept.
  if (data.website) return json({ ok: true }, 200, cors);

  const result = await createContact(env, data);
  if (!result.ok) return json({ error: 'wix rejected the request', status: result.status, detail: result.detail }, 502, cors);
  return json({ ok: true, contactId: result.contactId }, 200, cors);
}

async function createContact(env, data) {
  const messageKey = env.MESSAGE_FIELD_KEY || 'custom.acm-message-xnwsqpcqvzusxbypusvuucv';
  const labelKey = env.LEAD_LABEL_KEY || 'custom.website-lead';

  const info = {
    name: splitName((data.name || '').trim()),
    emails: { items: [{ email: (data.email || '').trim(), tag: 'MAIN' }] },
    labelKeys: { items: [labelKey] },
    extendedFields: { items: {} }
  };
  if (data.phone) info.phones = { items: [{ phone: String(data.phone), tag: 'MAIN' }] };
  if (data.company) info.company = String(data.company);

  const parts = [];
  if (data.message) parts.push(String(data.message));
  if (data.cta) parts.push(`[request: ${data.cta}]`);
  if (data.goal) parts.push(`[goal: ${data.goal}]`);
  if (data.interest) parts.push(`[interested in: ${data.interest}]`);
  if (data.preferredTime) parts.push(`[preferred time: ${data.preferredTime}]`);
  if (data.segment) parts.push(`[segment: ${data.segment}]`);
  if (data.assetSize) parts.push(`[assets: ${data.assetSize}]`);
  if (data.timeline) parts.push(`[timeline: ${data.timeline}]`);
  if (parts.length) info.extendedFields.items[messageKey] = parts.join(' ');

  const resp = await fetch(CONTACTS_URL, { method: 'POST', headers: wixHeaders(env), body: JSON.stringify({ info }) });
  if (!resp.ok) return { ok: false, status: resp.status, detail: await resp.text() };
  const out = await resp.json();
  return { ok: true, contactId: out.contact && out.contact.id };
}

/* ---------- /slots : Wix Bookings availability ---------- */

async function handleSlots(url, env, cors) {
  const serviceId = env.BOOKINGS_SERVICE_ID;
  if (!serviceId) return json({ configured: false, slots: [] }, 200, cors);

  const days = clamp(parseInt(url.searchParams.get('days') || '14', 10), 1, 30);
  const now = Date.now();
  const startDate = new Date(now + 60 * 60 * 1000).toISOString();          // from +1h
  const endDate = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    query: {
      filter: { serviceId: [serviceId], startDate, endDate, bookable: true },
      slotsPerDay: 4
    }
  };
  const resp = await fetch(AVAILABILITY_URL, { method: 'POST', headers: wixHeaders(env), body: JSON.stringify(body) });
  if (!resp.ok) return json({ configured: true, error: 'availability error', status: resp.status, detail: await resp.text() }, 502, cors);

  const data = await resp.json();
  const slots = (data.availabilityEntries || [])
    .filter((e) => e.bookable && e.slot)
    .map((e) => ({
      serviceId: e.slot.serviceId,
      scheduleId: e.slot.scheduleId,
      startDate: e.slot.startDate,
      endDate: e.slot.endDate
    }));
  return json({ configured: true, slots }, 200, cors);
}

/* ---------- /book : create a Wix Bookings booking ---------- */

async function handleBook(request, env, cors) {
  const serviceId = env.BOOKINGS_SERVICE_ID;
  if (!serviceId) return json({ error: 'bookings not configured' }, 503, cors);

  let data;
  try { data = await request.json(); } catch { return json({ error: 'invalid JSON body' }, 400, cors); }

  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  const slot = data.slot || {};
  if (!name || !email) return json({ error: 'name and email are required' }, 400, cors);
  if (!slot.startDate || !slot.scheduleId) return json({ error: 'a valid slot is required' }, 400, cors);
  if (data.website) return json({ ok: true }, 200, cors); // honeypot

  const nm = splitName(name);
  const contactDetails = { firstName: nm.first, lastName: nm.last || '', email };
  if (data.phone) contactDetails.phone = String(data.phone);

  const booking = {
    bookedEntity: {
      slot: {
        serviceId: slot.serviceId || serviceId,
        scheduleId: slot.scheduleId,
        startDate: slot.startDate,
        endDate: slot.endDate
      }
    },
    contactDetails,
    totalParticipants: 1
  };
  if (data.message) booking.additionalFields = [{ value: String(data.message) }];

  const resp = await fetch(BOOKINGS_URL, {
    method: 'POST',
    headers: wixHeaders(env),
    body: JSON.stringify({ booking, participantNotification: { notifyParticipants: true }, sendSmsReminder: false })
  });
  if (!resp.ok) return json({ error: 'wix rejected the booking', status: resp.status, detail: await resp.text() }, 502, cors);

  const out = await resp.json();
  // Mirror the booking into CRM so it shows up alongside every other lead.
  await createContact(env, { name, email, phone: data.phone, company: data.company, cta: 'Discovery Call (booked)', preferredTime: slot.startDate, message: data.message })
    .catch(() => { /* booking already succeeded; CRM mirror is best-effort */ });
  return json({ ok: true, bookingId: out.booking && out.booking.id, startDate: slot.startDate }, 200, cors);
}

/* ---------- helpers ---------- */

function wixHeaders(env) {
  return {
    'Authorization': env.WIX_API_KEY,
    'wix-account-id': env.WIX_ACCOUNT_ID,
    'wix-site-id': env.WIX_SITE_ID,
    'Content-Type': 'application/json'
  };
}

function splitName(full) {
  const parts = String(full).trim().split(/\s+/);
  return parts.length > 1 ? { first: parts[0], last: parts.slice(1).join(' ') } : { first: parts[0] };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, isNaN(n) ? lo : n)); }

function allowedList(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function isAllowed(origin, env) { return allowedList(env).includes(origin); }

function corsHeaders(origin, env) {
  const list = allowedList(env);
  const allow = list.includes(origin) ? origin : (list[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
