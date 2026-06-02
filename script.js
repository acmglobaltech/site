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
})();
