/* ============================================================
 * ACM Global Tech — Wix Velo backend (PURE WIX, no API key)
 * ------------------------------------------------------------
 * Runs INSIDE the Wix site, so it has native permissions and
 * needs no API key and no Cloudflare Worker. This is the
 * pure-Wix backend for the static GitHub Pages site.
 *
 * Install:
 *   Wix Editor → Dev Mode (Velo) ON → Code panel → Backend →
 *   new file `http-functions.js` → paste this whole file → Publish.
 *
 * After Publish the endpoints are live at the SITE URL:
 *   POST    {SITE}/_functions/contact
 *   GET     {SITE}/_functions/slots
 *   POST    {SITE}/_functions/book
 * (Use {SITE}/_functions-dev/... to test before publishing.)
 *
 * Then in ../script.js set:
 *   WIX_CONFIG.API = 'https://<your-wix-site>/_functions'
 * The route paths (/contact, /slots, /book) are unchanged, so
 * nothing else in the frontend changes.
 * ============================================================ */
import { contacts } from 'wix-crm-backend';
import { bookings, availabilityCalendar } from 'wix-bookings.v2';
import { ok, badRequest, serverError } from 'wix-http-functions';

const ALLOWED_ORIGINS = [
  'https://acmglobaltech.com',
  'https://www.acmglobaltech.com',
  'https://hanzoai.github.io'
];
const SERVICE_ID = '329d79d1-6566-4450-91ff-9a5de0bf0164'; // "30 min meeting"
const MESSAGE_FIELD_KEY = 'custom.acm-message-xnwsqpcqvzusxbypusvuucv';
const LEAD_LABEL_KEY = 'custom.website-lead';

/* ---------- CORS ---------- */
function corsHeaders(request) {
  const h = (request && request.headers) || {};
  const origin = h.origin || h.Origin || '';
  const allow = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}
function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  return parts.length > 1 ? { first: parts[0], last: parts.slice(1).join(' ') } : { first: parts[0] || '' };
}

/* ---------- shared CRM write ---------- */
async function createContact(data) {
  const info = {
    name: splitName(data.name),
    emails: [{ email: String(data.email || '').trim() }],
    labelKeys: [LEAD_LABEL_KEY],
    extendedFields: { items: {} }
  };
  if (data.phone) info.phones = [{ phone: String(data.phone) }];
  if (data.company) info.company = String(data.company);

  const parts = [];
  if (data.message) parts.push(String(data.message));
  if (data.cta) parts.push('[request: ' + data.cta + ']');
  if (data.goal) parts.push('[goal: ' + data.goal + ']');
  if (data.interest) parts.push('[interested in: ' + data.interest + ']');
  if (data.preferredTime) parts.push('[preferred time: ' + data.preferredTime + ']');
  if (data.segment) parts.push('[segment: ' + data.segment + ']');
  if (data.assetSize) parts.push('[assets: ' + data.assetSize + ']');
  if (data.timeline) parts.push('[timeline: ' + data.timeline + ']');
  if (parts.length) info.extendedFields.items[MESSAGE_FIELD_KEY] = parts.join(' ');

  return contacts.appendOrCreateContact(info); // → { contactId, identityType }
}

/* ---------- POST /contact ---------- */
export async function post_contact(request) {
  const headers = corsHeaders(request);
  let body;
  try { body = await request.body.json(); } catch (e) { return badRequest({ headers, body: { error: 'invalid JSON body' } }); }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  if (!name || !email) return badRequest({ headers, body: { error: 'name and email are required' } });
  if (body.website) return ok({ headers, body: { ok: true } }); // honeypot

  try {
    const res = await createContact(body);
    return ok({ headers, body: { ok: true, contactId: res.contactId } });
  } catch (err) {
    return serverError({ headers, body: { error: String(err && err.message || err) } });
  }
}
export function options_contact(request) { return ok({ headers: corsHeaders(request), body: {} }); }

/* ---------- GET /slots ---------- */
export async function get_slots(request) {
  const headers = corsHeaders(request);
  if (!SERVICE_ID) return ok({ headers, body: { configured: false, slots: [] } });

  const days = Math.max(1, Math.min(30, parseInt((request.query && request.query.days) || '14', 10) || 14));
  const now = Date.now();
  const startDate = new Date(now + 60 * 60 * 1000).toISOString();
  const endDate = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await availabilityCalendar.queryAvailability(
      { filter: { serviceId: [SERVICE_ID], startDate, endDate, bookable: true }, slotsPerDay: 4 },
      { timezone: 'America/Chicago' }
    );
    const slots = (res.availabilityEntries || [])
      .filter((e) => e.bookable && e.slot)
      .map((e) => ({ serviceId: e.slot.serviceId, scheduleId: e.slot.scheduleId, startDate: e.slot.startDate, endDate: e.slot.endDate }));
    return ok({ headers, body: { configured: true, slots } });
  } catch (err) {
    return serverError({ headers, body: { configured: true, error: String(err && err.message || err) } });
  }
}

/* ---------- POST /book ---------- */
export async function post_book(request) {
  const headers = corsHeaders(request);
  let body;
  try { body = await request.body.json(); } catch (e) { return badRequest({ headers, body: { error: 'invalid JSON body' } }); }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const slot = body.slot || {};
  if (!name || !email) return badRequest({ headers, body: { error: 'name and email are required' } });
  if (!slot.startDate || !slot.scheduleId) return badRequest({ headers, body: { error: 'a valid slot is required' } });
  if (body.website) return ok({ headers, body: { ok: true } }); // honeypot

  const nm = splitName(name);
  const booking = {
    totalParticipants: 1,
    contactDetails: { firstName: nm.first, lastName: nm.last || '', email, phone: body.phone ? String(body.phone) : undefined },
    bookedEntity: {
      slot: {
        serviceId: slot.serviceId || SERVICE_ID,
        scheduleId: slot.scheduleId,
        startDate: slot.startDate,
        endDate: slot.endDate
      }
    }
  };

  try {
    const res = await bookings.createBooking(booking);
    // Mirror into CRM alongside every other lead (best effort).
    try { await createContact({ name, email, phone: body.phone, company: body.company, cta: 'Discovery Call (booked)', preferredTime: slot.startDate, message: body.message }); } catch (e) { /* booking already succeeded */ }
    return ok({ headers, body: { ok: true, bookingId: res._id || (res.booking && res.booking._id), startDate: slot.startDate } });
  } catch (err) {
    return serverError({ headers, body: { error: String(err && err.message || err) } });
  }
}
export function options_book(request) { return ok({ headers: corsHeaders(request), body: {} }); }
