#!/usr/bin/env node
/* ============================================================
 * ACM Global Tech — static multi-page build
 * ------------------------------------------------------------
 * Reads content fragments from src/pages/**.html (each with a
 * leading <!--META {json} --> block) and renders a full static
 * HTML page per file: shared mega-menu header, multi-column
 * footer, and a complete SEO <head> (meta, canonical, Open
 * Graph, Twitter, JSON-LD Organization + page type + Breadcrumb
 * + FAQ). Emits clean-URL folders (/products/banking-core/),
 * sitemap.xml and robots.txt. GitHub Pages serves the output.
 *
 *   node build.mjs
 * ============================================================ */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src', 'pages');
const ORIGIN = 'https://acmglobaltech.com';
const ASSET_V = 'v=10';

/* ---------- Single source of truth: navigation ---------- */
const NAV = [
  { label: 'Products', href: '/products/', items: [
    ['Banking Core', '/products/banking-core/'],
    ['Mobile Wallet', '/products/mobile-wallet/'],
    ['Exchange & FX', '/products/exchange-fx/'],
    ['RWA Tokenization', '/products/rwa-tokenization/'],
    ['Payments & Stablecoins', '/products/payments-stablecoins/'],
    ['Cards & Issuing', '/products/cards-issuing/'],
    ['Treasury & Liquidity', '/products/treasury-liquidity/'],
  ]},
  { label: 'Solutions', href: '/solutions/', items: [
    ['Lending Modernization', '/solutions/lending-modernization/'],
    ['Member Engagement', '/solutions/member-engagement/'],
    ['Core & Cloud Modernization', '/solutions/core-cloud-modernization/'],
    ['Data & Analytics', '/solutions/data-analytics/'],
    ['Cybersecurity & Fraud', '/solutions/cybersecurity-fraud/'],
    ['Embedded Finance', '/solutions/embedded-finance/'],
    ['Healthcare Finance', '/solutions/healthcare-finance/'],
  ]},
  { label: 'Industries', href: '/industries/', items: [
    ['Credit Unions', '/industries/credit-unions/'],
    ['Community & Mid-Sized Banks', '/industries/community-mid-banks/'],
    ['Healthcare', '/industries/healthcare/'],
    ['Broker-Dealers', '/industries/broker-dealers/'],
    ['Fintechs', '/industries/fintechs/'],
    ['Corporate Treasury', '/industries/corporate-treasury/'],
  ]},
  { label: 'Capabilities', href: '/capabilities/', items: [
    ['AI & Data', '/capabilities/ai-data/'],
    ['RWA & Stablecoins', '/capabilities/rwa-stablecoins/'],
    ['Industry-Leading FX', '/capabilities/fx-rates/'],
    ['Post-Quantum Security', '/capabilities/post-quantum-security/'],
    ['Hyperautomation', '/capabilities/hyperautomation/'],
    ['Agile Speed Framework', '/capabilities/agile-speed-framework/'],
    ['White-Label & Ownership', '/capabilities/white-label/'],
  ]},
  { label: 'Resources', href: '/docs/', items: [
    ['Documentation', '/docs/'],
    ['Support & Help', '/support/'],
    ['Trust & Security', '/trust/'],
    ['Case Studies', '/case-studies/'],
  ]},
  { label: 'Company', href: '/company/', items: [
    ['About', '/company/about/'],
    ['Our Vision', '/company/vision/'],
    ['Leadership Team', '/company/team/'],
    ['ACM Ventures', '/company/ventures/'],
    ['Careers', '/company/careers/'],
    ['Get Started', '/get-started/'],
    ['Contact', '/contact/'],
  ]},
];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- Header (mega-menu) ---------- */
function renderHeader(activeGroup) {
  const groups = NAV.map((g) => {
    const active = g.label === activeGroup ? ' active' : '';
    const items = g.items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('\n            ');
    return `<div class="nav-group">
          <button class="nav-top${active}" data-href="${g.href}" aria-expanded="false">${esc(g.label)}<span class="caret"></span></button>
          <div class="nav-panel">
            ${items}
            <a href="${g.href}" class="nav-all">All ${esc(g.label)} &rarr;</a>
          </div>
        </div>`;
  }).join('\n        ');
  return `<header class="header" id="header">
    <div class="container nav-wrap">
      <a href="/" class="logo" aria-label="ACM Global Tech home">
        <span class="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
            <path d="M20 3 34 11v18L20 37 6 29V11z" stroke="url(#hexg)" stroke-width="1.6" opacity=".5"/>
            <path d="M20 9 29 14v10l-9 5-9-5V14z" stroke="url(#hexg)" stroke-width="1.6" opacity=".8"/>
            <circle cx="20" cy="20" r="4.4" fill="url(#hexg)"/>
            <defs><linearGradient id="hexg" x1="6" y1="3" x2="34" y2="37" gradientUnits="userSpaceOnUse">
              <stop stop-color="#1F4FFF"/><stop offset="1" stop-color="#19C8D6"/></linearGradient></defs>
          </svg>
        </span>
        <span class="logo-text"><strong>ACM</strong> <span class="logo-accent">Global</span> Tech</span>
      </a>
      <nav class="nav" id="primary-nav" aria-label="Primary">
        ${groups}
      </nav>
      <a href="/login/" class="nav-login">Client Login</a>
      <a href="/contact/" class="btn btn-primary btn-nav" data-cta="Discovery Call">Get in Touch</a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`;
}

/* ---------- Footer (multi-column) ---------- */
function renderFooter() {
  const cols = NAV.map((g) => {
    const links = g.items.slice(0, 7).map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('\n          ');
    return `<div class="footer-col">
          <h4><a href="${g.href}">${esc(g.label)}</a></h4>
          ${links}
        </div>`;
  }).join('\n        ');
  return `<footer class="footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="/" class="logo logo-footer"><span class="logo-text"><strong>ACM</strong> <span class="logo-accent">Global</span> Tech</span></a>
        <p class="footer-tag">A complete, white-label banking ecosystem for credit unions, banks &amp; healthcare.</p>
        <p class="footer-meta">Orlando &amp; Jacksonville, FL &middot; Powering Global Transformation</p>
        <div class="footer-contact">
          <a href="tel:+14072790314">+1 (407) 279-0314</a>
          <a href="mailto:info@acmglobaltech.com">info@acmglobaltech.com</a>
          <a href="/login/" class="footer-login">Client Login &rarr;</a>
        </div>
        <p class="footer-partners">Hanzo.ai &amp; Lux Finance Ecosystem Partners</p>
      </div>
        ${cols}
    </div>
    <div class="container copyright">&copy; <span id="year"></span> ACM Global Tech. All rights reserved. &middot; <a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/trust/">Trust &amp; Security</a> &middot; Powering Global Transformation</div>
  </footer>`;
}

/* ---------- Breadcrumb HTML + JSON-LD ---------- */
function crumbTrail(slug, h1) {
  const trail = [{ name: 'Home', url: '/' }];
  if (!slug) return trail;
  const parts = slug.split('/');
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    acc += '/' + parts[i];
    const isLast = i === parts.length - 1;
    const navMatch = NAV.find((g) => g.href === acc + '/');
    const childMatch = NAV.flatMap((g) => g.items).find(([, h]) => h === acc + '/');
    let name = navMatch ? navMatch.label : (childMatch ? childMatch[0] : parts[i]);
    if (isLast) name = h1 || name;
    trail.push({ name, url: acc + '/' });
  }
  return trail;
}
function renderBreadcrumb(trail) {
  if (trail.length < 2) return '';
  const items = trail.map((c, i) => i === trail.length - 1
    ? `<span aria-current="page">${esc(c.name)}</span>`
    : `<a href="${c.url}">${esc(c.name)}</a>`).join('<span class="crumb-sep">/</span>');
  return `<nav class="crumbs" aria-label="Breadcrumb"><div class="container">${items}</div></nav>`;
}

/* ---------- JSON-LD ---------- */
function jsonLd(page, trail, canonical) {
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'ACM Global Tech', url: ORIGIN + '/',
    logo: ORIGIN + '/assets/og.png', description: 'White-label banking technology and a complete banking ecosystem for credit unions, mid-sized banks, and healthcare.',
    email: 'info@acmglobaltech.com', telephone: '+1-407-279-0314',
    address: { '@type': 'PostalAddress', addressLocality: 'Jacksonville', addressRegion: 'FL', addressCountry: 'US' },
  };
  const blocks = [org];
  const ptype = page.jsonldType && page.jsonldType !== 'Organization' ? page.jsonldType : 'WebPage';
  blocks.push({ '@context': 'https://schema.org', '@type': ptype, name: page.h1 || page.title, description: page.metaDescription, url: canonical, isPartOf: { '@type': 'WebSite', name: 'ACM Global Tech', url: ORIGIN + '/' } });
  if (trail.length > 1) {
    blocks.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: ORIGIN + c.url })) });
  }
  if (Array.isArray(page.faq) && page.faq.length) {
    blocks.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  return blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n  ');
}

/* ---------- FAQ section (visible) ---------- */
function renderFaq(faq) {
  if (!Array.isArray(faq) || !faq.length) return '';
  const items = faq.map((f) => `<div class="glass faq-item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n        ');
  return `<section class="section surface"><div class="container"><span class="tag"><span class="dot"></span> FAQ</span><h2 class="section-title">Frequently asked questions</h2><div class="faq-list">\n        ${items}\n      </div></div></section>`;
}

/* ---------- Full page ---------- */
function renderPage(page) {
  const slug = page.slug || '';
  const canonical = ORIGIN + (slug ? '/' + slug + '/' : '/');
  const trail = crumbTrail(slug, page.h1);
  const title = page.title;
  const ogImage = ORIGIN + '/assets/og.png';
  const breadcrumb = slug ? renderBreadcrumb(trail) : '';
  const h1 = slug ? `<h1 class="visually-hidden">${esc(page.h1 || title)}</h1>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(page.metaDescription)}" />
  ${page.keywords && page.keywords.length ? `<meta name="keywords" content="${esc(page.keywords.join(', '))}" />` : ''}
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ACM Global Tech" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(page.metaDescription)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(page.metaDescription)}" />
  <meta name="twitter:image" content="${ogImage}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?${ASSET_V}" />
  ${jsonLd(page, trail, canonical)}
</head>
<body>
  <div class="bg-floaties" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
  ${renderHeader(page.group)}
  ${breadcrumb}
  <main id="main">
    ${h1}
${page.contentHtml}
    ${renderFaq(page.faq)}
  </main>
  ${renderFooter()}
  <script src="/script.js?${ASSET_V}"></script>
</body>
</html>
`;
}

/* ---------- Parse a source fragment ---------- */
function parseFragment(raw, fileSlug) {
  let meta = {}, body = raw;
  const m = raw.match(/^\s*<!--META\s*([\s\S]*?)-->/);
  if (m) { meta = JSON.parse(m[1]); body = raw.slice(m[0].length); }
  meta.slug = meta.slug != null ? meta.slug : fileSlug;
  meta.contentHtml = body.trim();
  meta.group = meta.group || groupForSlug(meta.slug);
  return meta;
}
function groupForSlug(slug) {
  if (!slug) return '';
  const top = '/' + slug.split('/')[0] + '/';
  const g = NAV.find((n) => n.href === top);
  return g ? g.label : '';
}

/* ---------- Walk src/pages ---------- */
async function walk(dir, base = '') {
  let out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(await walk(full, rel));
    else if (e.name.endsWith('.html')) out.push({ full, slug: rel.replace(/\.html$/, '').replace(/(^|\/)index$/, '') });
  }
  return out;
}

async function build() {
  const files = await walk(SRC);
  const urls = [];
  for (const f of files) {
    const raw = await fs.readFile(f.full, 'utf8');
    const page = parseFragment(raw, f.slug);
    const html = renderPage(page);
    const outDir = page.slug ? path.join(ROOT, page.slug) : ROOT;
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'index.html'), html);
    urls.push(ORIGIN + (page.slug ? '/' + page.slug + '/' : '/'));
  }
  // sitemap.xml
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.sort().map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>\n`;
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemap);
  // robots.txt
  await fs.writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  console.log(`Built ${files.length} pages -> ${urls.length} URLs, sitemap.xml, robots.txt`);
}

build().catch((e) => { console.error(e); process.exit(1); });
