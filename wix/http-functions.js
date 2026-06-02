/* ============================================================
 * Wix Velo backend — contact form intake (Option B, no API key)
 * ------------------------------------------------------------
 * Where this lives: in the Wix Editor with Velo/Dev Mode ON,
 *   Code tree → Backend → new file `http-functions.js`
 *   Paste this ENTIRE file as its contents, then "Publish".
 *
 * Exposes (after Publish):
 *   POST    {WIX_BASE}/_functions/contact
 *   OPTIONS {WIX_BASE}/_functions/contact      (CORS preflight)
 * Before Publish you can test against:
 *   {WIX_BASE}/_functions-dev/contact
 *
 * Field/label keys + message composition mirror the proven
 * Cloudflare Worker (worker.js), so leads land identically in CRM.
 *
 * This file lives in the static-site repo as the source of truth;
 * GitHub Pages does NOT run it — Wix runs it server-side.
 * ============================================================ */
import { contacts } from 'wix-crm-backend';
import { ok, badRequest, serverError } from 'wix-http-functions';

// Origins allowed to POST the form (the page origin, not the Wix host).
const ALLOWED_ORIGINS = [
  'https://acmglobaltech.com',
  'https://www.acmglobaltech.com',
  'https://hanzoai.github.io'
];
// Custom CRM keys already created in the Wix account (see wix/README.md).
const MESSAGE_FIELD_KEY = 'custom.acm-message-xnwsqpcqvzusxbypusvuucv';
const LEAD_LABEL_KEY = 'custom.website-lead';

function corsHeaders(request) {
  const h = (request && request.headers) || {};
  const origin = h.origin || h.Origin || '';
  const allow = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

function splitName(full) {
  const parts = String(full).trim().split(/\s+/);
  return parts.length > 1 ? { first: parts[0], last: parts.slice(1).join(' ') } : { first: parts[0] };
}

export async function post_contact(request) {
  const headers = corsHeaders(request);

  let body;
  try {
    body = await request.body.json();
  } catch (e) {
    return badRequest({ headers, body: { error: 'invalid JSON body' } });
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  if (!name || !email) {
    return badRequest({ headers, body: { error: 'name and email are required' } });
  }

  // Honeypot: hidden "website" field filled => bot. Silently accept, skip CRM.
  if (body.website) return ok({ headers, body: { ok: true } });

  // Fold the extra intents into the single CRM message field (same as worker.js).
  const parts = [];
  if (body.message) parts.push(String(body.message));
  if (body.cta) parts.push('[request: ' + body.cta + ']');
  if (body.goal) parts.push('[goal: ' + body.goal + ']');
  if (body.interest) parts.push('[interested in: ' + body.interest + ']');
  if (body.preferredTime) parts.push('[preferred time: ' + body.preferredTime + ']');
  if (body.segment) parts.push('[segment: ' + body.segment + ']');
  if (body.assetSize) parts.push('[assets: ' + body.assetSize + ']');
  if (body.timeline) parts.push('[timeline: ' + body.timeline + ']');

  const info = {
    name: splitName(name),
    emails: { items: [{ tag: 'MAIN', email }] },
    labelKeys: { items: [LEAD_LABEL_KEY] },
    extendedFields: { items: {} }
  };
  if (body.phone) info.phones = { items: [{ tag: 'MAIN', phone: String(body.phone) }] };
  if (body.company) info.company = String(body.company);
  if (parts.length) info.extendedFields.items[MESSAGE_FIELD_KEY] = parts.join(' ');

  try {
    const result = await contacts.appendOrCreateContact(info);
    return ok({ headers, body: { ok: true, contactId: result.contactId, identityType: result.identityType } });
  } catch (err) {
    console.error('contact submit failed:', err);
    return serverError({ headers, body: { error: err.message } });
  }
}

export function options_contact(request) {
  return ok({ headers: corsHeaders(request), body: {} });
}
