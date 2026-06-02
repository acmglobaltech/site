/* ACM AI assistant proxy — Cloudflare Worker.
 * Holds the Hanzo API key server-side and answers site questions.
 * Deploy:  cd ai && npx wrangler secret put HANZO_API_KEY && npx wrangler deploy
 * Then set AI_CONFIG.endpoint in ../script.js to  https://<your-worker>/ask  and push. */
const SYS = "You are the ACM Global Tech website assistant. ACM delivers a regulated-first, white-label banking ecosystem (core banking, payments, wallets, exchange & FX, RWA tokenization, stablecoins, treasury, cards, a white-label PSP, and Banking-as-a-Service) for credit unions, mid-sized banks, and healthcare, with post-quantum cryptography (NIST ML-KEM/ML-DSA/SLH-DSA) and an Agile Speed Framework. Ecosystem partners: Hanzo.ai and Lux Network. Be concise and accurate. Never invent metrics, clients, or certifications. Route detailed or sales questions to a discovery call (/get-started/) or info@acmglobaltech.com.";
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': allow(origin, env), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname !== '/ask' || req.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
    const q = String(body.query || '').slice(0, 1200);
    if (!q) return json({ error: 'empty query' }, 400, cors);
    const resp = await fetch((env.HANZO_API_BASE || 'https://api.hanzo.ai/v1') + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.HANZO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.HANZO_MODEL || 'gpt-4o-mini', temperature: 0.3, max_tokens: 320, messages: [{ role: 'system', content: SYS }, { role: 'user', content: q }] })
    });
    if (!resp.ok) return json({ error: 'upstream', status: resp.status, detail: await resp.text() }, 502, cors);
    const d = await resp.json();
    const answer = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    return json({ answer }, 200, cors);
  }
};
function allow(o, env) { const list = (env.ALLOWED_ORIGINS || 'https://acmglobaltech.com,https://www.acmglobaltech.com,https://hanzoai.github.io').split(','); return list.indexOf(o) !== -1 ? o : list[0]; }
function json(b, s, h) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...h } }); }
