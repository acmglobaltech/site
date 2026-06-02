/* ============================================================
 * ACM Global Tech — contact-form proxy (Cloudflare Worker)
 * ------------------------------------------------------------
 * The static marketing site (GitHub Pages) POSTs the contact
 * form here. This Worker holds the Wix API key as a SECRET
 * (never shipped to the browser) and creates a CRM contact in
 * the Wix site via the Wix REST API.
 *
 * Routes:
 *   POST    /contact     create/append a CRM contact
 *   OPTIONS /contact     CORS preflight
 *   GET     /            health check
 *
 * Secrets / vars (set via wrangler or the .dev.vars file):
 *   WIX_API_KEY        the Wix API key  (SECRET)
 *   WIX_ACCOUNT_ID     379fb1dd-5d55-4243-878f-d782b1397fbc
 *   WIX_SITE_ID        cb3bb9a2-6ded-4155-9463-a8eca41842b6
 *   ALLOWED_ORIGINS    comma-separated list of allowed origins
 *   MESSAGE_FIELD_KEY  custom.acm-message-xnwsqpcqvzusxbypusvuucv
 *   LEAD_LABEL_KEY     custom.website-lead
 * ============================================================ */

const WIX_API = 'https://www.wixapis.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, service: 'acm-contact-proxy' }, 200, cors);
    }

    if (url.pathname !== '/contact' || request.method !== 'POST') {
      return json({ error: 'not found' }, 404, cors);
    }

    // Reject browsers we don't recognise (defence in depth; CORS already blocks).
    if (origin && !isAllowed(origin, env)) {
      return json({ error: 'origin not allowed' }, 403, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400, cors);
    }

    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    if (!name || !email) {
      return json({ error: 'name and email are required' }, 400, cors);
    }

    // Honeypot: if a hidden field named "website" is filled, silently accept.
    if (data.website) return json({ ok: true }, 200, cors);

    const messageKey = env.MESSAGE_FIELD_KEY || 'custom.acm-message-xnwsqpcqvzusxbypusvuucv';
    const labelKey = env.LEAD_LABEL_KEY || 'custom.website-lead';

    const info = {
      name: splitName(name),
      emails: { items: [{ email, tag: 'MAIN' }] },
      labelKeys: { items: [labelKey] },
      extendedFields: { items: {} }
    };
    if (data.phone) info.phones = { items: [{ phone: String(data.phone), tag: 'MAIN' }] };
    if (data.company) info.company = String(data.company);

    const messageParts = [];
    if (data.message) messageParts.push(String(data.message));
    if (data.cta) messageParts.push(`[request: ${data.cta}]`);
    if (data.goal) messageParts.push(`[goal: ${data.goal}]`);
    if (data.interest) messageParts.push(`[interested in: ${data.interest}]`);
    if (data.preferredTime) messageParts.push(`[preferred time: ${data.preferredTime}]`);
    if (data.segment) messageParts.push(`[segment: ${data.segment}]`);
    if (data.assetSize) messageParts.push(`[assets: ${data.assetSize}]`);
    if (data.timeline) messageParts.push(`[timeline: ${data.timeline}]`);
    if (messageParts.length) info.extendedFields.items[messageKey] = messageParts.join(' ');

    const wixResp = await fetch(`${WIX_API}/contacts/v4/contacts?allowDuplicates=true`, {
      method: 'POST',
      headers: {
        'Authorization': env.WIX_API_KEY,
        'wix-account-id': env.WIX_ACCOUNT_ID,
        'wix-site-id': env.WIX_SITE_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ info })
    });

    if (!wixResp.ok) {
      const detail = await wixResp.text();
      return json({ error: 'wix rejected the request', status: wixResp.status, detail }, 502, cors);
    }

    const result = await wixResp.json();
    return json({ ok: true, contactId: result.contact && result.contact.id }, 200, cors);
  }
};

/* ---------- helpers ---------- */

function splitName(full) {
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function allowedList(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowed(origin, env) {
  return allowedList(env).includes(origin);
}

function corsHeaders(origin, env) {
  const list = allowedList(env);
  const allow = list.includes(origin) ? origin : (list[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
