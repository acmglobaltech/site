# ACM AI assistant proxy

The "Ask ACM AI" widget posts to this Cloudflare Worker, which holds the Hanzo API
key server-side and calls Hanzo's OpenAI-compatible chat API.

## Deploy
```
cd ai
npx wrangler login
npx wrangler secret put HANZO_API_KEY      # paste your Hanzo API key
npx wrangler deploy                        # prints https://acm-ai.<subdomain>.workers.dev
```
Then in `../script.js` set `AI_CONFIG.endpoint` to `https://acm-ai.<subdomain>.workers.dev/ask`
and push. Until then the widget answers from a built-in knowledge base and routes to the team.

Config in `wrangler.toml`: `HANZO_API_BASE`, `HANZO_MODEL`, `ALLOWED_ORIGINS`.
