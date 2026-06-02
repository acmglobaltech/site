/* ============================================================
 * Wix Velo backend — contact form intake
 * ------------------------------------------------------------
 * Where this lives: in the Wix Editor with Velo enabled,
 *   open the Code tree → backend/ → http-functions.js
 * Paste this entire file as its contents and "Publish".
 *
 * Exposes:
 *   POST  ${WIX_BASE}/_functions/contact
 *   OPTIONS ${WIX_BASE}/_functions/contact   (CORS preflight)
 *
 * This file is in our static-site repo as DOCUMENTATION ONLY.
 * GitHub Pages does NOT run it — Wix runs it server-side.
 * ============================================================ */
import { contacts } from 'wix-crm-backend';
import { ok, badRequest, serverError } from 'wix-http-functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://hanzoai.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function post_contact(request) {
  let body;
  try {
    body = await request.body.json();
  } catch (e) {
    return badRequest({ headers: CORS_HEADERS, body: { error: 'invalid JSON body' } });
  }

  if (!body.name || !body.email) {
    return badRequest({ headers: CORS_HEADERS, body: { error: 'name and email are required' } });
  }

  try {
    const result = await contacts.appendOrCreateContact({
      info: {
        name: { first: body.name },
        emails: [{ email: body.email, tag: 'MAIN' }],
        phones: body.phone ? [{ phone: body.phone, tag: 'MAIN' }] : [],
        company: body.company || undefined,
        labelKeys: {
          items: [
            'custom.acmglobaltech-site',
            'custom.acm-' + (body.interest || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-')
          ]
        },
        extendedFields: {
          items: {
            'custom.acmMessage': [body.message, body.cta ? '[request: ' + body.cta + ']' : '', body.goal ? '[goal: ' + body.goal + ']' : '', body.preferredTime ? '[preferred time: ' + body.preferredTime + ']' : ''].filter(Boolean).join(' '),
            'custom.acmInterest': body.interest || ''
          }
        }
      }
    });

    return ok({
      headers: CORS_HEADERS,
      body: { ok: true, contactId: result.contactId, identityType: result.identityType }
    });
  } catch (err) {
    console.error('contact submit failed:', err);
    return serverError({ headers: CORS_HEADERS, body: { error: err.message } });
  }
}

export function options_contact() {
  return ok({ headers: CORS_HEADERS, body: {} });
}
