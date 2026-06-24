#!/usr/bin/env node
/* ============================================================
 * ACM Global Tech, static multi-page build
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
const ASSET_V = 'v=44';

/* ---------- Analytics & advertising (consent-gated, OFF by default) ----------
 * Paste your IDs to switch measurement on. Empty = nothing loads: no tags in
 * <head>, no consent banner, zero third-party requests, same gate as the AI /
 * Worker keys. When set, tags fire only AFTER the visitor accepts (or instantly
 * if `consentBanner` is false). Every captured lead then fires GA4
 * `generate_lead` + Meta `Lead`, tagged with the opportunity, institution
 * segment, asset size, timeline, and hot/standard quality.
 *   ga4Id, GA4 Measurement ID, e.g. "G-XXXXXXXXXX"
 *   metaPixel, Meta (Facebook) Pixel ID, the numeric ID
 *   consentBanner, show a consent banner and hold tags until "Accept"
 */
const ANALYTICS = {
  ga4Id: '',
  metaPixel: '',
  consentBanner: true,
};
const ANALYTICS_ON = !!(ANALYTICS.ga4Id || ANALYTICS.metaPixel);
function analyticsConfigTag() {
  if (!ANALYTICS_ON) return '';
  const cfg = { ga4: ANALYTICS.ga4Id || '', metaPixel: ANALYTICS.metaPixel || '', consent: ANALYTICS.consentBanner !== false };
  return `\n  <script>window.ACM_ANALYTICS=${JSON.stringify(cfg)};</script>`;
}
function consentBanner() {
  if (!ANALYTICS_ON || ANALYTICS.consentBanner === false) return '';
  return `<div class="consent" id="consentBanner" hidden>
    <div class="consent-inner glass">
      <p class="consent-copy">We use cookies to measure traffic and improve ACM Global Tech. Accept analytics &amp; marketing cookies, or decline. Either way, the site works the same. See our <a href="/privacy/">Privacy Policy</a>.</p>
      <div class="consent-actions">
        <button type="button" class="btn btn-ghost" id="consentDecline">Decline</button>
        <button type="button" class="btn btn-primary" id="consentAccept">Accept</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Single source of truth: navigation ---------- */
const NAV = [
  { label: 'Platform', href: '/post-quantum/', items: [
    ['Post-Quantum', '/post-quantum/'],
    ['Digital Securities', '/digital-securities/'],
    ['Banking & Payments', '/banking-payments/'],
    ['AI & Data', '/ai-data/'],
    ['Privacy & FHE', '/fhe/'],
    ['White-Label Builder', '/white-label/'],
    ['Alternative Trading System', '/ats/'],
    ['Broker-Dealer', '/broker-dealer/'],
    ['Transfer Agent', '/transfer-agent/'],
    ['MPC Custody', '/custody/'],
    ['Built-In DEX', '/dex/'],
    ['Platform-as-a-Service', '/paas/'],
  ]},
  { label: 'Products', href: '/products/', items: [
    ['Banking Core', '/products/banking-core/'],
    ['Mobile Wallet', '/products/mobile-wallet/'],
    ['Exchange & FX', '/products/exchange-fx/'],
    ['RWA Tokenization', '/products/rwa-tokenization/'],
    ['Payments & Stablecoins', '/products/payments-stablecoins/'],
    ['Cards & Issuing', '/products/cards-issuing/'],
    ['Treasury & Liquidity', '/products/treasury-liquidity/'],
    ['White-Label PSP', '/products/white-label-psp/'],
    ['Banking-as-a-Service', '/products/baas/'],
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
    ['Real-Time AML', '/aml/'],
    ['KYC & Identity', '/kyc/'],
    ['Compliance', '/compliance/'],
    ['AI Gateway', '/ai-gateway/'],
    ['AI Inference', '/inference/'],
    ['Agentic AI', '/agents/'],
    ['Data Platform', '/data-platform/'],
  ]},
  { label: 'Resources', href: '/docs/', items: [
    ['Documentation', '/docs/'],
    ['Support & Help', '/support/'],
    ['Trust & Security', '/trust/'],
    ['Research', '/research/'],
    ['News', '/news/'],
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
const byLabel = (l) => NAV.find((g) => g.label === l);
// Header nav: Industries & Capabilities are nested inside the Solutions mega-panel.
const HEADER_NAV = [
  byLabel('Platform'),
  byLabel('Products'),
  { label: 'Solutions', href: '/solutions/', columns: [
    { label: 'Solutions', href: '/solutions/', items: byLabel('Solutions').items },
    { label: 'Industries', href: '/industries/', items: byLabel('Industries').items },
    { label: 'Capabilities', href: '/capabilities/', items: byLabel('Capabilities').items },
  ] },
  byLabel('Resources'),
  byLabel('Company'),
];
function renderHeader(activeGroup) {
  const groups = HEADER_NAV.map((g) => {
    const active = (g.label === activeGroup || (g.columns && g.columns.some((c) => c.label === activeGroup))) ? ' active' : '';
    let panel;
    if (g.columns) {
      panel = `<div class="nav-panel mega">
            ` + g.columns.map((c) => `<div class="nav-col"><a class="nav-col-head" href="${c.href}">${esc(c.label)}</a>` + c.items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('') + `</div>`).join('\n            ') + `
          </div>`;
    } else {
      panel = `<div class="nav-panel">
            ` + g.items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('\n            ') + `
            <a href="${g.href}" class="nav-all">All ${esc(g.label)} &rarr;</a>
          </div>`;
    }
    return `<div class="nav-group">
          <button class="nav-top${active}" data-href="${g.href}" aria-expanded="false">${esc(g.label)}<span class="caret"></span></button>
          ${panel}
        </div>`;
  }).join('\n        ');
  return `<header class="header" id="header">
    <div class="container nav-wrap">
      <a href="/" class="logo" aria-label="ACM Global Tech home">
        <img class="logo-wordmark" src="/assets/acm.svg?v=36" alt="" aria-hidden="true" width="138" height="34" />
      </a>
      <nav class="nav" id="primary-nav" aria-label="Primary">
        ${groups}
      </nav>
      <a href="/login/" class="nav-login">Client Login</a>
      <a href="/get-started/#contactForm" class="btn btn-primary btn-nav" data-cta="Discovery Call">Get in Touch</a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`;
}

/* ---------- Footer (CTA band + multi-column + newsletter + badges) ---------- */
function renderFooter() {
  const cols = NAV.filter((g) => g.label !== 'Solutions').map((g) => {
    const links = g.items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('\n          ');
    return `<div class="footer-col">
          <h4><a href="${g.href}">${esc(g.label)}</a></h4>
          ${links}
        </div>`;
  }).join('\n        ');
  return `<section class="footer-cta"><div class="container footer-cta-inner">
      <div class="footer-cta-copy">
        <h2>Ready to modernize your institution?</h2>
        <p>Talk to ACM about a regulated, white-label banking stack, core, payments, wallets, exchange, and tokenized finance you own.</p>
      </div>
      <div class="footer-cta-actions">
        <a href="/get-started/#contactForm" class="btn btn-primary btn-lg" data-cta="Discovery Call">Schedule a Discovery Call</a>
        <a href="/get-started/" class="btn btn-ghost btn-lg">Get Started</a>
      </div>
    </div></section>
  <footer class="footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="/" class="logo logo-footer"><span class="logo-text"><strong>ACM</strong><span class="logo-suffix"><span class="logo-accent">Global</span> Tech</span></span></a>
        <p class="footer-tag">A complete, white-label banking ecosystem for credit unions, banks &amp; healthcare.</p>
        <form class="footer-news" id="footerNews" novalidate aria-label="Newsletter signup">
          <label for="footerNewsEmail">Get ACM insights &amp; release notes</label>
          <div class="footer-news-row">
            <input type="email" id="footerNewsEmail" name="email" placeholder="you@institution.com" required />
            <button type="submit" class="btn btn-primary">Subscribe</button>
          </div>
          <p class="footer-news-note" id="footerNewsNote" hidden></p>
        </form>
        <p class="footer-meta">Orlando &amp; Jacksonville, FL &middot; Powering Global Transformation</p>
        <div class="footer-contact">
          <a href="tel:+14072790314">+1 (407) 279-0314</a>
          <a href="mailto:info@acmglobaltech.com">info@acmglobaltech.com</a>
          <a href="/login/" class="footer-login">Client Login &rarr;</a>
        </div>
      </div>
        ${cols}
    </div>
    <div class="container copyright">&copy; <span id="year"></span> ACM Global Tech. All rights reserved. &middot; <a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/trust/">Trust &amp; Security</a> &middot; Powering Global Transformation</div>
  </footer>`;
}

/* ---------- AI assistant (Hanzo-powered, site-wide) ---------- */
/* ---------- Per-page "talk to an expert" CTA (opportunity capture) ---------- */
function expertCta(page) {
  const slug = page.slug || '';
  if (!slug || ['privacy', 'terms', 'login', 'contact', 'get-started'].indexOf(slug) !== -1) return '';
  const childMatch = NAV.flatMap((g) => g.items).find(([, h]) => h === '/' + slug + '/');
  const navMatch = NAV.find((g) => g.href === '/' + slug + '/');
  const topic = (childMatch && childMatch[0]) || (navMatch && navMatch.label) || page.h1 || page.title;
  return `<section class="expert-cta"><div class="container expert-cta-inner">
      <div class="expert-cta-copy">
        <span class="tag"><span class="dot"></span> Talk to ACM</span>
        <h2 class="expert-cta-title">Ready to talk about ${esc(topic)}?</h2>
        <p class="expert-cta-sub">Get a tailored walkthrough and a straight answer on fit, timeline, and cost for your institution.</p>
      </div>
      <button class="btn btn-primary btn-lg expert-cta-btn" data-lead="Expert consult, ${esc(topic)}" data-lead-kind="Talk to ACM" data-lead-title="Talk to an expert about ${esc(topic)}" data-lead-sub="Tell us a bit about your institution and we'll connect you with the right ACM specialist, usually same day." data-lead-submit="Request my consult">Talk to an expert &rarr;</button>
    </div></section>`;
}

function leadModal() {
  return `<div class="lead-modal" id="leadModal" hidden>
    <div class="lead-overlay" id="leadOverlay"></div>
    <div class="lead-card glass" role="dialog" aria-modal="true" aria-labelledby="leadTitle">
      <button class="lead-close" id="leadClose" aria-label="Close">&times;</button>
      <span class="tag"><span class="dot"></span> <span id="leadKind">Resource</span></span>
      <h3 class="lead-title" id="leadTitle">Get the full details</h3>
      <p class="lead-sub" id="leadSub">Tell us where to send it and we'll email it right over.</p>
      <form class="lead-form" id="leadForm" novalidate>
        <input type="hidden" name="cta" id="leadCta" value="" />
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="lead-hp" />
        <div class="field-row">
          <label class="field"><span>Name</span><input type="text" name="name" required /></label>
          <label class="field"><span>Work email</span><input type="email" name="email" required /></label>
        </div>
        <label class="field"><span>Institution</span><input type="text" name="company" /></label>
        <div class="field-row lead-qual">
          <label class="field"><span>Institution type</span>
            <select name="segment">
              <option value="">Select&hellip;</option>
              <option>Credit Union</option>
              <option>Community / Mid-Sized Bank</option>
              <option>Healthcare</option>
              <option>Broker-Dealer</option>
              <option>Fintech</option>
              <option>Other</option>
            </select>
          </label>
          <label class="field"><span>Assets / AUM</span>
            <select name="assetSize">
              <option value="">Select&hellip;</option>
              <option>Under $500M</option>
              <option>$500M&ndash;$2B</option>
              <option>$2B&ndash;$10B</option>
              <option>$10B+</option>
            </select>
          </label>
        </div>
        <label class="field"><span>Timeline</span>
          <select name="timeline">
            <option value="">Select&hellip;</option>
            <option>Actively evaluating (&lt;90 days)</option>
            <option>This year</option>
            <option>Just exploring</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary btn-block" id="leadSubmit">Email it to me</button>
        <p class="lead-note" id="leadNote" hidden></p>
        <div class="lead-proof">
          <span><strong>70&rarr;20</strong> eng team</span>
          <span><strong>$50K&rarr;$5K</strong> compute</span>
          <span><strong>100&times;</strong> performance</span>
          <span><strong>Trillions</strong> in securities</span>
        </div>
        <p class="lead-fineprint">We'll only use this to share what you asked for and follow up. No spam. Unsubscribe anytime.</p>
      </form>
    </div>
  </div>`;
}

function schedulerModal() {
  return `<div class="sched-modal" id="schedModal" hidden>
    <div class="sched-overlay" id="schedOverlay"></div>
    <div class="sched-card glass" role="dialog" aria-modal="true" aria-labelledby="schedTitle">
      <button class="lead-close" id="schedClose" aria-label="Close">&times;</button>
      <span class="tag"><span class="dot"></span> Schedule</span>
      <h3 class="lead-title" id="schedTitle">Book a discovery call</h3>
      <p class="lead-sub" id="schedSub">Pick a time that suits you and we'll send a calendar invite.</p>
      <div class="sched-loading" id="schedLoading" hidden>Loading available times&hellip;</div>
      <div class="sched-slots" id="schedSlots" hidden></div>
      <form class="lead-form sched-details" id="schedForm" hidden novalidate>
        <input type="hidden" name="slot" id="schedSlotInput" />
        <p class="sched-chosen" id="schedChosen"></p>
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="lead-hp" />
        <div class="field-row">
          <label class="field"><span>Name</span><input type="text" name="name" required /></label>
          <label class="field"><span>Work email</span><input type="email" name="email" required /></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Institution</span><input type="text" name="company" /></label>
          <label class="field"><span>Phone</span><input type="tel" name="phone" /></label>
        </div>
        <label class="field"><span>Anything we should know?</span><textarea name="message" rows="2"></textarea></label>
        <button type="submit" class="btn btn-primary btn-block" id="schedSubmit">Confirm booking</button>
        <button type="button" class="sched-back" id="schedBack">&larr; Pick another time</button>
      </form>
      <div class="sched-status" id="schedStatus" hidden></div>
      <p class="lead-note" id="schedNote" hidden></p>
    </div>
  </div>`;
}

function aiWidget() {
  return ''; // ACM AI assistant hidden until it's wired to index the site + docs; delete this line to restore
  return `<div class="ai-assistant" id="aiAssistant">
    <button class="ai-launcher" id="aiLauncher" aria-expanded="false" aria-controls="aiPanel" aria-label="Ask ACM AI">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>
      <span>Ask ACM&nbsp;AI</span>
    </button>
    <div class="ai-panel" id="aiPanel" role="dialog" aria-label="ACM AI assistant" hidden>
      <div class="ai-head">
        <span class="ai-title"><span class="ai-dot"></span> ACM AI <em>&middot; powered by Hanzo</em></span>
        <button class="ai-close" id="aiClose" aria-label="Close assistant">&times;</button>
      </div>
      <div class="ai-log" id="aiLog" aria-live="polite"></div>
      <div class="ai-suggest" id="aiSuggest">
        <button type="button">What does ACM do?</button>
        <button type="button">How does pricing work?</button>
        <button type="button">Is the platform post-quantum secure?</button>
      </div>
      <form class="ai-input" id="aiForm">
        <input type="text" id="aiText" placeholder="Ask about ACM&hellip;" autocomplete="off" aria-label="Message" />
        <button type="submit" aria-label="Send message">&#8593;</button>
      </form>
    </div>
  </div>`;
}

/* ---------- AI integrations strip (model-agnostic, names only) ---------- */
function integrations() {
  const names = ['OpenAI', 'Anthropic', 'Google', 'Meta Llama', 'Mistral', 'Cohere', 'AWS', 'Hanzo AI'];
  return `<section class="integrations-band"><div class="container">
      <p class="integrations-eyebrow">Model-agnostic &middot; integrates with the AI platforms you already trust</p>
      <div class="integrations-row">` + names.map((n) => `<span>${esc(n)}</span>`).join('') + `</div>
    </div></section>`;
}

/* ---------- Ecosystem partner banner (site-wide, before footer) ---------- */
function partnerBanner() {
  return `<section class="partners-band"><div class="container">
      <span class="tag"><span class="dot"></span> Ecosystem Partners</span>
      <h2 class="partners-title">Backed by a world-class ecosystem</h2>
      <p class="partners-lead">ACM Global Tech is an ecosystem partner of Hanzo.ai and Lux Network and a member of the W3A (Web3 Alliance), pairing enterprise-grade agentic AI with institutional tokenized-finance and settlement infrastructure.</p>
      <div class="partners-grid">
        <a class="partner-card" href="https://hanzo.ai/" target="_blank" rel="noopener noreferrer" aria-label="Visit Hanzo.ai">
          <span class="partner-logo"><svg class="partner-mark-svg" viewBox="0 0 67 67" aria-hidden="true"><path d="M22.21 67V44.6369H0V67H22.21Z" fill="#fff"/><path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#fff"/><path d="M22.21 0H0V22.3184H22.21V0Z" fill="#fff"/><path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#fff"/><path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#fff"/></svg><span class="partner-name">Hanzo</span></span>
          <p>Agentic AI and developer infrastructure powering ACM's AI &amp; data layer.</p>
        </a>
        <a class="partner-card" href="https://lux.network/" target="_blank" rel="noopener noreferrer" aria-label="Visit Lux Network">
          <span class="partner-logo"><svg class="partner-mark-svg" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 85 L15 25 L85 25 Z" fill="#fff"/></svg><span class="partner-name">Lux Network</span></span>
          <p>Institutional tokenized-finance, exchange, and settlement rails behind ACM's RWA &amp; FX.</p>
        </a>
        <a class="partner-card" href="https://w3a.foundation" target="_blank" rel="noopener noreferrer" aria-label="Visit W3A, the Web3 Alliance">
          <span class="partner-logo"><svg class="partner-mark-svg" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16.000" cy="3.000" r="1.7" fill="#fff"/><circle cx="22.041" cy="4.489" r="1.7" fill="#fff"/><circle cx="26.699" cy="8.615" r="1.7" fill="#fff"/><circle cx="28.905" cy="14.433" r="1.7" fill="#fff"/><circle cx="28.155" cy="20.610" r="1.7" fill="#fff"/><circle cx="24.621" cy="25.731" r="1.7" fill="#fff"/><circle cx="19.111" cy="28.622" r="1.7" fill="#fff"/><circle cx="12.889" cy="28.622" r="1.7" fill="#fff"/><circle cx="7.379" cy="25.731" r="1.7" fill="#fff"/><circle cx="3.845" cy="20.610" r="1.7" fill="#fff"/><circle cx="3.095" cy="14.433" r="1.7" fill="#fff"/><circle cx="5.301" cy="8.615" r="1.7" fill="#fff"/><circle cx="9.959" cy="4.489" r="1.7" fill="#fff"/></svg><span class="partner-name">W3A</span></span>
          <p>The Web3 Alliance, advancing shared standards and IP for regulated, post-quantum finance infrastructure.</p>
        </a>
      </div>
    </div></section>`;
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

/* ---------- Visual decoration: icons on feature cards + trust strip ---------- */
const ICON_SVGS = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3 2.7-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M20.5 20c0-2.2-1-3.7-2.7-4.6"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18H7z"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M15 15h3"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8"/>',
  growth: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  cube: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/>',
  bank: '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/>',
  heart: '<path d="M2 12h4l2-6 4 12 2-6h6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  badge: '<path d="M12 3l2.4 1.7 2.9-.3 1 2.8 2.6 1.3-.6 2.9 1.5 2.5-2 2.1-.3 2.9-2.9.4L12 22l-2.6-1.5-2.9-.4-.3-2.9-2-2.1L5.7 12 5 9.5l2.6-1.3 1-2.8 2.9.3z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
};
const ICON_RULES = [
  [/secur|cyber|fraud|quantum|protect|threat|defen|incident/i, 'shield'],
  [/complian|regulat|audit|kyc|aml|certif|govern/i, 'badge'],
  [/lend|loan|credit|growth|revenue|roi|origination/i, 'growth'],
  [/member|engage|customer|retention|people|experience|relationship/i, 'people'],
  [/data|analytic|insight|\bai\b|intelligen|predict|model/i, 'chart'],
  [/cloud|core|modern|infrastructure|platform|migrat|scal/i, 'cloud'],
  [/card|issu/i, 'card'],
  [/wallet|mobile|app\b/i, 'card'],
  [/exchange|\bfx\b|currenc|cross-border|remittance/i, 'swap'],
  [/token|\brwa\b|asset|stablecoin|settle|issuance/i, 'cube'],
  [/payment|treasur|liquid|deposit|embedded finance/i, 'bank'],
  [/bank|institution|union|broker|dealer/i, 'bank'],
  [/health|patient|payer|provider|revenue cycle|claims/i, 'heart'],
  [/speed|agile|deploy|automat|fast|hyperautomation|efficien|workflow/i, 'bolt'],
  [/privacy|encrypt|data protection|residency|key/i, 'lock'],
  [/global|world|international|ecosystem|network/i, 'globe'],
];
function svgIcon(k) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICON_SVGS[k] || ICON_SVGS.diamond) + '</svg>'; }
function pickIcon(t) { const s = t.replace(/<[^>]+>/g, ''); for (const [re, k] of ICON_RULES) if (re.test(s)) return svgIcon(k); return svgIcon('diamond'); }
function decorate(html) {
  // Add an icon to plain feature cards that don't already have one.
  return html.replace(/<div class="glass sol-card">\s*<h3>([\s\S]*?)<\/h3>/g,
    (m, t) => '<div class="glass sol-card"><span class="sol-ic">' + pickIcon(t) + '</span><h3>' + t + '</h3>');
}
function colsFor(n) {
  // Pick a column count that tiles n cards into a complete rectangle (capped at 4).
  // Primes (5/7/11) fall back to 3-up; the centered flex keeps their last row balanced.
  const map = { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3, 7: 3, 8: 4, 9: 3, 10: 2, 11: 3, 12: 3 };
  if (n in map) return map[n];
  if (n % 3 === 0) return 3;
  if (n % 4 === 0) return 4;
  if (n % 2 === 0) return 2;
  return 3;
}
function balanceGrids(html) {
  // Stamp each .solutions-grid with cols-N based on how many cards it holds, so the
  // layout always tiles into a complete rectangle (no stranded orphan in the last row).
  const open = /<div class="([^"]*\bsolutions-grid\b[^"]*)">/g;
  let m, out = '', last = 0;
  while ((m = open.exec(html))) {
    const tagStart = m.index, tagEnd = open.lastIndex;
    const dre = /<\/?div\b[^>]*>/g; dre.lastIndex = tagEnd;
    let depth = 1, t, end = html.length;
    while ((t = dre.exec(html))) {
      if (t[0][1] === '/') { if (--depth === 0) { end = t.index; break; } }
      else depth++;
    }
    const kids = (html.slice(tagEnd, end).match(/\bsol-card\b/g) || []).length;
    const cls = (m[1].replace(/\s*\bcols-\d+\b/g, '').trim()) + ' cols-' + colsFor(kids);
    out += html.slice(last, tagStart) + '<div class="' + cls + '">';
    last = tagEnd;
  }
  return out + html.slice(last);
}
function announceBar() {
  return `<div class="announce" id="announceBar"><a class="announce-link" href="/news/pqc-2030-mandate/" data-cta="Announce: 2030 PQC Mandate"><span class="announce-dot" aria-hidden="true"></span><strong>New</strong> The White House set a 2030 post-quantum deadline, see how ACM delivers immediate PQ readiness <span class="announce-arrow" aria-hidden="true">&rarr;</span></a><button class="announce-x" type="button" aria-label="Dismiss announcement" onclick="try{localStorage.setItem('acm-announce-closed','1')}catch(e){}document.documentElement.style.setProperty('--announce-h','0px')">&times;</button></div>`;
}
function trustStrip() {
  return '<div class="trust-strip"><div class="container"><span>Regulated-first architecture</span><span>Post-quantum cryptography</span><span>White-label &amp; client-owned</span><span>Hanzo.ai &amp; Lux Network ecosystem</span></div></div>';
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
  let content = balanceGrids(decorate(page.contentHtml));
  if (slug && content.includes('class="page-hero"')) {
    const i = content.indexOf('</section>');
    if (i !== -1) content = content.slice(0, i + 10) + '\n  ' + trustStrip() + '\n' + content.slice(i + 10);
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/favicon.svg?${ASSET_V}" type="image/svg+xml" />
  <link rel="icon" href="/favicon-32.png?${ASSET_V}" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?${ASSET_V}" />
  <meta name="theme-color" content="#1F4FFF" />
  <script>try{if(localStorage.getItem('acm-announce-closed'))document.documentElement.style.setProperty('--announce-h','0px')}catch(e){}</script>
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
  <link rel="preconnect" href="https://api.fontshare.com" />
  <link rel="preconnect" href="https://cdn.fontshare.com" crossorigin />
  <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?${ASSET_V}" />${analyticsConfigTag()}
  ${jsonLd(page, trail, canonical)}
</head>
<body>
  ${announceBar()}
  <div class="bg-floaties" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
  ${renderHeader(page.group)}
  ${breadcrumb}
  <main id="main">
    ${h1}
${content}
    ${renderFaq(page.faq)}
  </main>
  ${expertCta(page)}
  ${integrations()}
  ${partnerBanner()}
  ${renderFooter()}
  ${aiWidget()}
  ${leadModal()}
  ${schedulerModal()}
  ${consentBanner()}
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
