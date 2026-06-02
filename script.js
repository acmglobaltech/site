/* ===== ACM Global Tech — interactions ===== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Year --- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* --- Header background on scroll --- */
  var header = document.getElementById('header');
  function headerScroll() {
    if (window.scrollY > 8) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', headerScroll, { passive: true });
  headerScroll();

  /* --- Mobile nav toggle --- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --- Mega-menu: hover dropdowns (desktop) + accordion (mobile) --- */
  var navGroups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
  function isMobileNav() { return window.matchMedia('(max-width: 1100px)').matches; }
  navGroups.forEach(function (g) {
    var top = g.querySelector('.nav-top');
    if (!top) return;
    top.addEventListener('click', function (e) {
      if (isMobileNav()) {
        e.preventDefault();
        var open = g.classList.toggle('open');
        top.setAttribute('aria-expanded', open ? 'true' : 'false');
        navGroups.forEach(function (o) { if (o !== g) o.classList.remove('open'); });
      } else {
        var href = top.getAttribute('data-href');
        if (href) window.location.href = href;
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-group')) navGroups.forEach(function (g) { g.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') navGroups.forEach(function (g) { g.classList.remove('open'); });
  });
  if (toggle) toggle.addEventListener('click', function () {
    if (!nav || !nav.classList.contains('open')) navGroups.forEach(function (g) { g.classList.remove('open'); });
  });

  /* --- Scroll spy --- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[id], [id]'))
    .filter(function (el) { return el.id && document.querySelector('.nav a[href="#' + el.id + '"]'); });
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  function spy() {
    var pos = window.scrollY + 110;
    var current = '';
    sections.forEach(function (s) { if (s.offsetTop <= pos) current = s.id; });
    links.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', spy, { passive: true });

  /* --- Parallax backgrounds --- */
  var layers = Array.prototype.slice.call(document.querySelectorAll('.slide-bg'));
  function parallax() {
    if (reduceMotion) return;
    var vh = window.innerHeight;
    layers.forEach(function (layer) {
      var parent = layer.parentElement;
      var rect = parent.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return; // offscreen
      var speed = parseFloat(layer.getAttribute('data-speed')) || 0.3;
      // distance of section center from viewport center
      var offset = (rect.top + rect.height / 2 - vh / 2);
      layer.style.transform = 'translate3d(0,' + (-offset * speed) + 'px,0)';
    });
  }

  /* --- rAF scroll loop --- */
  var ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        parallax();
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', parallax);
  parallax();
  spy();

  /* --- Reveal + stat count-up on scroll --- */
  var revealEls = document.querySelectorAll(
    '.section, .dashboard, .metric-card, .sol-card, .prod-card, .process-steps li, .why-card, .team-card, .pillar, .quote-card, .results-card'
  );
  revealEls.forEach(function (el) { el.classList.add('reveal'); });

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (isNaN(target) || reduceMotion) return;
    var start = null, dur = 1100;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          var num = e.target.querySelector ? e.target.querySelector('.stat-num[data-count]') : null;
          if (num && !num.dataset.done) { num.dataset.done = '1'; countUp(num); }
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ============================================================
     Wix backend wiring — "funnel to CRM" model
     ------------------------------------------------------------
     The Wix site here is headless: the only live Wix backend is
     the CRM (Contacts). So every call-to-action funnels into the
     contact form below and creates a CRM lead tagged with the
     button's intent (the hidden `cta` field). No Wix Bookings /
     Members / Payments pages are required.

     Submit path:
       1) POST the lead to CONTACT_FORM_ENDPOINT — a Cloudflare
          Worker that holds the Wix API key and writes to Wix CRM.
          Deploy it from wix/ :  npx wrangler deploy
       2) If that endpoint isn't configured yet (still contains
          "<subdomain>") or the POST fails, fall back to a
          pre-filled mailto: so a lead is never lost.
     ============================================================ */
  var WIX_CONFIG = {
    // Velo HTTP function (wix/http-functions.js), published in the Wix site.
    // /_functions/contact once published; /_functions-dev/contact to test pre-publish.
    CONTACT_FORM_ENDPOINT: 'https://www.acmglobaltech.com/_functions/contact',
    CONTACT_EMAIL: 'info@acmglobaltech.com'
  };
  var ENDPOINT_READY = WIX_CONFIG.CONTACT_FORM_ENDPOINT.indexOf('<subdomain>') === -1;

  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  var ctaField = document.getElementById('ctaField');
  var ctaHint = document.getElementById('ctaHint');

  /* Intent-specific copy, keyed by each button's data-cta value. */
  var CTA_INTENT = {
    'Discovery Call': { hint: '', message: '' },
    'Deposit / Retainer': {
      hint: 'Starting an engagement: send this and we\'ll reply with a secure deposit invoice.',
      message: 'I\'d like to start an engagement and pay a deposit.'
    },
    'Client Portal Access': {
      hint: 'Existing client: send this and we\'ll verify your account and share portal access.',
      message: 'I\'m an existing client and need access to the client portal.'
    },
    'Book a Meeting': {
      hint: 'Pick "Book a meeting" below and add a couple of times that work; we\'ll confirm a slot.',
      message: 'I\'d like to book a meeting.'
    },
    'ACM Ventures': {
      hint: 'Tell us about your startup, stage, and round, and the ACM Ventures team will be in touch.',
      message: 'I\'d like to pitch ACM Ventures.'
    }
  };

  /* Booking: reveal the preferred-time field only when "Book a meeting" is chosen. */
  var bookingField = document.getElementById('bookingField');
  function syncBooking() {
    var g = form && form.querySelector('input[name="goal"]:checked');
    if (bookingField) bookingField.hidden = !(g && g.value === 'Book a meeting');
  }
  if (form) {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="goal"]'), function (r) {
      r.addEventListener('change', syncBooking);
    });
  }
  /* Map certain CTAs to a preselected "goal" chip. */
  var GOAL_FOR_CTA = { 'Book a Meeting': 'Book a meeting', 'Discovery Call': 'Book a meeting' };

  function focusFirstEmpty() {
    if (!form) return;
    var order = ['name', 'email', 'message'];
    for (var i = 0; i < order.length; i++) {
      var el = form.elements[order[i]];
      if (el && !el.value) { el.focus(); return; }
    }
  }

  /* Every [data-cta] funnels into the contact form, tagged by intent. */
  document.querySelectorAll('[data-cta]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var intent = el.getAttribute('data-cta') || 'Discovery Call';
      var spec = CTA_INTENT[intent] || CTA_INTENT['Discovery Call'];
      if (ctaField) ctaField.value = intent;
      if (ctaHint) {
        ctaHint.textContent = spec.hint || '';
        ctaHint.hidden = !spec.hint;
      }
      // Pre-fill the message only if the visitor hasn't typed their own.
      var msg = form && form.elements['message'];
      if (msg && !msg.value && spec.message) msg.value = spec.message;

      // Preselect the matching goal chip (and reveal booking field) for some CTAs.
      var goalVal = GOAL_FOR_CTA[intent];
      if (goalVal && form) {
        var gr = form.querySelector('input[name="goal"][value="' + goalVal + '"]');
        if (gr) { gr.checked = true; syncBooking(); }
      }

      var contact = document.getElementById('contact');
      if (contact) {
        e.preventDefault();
        contact.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (form) {
          form.classList.add('cta-focus');
          window.setTimeout(function () { form.classList.remove('cta-focus'); }, 1600);
        }
        window.setTimeout(focusFirstEmpty, reduceMotion ? 0 : 450);
      }
    });
  });

  /* --- Contact form → Wix CRM (Worker), with mailto fallback --- */
  function buildMailto(data) {
    var lines = [
      'Name: ' + (data.name || ''),
      'Email: ' + (data.email || ''),
      'Phone: ' + (data.phone || ''),
      'Company: ' + (data.company || ''),
      'Interested in: ' + (data.interest || '(not specified)'),
      'How we can help: ' + (data.goal || '(not specified)'),
      'Preferred time: ' + (data.preferredTime || '(not specified)'),
      'Request: ' + (data.cta || 'Discovery Call'),
      '',
      (data.message || '')
    ];
    var subject = 'Website enquiry — ' + (data.cta || 'Discovery Call') + (data.name ? ' — ' + data.name : '');
    return 'mailto:' + WIX_CONFIG.CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var data = Object.fromEntries(new FormData(form).entries());
      var submitBtn = form.querySelector('button[type=submit]');
      var originalLabel = submitBtn ? submitBtn.textContent : '';

      function showThanks() {
        if (note) { note.hidden = false; note.textContent = "Thank you! We'll be in touch shortly to schedule your Discovery Call."; }
        if (ctaHint) ctaHint.hidden = true;
        form.reset();
      }
      function handoffToEmail() {
        // No server yet (or it failed): open the visitor's mail client pre-filled.
        if (note) { note.hidden = false; note.textContent = 'Opening your email app, or write to us directly at ' + WIX_CONFIG.CONTACT_EMAIL + '.'; }
        window.location.href = buildMailto(data);
      }

      if (!ENDPOINT_READY) { handoffToEmail(); return; }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
      fetch(WIX_CONFIG.CONTACT_FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(showThanks)
        .catch(function (err) {
          console.warn('contact submit failed, handing off to email:', err);
          handoffToEmail();
        })
        .finally(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
        });
    });
  }

  /* --- Platform showcase carousel --- */
  var scVp = document.getElementById('scViewport');
  if (scVp) {
    var scSlides = Array.prototype.slice.call(scVp.querySelectorAll('.sc-slide'));
    var scDots = document.getElementById('scDots');
    var scPrev = document.getElementById('scPrev');
    var scNext = document.getElementById('scNext');
    var scCurrent = 0;

    scSlides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.className = 'sc-dot';
      d.type = 'button';
      d.setAttribute('aria-label', 'Go to screen ' + (i + 1));
      d.addEventListener('click', function () { scrollToIndex(i); });
      scDots.appendChild(d);
    });
    var scDotEls = Array.prototype.slice.call(scDots.children);

    function scrollToIndex(i) {
      i = Math.max(0, Math.min(scSlides.length - 1, i));
      var slide = scSlides[i];
      var left = slide.offsetLeft - (scVp.clientWidth - slide.offsetWidth) / 2;
      scVp.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function syncActive() {
      var center = scVp.scrollLeft + scVp.clientWidth / 2;
      var best = 0, bd = Infinity;
      scSlides.forEach(function (s, i) {
        var c = s.offsetLeft + s.offsetWidth / 2;
        var dd = Math.abs(c - center);
        if (dd < bd) { bd = dd; best = i; }
      });
      scCurrent = best;
      scSlides.forEach(function (s, i) { s.classList.toggle('active', i === best); });
      scDotEls.forEach(function (d, i) { d.classList.toggle('on', i === best); });
      if (scPrev) scPrev.disabled = best === 0;
      if (scNext) scNext.disabled = best === scSlides.length - 1;
    }
    var scTick = false;
    scVp.addEventListener('scroll', function () {
      if (!scTick) { window.requestAnimationFrame(function () { syncActive(); scTick = false; }); scTick = true; }
    }, { passive: true });
    if (scPrev) scPrev.addEventListener('click', function () { scrollToIndex(scCurrent - 1); });
    if (scNext) scNext.addEventListener('click', function () { scrollToIndex(scCurrent + 1); });
    scVp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollToIndex(scCurrent + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollToIndex(scCurrent - 1); }
    });
    window.addEventListener('resize', syncActive);
    syncActive();

    /* Animate each screen in as it scrolls into view (vertical or horizontal). */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      scVp.classList.add('sc-anim');
      var scIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('sc-in'); });
      }, { threshold: 0.35 });
      scSlides.forEach(function (s) { scIO.observe(s); });
    }
  }

  /* --- Hero data-flow lines (blue) --- */
  var canvas = document.getElementById('dataFlow');
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, nodes, t = 0;

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * DPR; canvas.height = h * DPR;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildNodes();
    }
    function buildNodes() {
      nodes = [];
      var count = Math.max(16, Math.round(w / 65));
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
          p: Math.random() * Math.PI * 2
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.012;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            var alpha = (1 - dist / 150) * 0.3;
            ctx.strokeStyle = 'rgba(137,162,255,' + alpha + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        var pulse = 1.4 + Math.sin(t + n.p) * 1.0;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(137,162,255,0.9)';
        ctx.shadowColor = 'rgba(31,79,255,0.9)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(draw);
  }
  /* --- Hero: rotating audience word --- */
  (function () {
    var rot = document.querySelector('.hero-rotate[data-words]');
    if (!rot || reduceMotion) return;
    var words = rot.getAttribute('data-words').split('|');
    if (words.length < 2) return;
    var i = 0;
    window.setInterval(function () {
      i = (i + 1) % words.length;
      rot.classList.add('swap');
      window.setTimeout(function () { rot.textContent = words[i]; rot.classList.remove('swap'); }, 280);
    }, 2600);
  })();

  /* --- Hero proof counters --- */
  (function () {
    var nums = document.querySelectorAll('.hero-proof [data-count]');
    if (!nums.length) return;
    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      if (isNaN(target) || reduceMotion) { el.textContent = target + suffix; return; }
      var start = null, dur = 1200;
      function step(ts) { if (!start) start = ts; var p = Math.min((ts - start) / dur, 1); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix; if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }
    if ('IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io2.unobserve(e.target); } }); }, { threshold: 0.5 });
      nums.forEach(function (n) { io2.observe(n); });
    } else { nums.forEach(run); }
  })();

  /* --- Platform showcase autoplay (pauses on interaction) --- */
  (function () {
    var vp = document.getElementById('scViewport');
    if (!vp || reduceMotion) return;
    var slides = vp.querySelectorAll('.sc-slide');
    if (slides.length < 2) return;
    var idx = 0, paused = false, timer = null;
    function go() {
      if (paused) return;
      idx = (idx + 1) % slides.length;
      var s = slides[idx];
      vp.scrollTo({ left: s.offsetLeft - (vp.clientWidth - s.offsetWidth) / 2, behavior: 'smooth' });
    }
    function start() { stop(); timer = window.setInterval(go, 5000); }
    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
    ['pointerdown', 'wheel', 'keydown', 'mouseenter', 'touchstart'].forEach(function (ev) {
      vp.addEventListener(ev, function () { paused = true; stop(); }, { passive: true });
    });
    vp.addEventListener('scroll', function () {
      var c = vp.scrollLeft + vp.clientWidth / 2, best = 0, bd = Infinity;
      slides.forEach(function (s, i) { var cc = s.offsetLeft + s.offsetWidth / 2, d = Math.abs(cc - c); if (d < bd) { bd = d; best = i; } });
      idx = best;
    }, { passive: true });
    start();
  })();

  /* --- Footer newsletter -> Wix CRM (reuses contact endpoint, mailto-free) --- */
  (function () {
    var nf = document.getElementById('footerNews');
    if (!nf) return;
    var note = document.getElementById('footerNewsNote');
    nf.addEventListener('submit', function (e) {
      e.preventDefault();
      var field = nf.querySelector('input[name=email]');
      var email = field ? field.value.trim() : '';
      if (!email) return;
      function done(msg) { if (note) { note.hidden = false; note.textContent = msg; } nf.reset(); }
      var ready = (typeof ENDPOINT_READY !== 'undefined') && ENDPOINT_READY && (typeof WIX_CONFIG !== 'undefined');
      if (ready) {
        fetch(WIX_CONFIG.CONTACT_FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: email.split('@')[0], email: email, cta: 'Newsletter', message: 'Newsletter signup from footer' }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function () { done('Thanks — you\'re subscribed.'); })
          .catch(function () { done('Thanks! We\'ll reach you at ' + email + '.'); });
      } else { done('Thanks! We\'ll add ' + email + ' to ACM insights.'); }
    });
  })();

  /* --- ACM AI assistant (Hanzo-powered) ---
     Point AI_CONFIG.endpoint at your Hanzo docs AI indexing / answer API to go live;
     until then it greets, takes questions, and routes to the team. */
  (function () {
    var root = document.getElementById('aiAssistant');
    if (!root) return;
    var launcher = document.getElementById('aiLauncher');
    var panel = document.getElementById('aiPanel');
    var closeBtn = document.getElementById('aiClose');
    var log = document.getElementById('aiLog');
    var form = document.getElementById('aiForm');
    var input = document.getElementById('aiText');
    var suggest = document.getElementById('aiSuggest');
    var AI_CONFIG = { endpoint: '', email: 'info@acmglobaltech.com' };
    var greeted = false;

    function add(role, text) {
      var b = document.createElement('div');
      b.className = 'ai-msg ' + role;
      b.textContent = text;
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
      return b;
    }
    function open() {
      panel.hidden = false; launcher.setAttribute('aria-expanded', 'true'); root.classList.add('open');
      if (!greeted) { greeted = true; add('bot', "Hi! I'm the ACM assistant. Ask about our platform, security, pricing, or booking a call."); }
      window.setTimeout(function () { input.focus(); }, 50);
    }
    function close() { panel.hidden = true; launcher.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); }
    launcher.addEventListener('click', function () { panel.hidden ? open() : close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });

    var KB = {
      'what does acm do': "ACM Global Tech delivers a complete, white-label banking ecosystem — core banking, payments, mobile wallets, exchange & FX, RWA tokenization, stablecoins, treasury, cards, a white-label PSP, and Banking-as-a-Service — for credit unions, mid-sized banks, and healthcare. You brand it and you own it.",
      'how does pricing work': "Pricing is scoped to your institution and the modules you adopt — start with one (for example the banking core) and expand on your timeline. Share your size and goals at /get-started/ and we'll put together a proposal.",
      'is the platform post quantum secure': "Yes — post-quantum cryptography is core to ACM. We build on the NIST PQC standards (ML-KEM / FIPS 203, ML-DSA / FIPS 204, SLH-DSA / FIPS 205) to protect long-lived financial records against harvest-now, decrypt-later attacks. More at /capabilities/post-quantum-security/."
    };
    function normalize(s) { return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
    function fallback(q) {
      var k = normalize(q);
      if (KB[k]) return KB[k];
      for (var key in KB) { if (k.indexOf(key.split(' ')[0]) !== -1 && k.length > 3) return KB[key]; }
      return "Happy to help. For a precise answer the fastest path is our team — email " + AI_CONFIG.email + " or use the contact form, and you can book a discovery call from any page.";
    }
    function ask(q) {
      add('user', q);
      if (suggest) suggest.style.display = 'none';
      var thinking = add('bot', '…');
      thinking.classList.add('thinking');
      if (AI_CONFIG.endpoint) {
        fetch(AI_CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (d) { thinking.classList.remove('thinking'); thinking.textContent = (d && (d.answer || d.text)) || fallback(q); })
          .catch(function () { thinking.classList.remove('thinking'); thinking.textContent = fallback(q); });
      } else {
        window.setTimeout(function () { thinking.classList.remove('thinking'); thinking.textContent = fallback(q); }, 450);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); var q = input.value.trim(); if (!q) return; input.value = ''; ask(q); });
    if (suggest) Array.prototype.forEach.call(suggest.querySelectorAll('button'), function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
  })();

  /* --- Lead-capture modal: email-gate case studies / white papers -> CRM --- */
  (function () {
    var modal = document.getElementById('leadModal');
    if (!modal) return;
    var overlay = document.getElementById('leadOverlay');
    var closeBtn = document.getElementById('leadClose');
    var titleEl = document.getElementById('leadTitle');
    var subEl = document.getElementById('leadSub');
    var kindEl = document.getElementById('leadKind');
    var ctaEl = document.getElementById('leadCta');
    var lform = document.getElementById('leadForm');
    var lnote = document.getElementById('leadNote');
    var lsubmit = document.getElementById('leadSubmit');
    var lastTrigger = null;

    function openWith(c) {
      if (kindEl) kindEl.textContent = c.kind || 'Resource';
      if (titleEl) titleEl.textContent = c.title || 'Get the full details';
      if (subEl) subEl.textContent = c.sub || "Tell us where to send it — we'll email it over.";
      if (ctaEl) ctaEl.value = c.lead || 'Resource';
      if (lsubmit) lsubmit.textContent = c.submit || 'Email it to me';
      if (lnote) { lnote.hidden = true; lnote.textContent = ''; }
      lform.style.display = '';
      modal.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      var nm = lform.elements['name'];
      if (nm) window.setTimeout(function () { nm.focus(); }, 60);
    }
    function openModal(t) {
      lastTrigger = t;
      openWith({ kind: t.getAttribute('data-lead-kind'), title: t.getAttribute('data-lead-title'), sub: t.getAttribute('data-lead-sub'), lead: t.getAttribute('data-lead'), submit: t.getAttribute('data-lead-submit') });
    }
    function closeModal() {
      modal.hidden = true;
      document.documentElement.style.overflow = '';
      if (lastTrigger) { try { lastTrigger.focus(); } catch (e) { /* noop */ } lastTrigger = null; }
    }
    document.querySelectorAll('[data-lead]').forEach(function (t) {
      t.addEventListener('click', function (e) { e.preventDefault(); openModal(t); });
    });
    if (overlay) overlay.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    lform.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!lform.checkValidity()) { lform.reportValidity(); return; }
      if (lform.elements['website'] && lform.elements['website'].value) { closeModal(); return; }
      var data = Object.fromEntries(new FormData(lform).entries());
      if (/90 days/.test(data.timeline || '')) data.cta = '[HOT] ' + (data.cta || 'Lead');
      data.message = 'Requested: ' + (data.cta || 'resource');
      var orig = lsubmit ? lsubmit.textContent : '';
      function succeed() {
        lform.style.display = 'none';
        if (lnote) { lnote.hidden = false; lnote.textContent = "Thanks — it's on its way to " + (data.email || 'your inbox') + ". We'll follow up shortly."; }
      }
      var ready = (typeof ENDPOINT_READY !== 'undefined') && ENDPOINT_READY && (typeof WIX_CONFIG !== 'undefined');
      if (!ready) { window.location.href = buildMailto(data); succeed(); return; }
      if (lsubmit) { lsubmit.disabled = true; lsubmit.textContent = 'Sending…'; }
      fetch(WIX_CONFIG.CONTACT_FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(succeed)
        .catch(function () { window.location.href = buildMailto(data); succeed(); })
        .finally(function () { if (lsubmit) { lsubmit.disabled = false; lsubmit.textContent = orig; } });
    });

    /* Exit-intent (desktop) + scroll-depth (mobile) soft capture, once per session */
    var softFired = false;
    function softCapture() {
      if (softFired || !modal.hidden) return;
      try { if (sessionStorage.getItem('acmSoft')) return; sessionStorage.setItem('acmSoft', '1'); } catch (e) { /* noop */ }
      softFired = true;
      openWith({ kind: 'Before you go', title: 'Before you go — get the ACM overview', sub: 'A one-page overview of the full white-label platform, sent to your inbox. No commitment.', lead: 'Soft capture — Platform overview', submit: 'Email me the overview' });
    }
    document.addEventListener('mouseout', function (e) { if (e.clientY <= 0 && !e.relatedTarget) softCapture(); });
    if (window.matchMedia('(max-width: 1024px)').matches) {
      window.addEventListener('scroll', function () {
        var de = document.documentElement;
        if ((window.scrollY + window.innerHeight) / de.scrollHeight > 0.7) softCapture();
      }, { passive: true });
    }
  })();
})();
