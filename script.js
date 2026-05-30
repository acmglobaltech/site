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
    '.section, .slide-statement .statement, .statement-sub, .leader-card, .sol-card, .prod-card, .ind, .vert, .process-steps li, .why-card, .commit-card, .flagship, .stat'
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

  /* --- Contact form --- */
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (note) note.hidden = false;
      form.reset();
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
            ctx.strokeStyle = 'rgba(106,166,255,' + alpha + ')';
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
        ctx.fillStyle = 'rgba(120,175,255,0.9)';
        ctx.shadowColor = 'rgba(80,140,255,0.9)';
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
