/* Fullstack Lending — interactions & animation
   Vanilla JS only: canvas ridge fields, word-split reveals,
   sticky step sequence, count-ups, FAQ, nav. */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Ridge canvas (layered climbing curves, per the Ascend mark) ---------- */

  function RidgeField(canvas, opts) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, t = Math.random() * 1000;
    var running = false, rafId = null;

    // Bottom-most layer last (painted over the others), olive at the bottom
    // per the brand's layer order. No lime: reserved for the CTA button.
    var layers = opts.layers || [
      { color: "rgba(143, 166, 55, 0.30)", base: 0.62, amp: 0.055, freq: 1.6, speed: 0.12, phase: 0.0 },
      { color: "rgba(63, 74, 24, 0.75)",  base: 0.74, amp: 0.05,  freq: 1.2, speed: 0.09, phase: 2.1 },
      { color: "rgba(26, 31, 8, 0.95)",   base: 0.86, amp: 0.045, freq: 0.9, speed: 0.07, phase: 4.2 }
    ];

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawLayer(layer) {
      var baseY = h * layer.base;
      var amp = h * layer.amp;
      ctx.beginPath();
      ctx.moveTo(-10, h + 10);
      ctx.lineTo(-10, baseY);
      var steps = Math.ceil(w / 14);
      for (var i = 0; i <= steps; i++) {
        var x = (i / steps) * (w + 20) - 10;
        var nx = (x / w) * Math.PI * 2 * layer.freq;
        var y = baseY
          + Math.sin(nx + t * layer.speed + layer.phase) * amp
          + Math.sin(nx * 2.7 + t * layer.speed * 1.7 + layer.phase * 1.3) * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 10, h + 10);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < layers.length; i++) drawLayer(layers[i]);
      t += 1;
      if (running && !reducedMotion) rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      if (reducedMotion) { frame(); return; } // single static paint
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    window.addEventListener("resize", function () {
      if (!running) return;
      resize();
      if (reducedMotion) frame();
    });

    // Only animate while on screen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { rootMargin: "100px" });
    io.observe(canvas);
  }

  document.querySelectorAll(".ridges").forEach(function (c) { RidgeField(c, {}); });

  /* ---------- Word-split headlines ---------- */

  document.querySelectorAll("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (word, i) {
      var mask = document.createElement("span");
      mask.className = "w";
      var inner = document.createElement("span");
      inner.textContent = word;
      inner.style.setProperty("--wi", i);
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* ---------- Scroll reveals ---------- */

  var revealables = document.querySelectorAll(".reveal, [data-split]");
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
  revealables.forEach(function (el) { revealIO.observe(el); });

  /* ---------- Count-up stats ---------- */

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (reducedMotion) { el.textContent = target; return; }
    var dur = 1200, t0 = null;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        countUp(e.target);
        countIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach(function (el) { countIO.observe(el); });

  /* ---------- Sticky step sequence ---------- */

  var track = document.getElementById("stepsTrack");
  if (track) {
    var panels = track.querySelectorAll(".step-panel");
    var railItems = track.querySelectorAll(".steps-rail li");
    var active = 0, ticking = false;

    function setActive(idx) {
      if (idx === active) return;
      active = idx;
      panels.forEach(function (p, i) { p.classList.toggle("is-active", i === idx); });
      railItems.forEach(function (r, i) { r.classList.toggle("is-active", i === idx); });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var rect = track.getBoundingClientRect();
        var vh = window.innerHeight;
        var total = rect.height - vh;
        if (total <= 0) return;
        var progress = Math.min(Math.max(-rect.top / total, 0), 0.999);
        setActive(Math.floor(progress * panels.length));
      });
    }

    // Desktop only — the mobile layout stacks the panels statically.
    var desktopSteps = window.matchMedia("(min-width: 861px)");
    if (desktopSteps.matches) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- FAQ accordion ---------- */

  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    btn.addEventListener("click", function () {
      var open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- Nav ---------- */

  var nav = document.getElementById("nav");
  var onNavScroll = function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  window.addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();

  var burger = document.getElementById("navBurger");
  var menu = document.getElementById("mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", open ? "false" : "true");
      menu.hidden = open;
      document.body.style.overflow = open ? "" : "hidden";
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Footer year ---------- */

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
