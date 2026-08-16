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
      t += 0.1;   // phase advance per frame; lower = slower ridge motion
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

  /* ---------- Wireframe house (hero) ----------
     Isometric line model that draws itself in on load already exploded (roof
     assembly lifted away, ground plate dropped), then comes together as the
     user scrolls: the roof settles onto the walls and the ground rises to
     meet them. Fixed camera, no rotation. Vanilla canvas 2D, orthographic
     isometric projection. */

  function WireHouse(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    // Cache viewport height; reading window.innerHeight in the per-frame path
    // forces a layout flush. Refreshed in resize() (fires on viewport change).
    var vh = window.innerHeight;

    var ROOF_LIFT = 1.15;    // roof height above walls when fully exploded
    var GROUND_DROP = 0.8;   // ground depth below walls when fully exploded
    var SCROLL_SPAN = 0.6;   // fraction of viewport height to fully explode

    var OLIVE = "rgba(63, 74, 24, 0.9)";
    var MOSS = "rgba(143, 166, 55, 0.75)";
    var MOSS_FAINT = "rgba(143, 166, 55, 0.45)";
    var PAPER = "rgba(244, 241, 236, 0.8)";
    var PAPER_FAINT = "rgba(244, 241, 236, 0.4)";

    /* --- Edge helpers: each edge is [x1,y1,z1, x2,y2,z2] --- */
    function rectY(y, x1, z1, x2, z2) {
      return [
        [x1, y, z1, x2, y, z1], [x2, y, z1, x2, y, z2],
        [x2, y, z2, x1, y, z2], [x1, y, z2, x1, y, z1]
      ];
    }
    function box(x1, y1, z1, x2, y2, z2) {
      return rectY(y1, x1, z1, x2, z2).concat(rectY(y2, x1, z1, x2, z2), [
        [x1, y1, z1, x1, y2, z1], [x2, y1, z1, x2, y2, z1],
        [x2, y1, z2, x2, y2, z2], [x1, y1, z2, x1, y2, z2]
      ]);
    }
    // Rectangle on a gable-end face (constant x): corners in (z, y)
    function rectX(x, z1, y1, z2, y2) {
      return [
        [x, y1, z1, x, y2, z1], [x, y2, z1, x, y2, z2],
        [x, y2, z2, x, y1, z2], [x, y1, z2, x, y1, z1]
      ];
    }
    // Rectangle on a long-wall face (constant z): corners in (x, y)
    function rectZ(z, x1, y1, x2, y2) {
      return [
        [x1, y1, z, x1, y2, z], [x1, y2, z, x2, y2, z],
        [x2, y2, z, x2, y1, z], [x2, y1, z, x1, y1, z]
      ];
    }

    /* --- Walls (static group) --- */
    var wallEdges = [];
    var wallFaint = [];
    // base, top plate band, corner studs
    wallEdges = wallEdges.concat(
      rectY(0, -1, -0.75, 1, 0.75),
      rectY(0.95, -1, -0.75, 1, 0.75),
      rectY(1.05, -1, -0.75, 1, 0.75),
      [[-1, 0, -0.75, -1, 1.05, -0.75], [1, 0, -0.75, 1, 1.05, -0.75],
       [1, 0, 0.75, 1, 1.05, 0.75], [-1, 0, 0.75, -1, 1.05, 0.75]]
    );
    // garage opening on the near gable-end wall (x = -1), with inset depth
    wallFaint = wallFaint.concat(
      [[-1, 0, -0.5, -1, 0.8, -0.5], [-1, 0.8, -0.5, -1, 0.8, 0.5], [-1, 0.8, 0.5, -1, 0, 0.5]],
      [[-0.88, 0, -0.5, -0.88, 0.8, -0.5], [-0.88, 0.8, -0.5, -0.88, 0.8, 0.5], [-0.88, 0.8, 0.5, -0.88, 0, 0.5]],
      [[-1, 0.8, -0.5, -0.88, 0.8, -0.5], [-1, 0.8, 0.5, -0.88, 0.8, 0.5],
       [-1, 0, -0.5, -0.88, 0, -0.5], [-1, 0, 0.5, -0.88, 0, 0.5]]
    );
    // door on the near long wall (z = 0.75), with inset
    wallFaint = wallFaint.concat(
      [[0.35, 0, 0.75, 0.35, 0.62, 0.75], [0.35, 0.62, 0.75, 0.62, 0.62, 0.75], [0.62, 0.62, 0.75, 0.62, 0, 0.75]],
      [[0.35, 0, 0.68, 0.35, 0.62, 0.68], [0.35, 0.62, 0.68, 0.62, 0.62, 0.68], [0.62, 0.62, 0.68, 0.62, 0, 0.68]],
      [[0.35, 0.62, 0.75, 0.35, 0.62, 0.68], [0.62, 0.62, 0.75, 0.62, 0.62, 0.68]]
    );
    // two windows on the near long wall, with inset
    [[-0.6, -0.28], [-0.1, 0.22]].forEach(function (win) {
      wallFaint = wallFaint.concat(
        rectZ(0.75, win[0], 0.35, win[1], 0.68),
        rectZ(0.68, win[0], 0.35, win[1], 0.68),
        [[win[0], 0.35, 0.75, win[0], 0.35, 0.68], [win[1], 0.68, 0.75, win[1], 0.68, 0.68]]
      );
    });

    /* --- Roof assembly (settles onto the walls on scroll; includes chimney) --- */
    var roofEdges = [];
    var roofFaint = [];
    roofEdges = roofEdges.concat(
      [[-1.12, 2.0, 0, 1.12, 2.0, 0]],                                       // ridge
      [[-1.12, 2.0, 0, -1.12, 0.98, -0.9], [-1.12, 2.0, 0, -1.12, 0.98, 0.9],
       [1.12, 2.0, 0, 1.12, 0.98, -0.9], [1.12, 2.0, 0, 1.12, 0.98, 0.9]],   // slope ends
      [[-1.12, 0.98, -0.9, 1.12, 0.98, -0.9], [-1.12, 0.98, 0.9, 1.12, 0.98, 0.9]], // eaves
      [[-1, 1.05, -0.75, -1, 1.95, 0], [-1, 1.95, 0, -1, 1.05, 0.75],        // gable triangles
       [1, 1.05, -0.75, 1, 1.95, 0], [1, 1.95, 0, 1, 1.05, 0.75]],
      [[-1.25, 1.5, -0.12, -0.7, 1.5, -0.12], [-1.25, 1.5, 0.12, -0.7, 1.5, 0.12]] // beam stubs
    );
    // rafters across both slopes
    for (var rx = -0.9; rx <= 0.91; rx += 0.3) {
      roofFaint.push([rx, 2.0, 0, rx, 0.98, -0.9]);
      roofFaint.push([rx, 2.0, 0, rx, 0.98, 0.9]);
    }
    var chimneyEdges = box(-0.35, 1.35, -0.3, -0.12, 2.3, -0.08);

    /* --- Ground plate (rises to meet the walls on scroll) --- */
    var groundEdges = rectY(0, -1.5, -1.1, 1.5, 1.1).concat(
      rectY(-0.06, -1.5, -1.1, 1.5, 1.1),
      [[-1.5, 0, -1.1, -1.5, -0.06, -1.1], [1.5, 0, -1.1, 1.5, -0.06, -1.1],
       [1.5, 0, 1.1, 1.5, -0.06, 1.1], [-1.5, 0, 1.1, -1.5, -0.06, 1.1]],
      rectY(0, -1.35, -0.95, 1.35, 0.95)
    );

    /* --- Flat edge list in construction draw order (for the load-in) --- */
    var allEdges = [];
    function addGroup(edges, color, group) {
      edges.forEach(function (e) { allEdges.push({ p: e, color: color, group: group }); });
    }
    addGroup(groundEdges, OLIVE, "ground");
    addGroup(wallEdges, MOSS, "walls");
    addGroup(wallFaint, MOSS_FAINT, "walls");
    addGroup(roofEdges, PAPER, "roof");
    addGroup(roofFaint, PAPER_FAINT, "roof");
    addGroup(chimneyEdges, MOSS_FAINT, "roof");
    allEdges.forEach(function (e, i) {
      e.start = (i / allEdges.length) * 0.82;
      e.span = 0.18;
    });

    /* --- Orthographic isometric projection (fixed camera) --- */
    var A = Math.cos(0.7), B = Math.sin(0.7);  // yaw
    var K = 0.92, M = 0.42;                    // vertical scale, depth-to-vertical

    function project(x, y, z, lift) {
      y += lift;
      var sx = A * x + B * z;
      var depth = -B * x + A * z;
      var sy = K * y - M * depth;
      // Wall band midpoint (sy ~0.48) sits at canvas middle; the canvas is
      // anchored in the hero via CSS, so moving the canvas moves the house.
      var scale = Math.min(w / 4.2, h / 5.75);
      return [w / 2 + sx * scale, h / 2 + (0.48 - sy) * scale];
    }

    /* buildP: 0..1 draw-in on load. explodeP: 0 assembled -> 1 exploded. */
    function render(buildP, explodeP) {
      var lifts = {
        ground: -GROUND_DROP * explodeP,
        walls: 0,
        roof: ROOF_LIFT * explodeP
      };
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      allEdges.forEach(function (e) {
        var q = buildP >= 1 ? 1 : Math.min(Math.max((buildP - e.start) / e.span, 0), 1);
        if (q <= 0) return;
        var lift = lifts[e.group];
        var a = project(e.p[0], e.p[1], e.p[2], lift);
        var b = project(e.p[3], e.p[4], e.p[5], lift);
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q);
        ctx.stroke();
      });
    }

    function smoothstep(p) { return p * p * (3 - 2 * p); }

    // Reversed direction: fully exploded at the top of the page and
    // assembling as the user scrolls down. Returns explodeP, so 1 at
    // scrollY 0 (exploded) easing to 0 past the scroll span (assembled).
    // Takes scrollY as an argument so callers can read it once, before any
    // style write, and avoid a read-after-write forced reflow.
    function progressFrom(sy) {
      var p = sy / (vh * SCROLL_SPAN);
      return 1 - smoothstep(Math.min(Math.max(p, 0), 1));
    }
    function progress() { return progressFrom(window.scrollY); }

    function resize() {
      var r = canvas.getBoundingClientRect();
      vh = window.innerHeight;
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Debug hook: force-render at explode progress ep (0..1), build bp (default 1)
    canvas.__wireRender = function (ep, bp) { resize(); render(bp == null ? 1 : bp, ep || 0); };

    if (reducedMotion) {
      resize();
      render(1, 0);
      window.addEventListener("resize", function () { resize(); render(1, 0); });
      return;
    }

    var BUILD_MS = 1000;
    var buildDone = false;
    var ticking = false;

    // Parallax: lag the house ~25% behind the scroll so more of the
    // assemble animation stays in view. Set a CSS var so it composes with
    // the element's centering transform (which differs by breakpoint).
    function applyParallaxFrom(sy) {
      if (reducedMotion) return;
      canvas.style.setProperty("--house-parallax", (sy * 0.25) + "px");
    }
    function applyParallax() { applyParallaxFrom(window.scrollY); }

    function onScroll() {
      // Read scroll position once, up front, then write — reading it again
      // after the parallax style write would force a synchronous reflow.
      var sy = window.scrollY;
      applyParallaxFrom(sy);
      if (ticking || !buildDone) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        render(1, progressFrom(sy));
      });
    }

    resize();
    applyParallax();
    var t0 = null;
    function buildFrame(now) {
      if (t0 == null) t0 = now;
      var bp = Math.min((now - t0) / BUILD_MS, 1);
      render(bp, progress());
      if (bp < 1) requestAnimationFrame(buildFrame);
      else buildDone = true;
    }
    requestAnimationFrame(buildFrame);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      resize();
      render(buildDone ? 1 : 0, progress());
    });
  }

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

  /* ---------- Hero canvas (deferred) ----------
     WireHouse runs an animated build on load. Kicked off here — after the text
     reveals and count-ups are registered above — and only once the main thread
     is idle, so the hero copy (the LCP element) paints without waiting on the
     canvas and the build work stays out of the initial blocking window. The
     house is decorative and aria-hidden, and already "builds in" on load, so a
     slightly later start is imperceptible. */
  var heroHouse = document.getElementById("heroHouse");
  if (heroHouse) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(function () { WireHouse(heroHouse); }, { timeout: 1000 });
    } else {
      requestAnimationFrame(function () { WireHouse(heroHouse); });
    }
  }

  /* ---------- Sticky step sequence ---------- */

  var track = document.getElementById("stepsTrack");
  if (track) {
    var panels = track.querySelectorAll(".step-panel");
    var railItems = track.querySelectorAll(".steps-rail li");
    var scrollCue = track.querySelector(".steps-scroll-cue");
    var active = -1, rafId = null;

    function setActive(idx) {
      if (idx === active) return;
      active = idx;
      panels.forEach(function (p, i) { p.classList.toggle("is-active", i === idx); });
      railItems.forEach(function (r, i) { r.classList.toggle("is-active", i === idx); });
    }

    function update() {
      rafId = null;
      var rect = track.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) return;
      var progress = Math.min(Math.max(-rect.top / total, 0), 0.999);
      setActive(Math.floor(progress * panels.length));
    }

    // Coalesce scroll bursts to one update per frame. Cancel-and-reschedule
    // rather than a boolean latch, so a dropped frame (backgrounded tab, a
    // scroll hitch) can never wedge the sequence on a single step.
    function onScroll() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    // Jump to the middle of a step's scroll band; past the last step,
    // release the pin and continue to the rest of the page.
    // scroll-behavior: smooth animates the jump.
    function jumpToStep(idx) {
      var rect = track.getBoundingClientRect();
      var trackTop = rect.top + window.scrollY;
      var total = rect.height - window.innerHeight;
      if (idx >= panels.length || total <= 0) {
        window.scrollTo({ top: trackTop + rect.height, behavior: "smooth" });
      } else {
        var progress = (idx + 0.5) / panels.length;
        window.scrollTo({ top: trackTop + progress * total, behavior: "smooth" });
      }
    }

    // The cue advances one step; the rail numbers jump straight to a step.
    if (scrollCue) {
      scrollCue.addEventListener("click", function () { jumpToStep(active + 1); });
    }
    railItems.forEach(function (item, i) {
      item.addEventListener("click", function () { jumpToStep(i); });
    });

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

  /* ---------- Program drawer ----------
     Clicking a loan-program card opens a right-side drawer with its full
     terms. Detail comes from the card's <template class="program-detail">
     when present; otherwise it's built from the card's summary as an
     interim view until full copy is added. */

  (function () {
    var drawer = document.getElementById("programDrawer");
    var backdrop = document.getElementById("drawerBackdrop");
    if (!drawer || !backdrop) return;

    var closeBtn = document.getElementById("drawerClose");
    var titleEl = document.getElementById("drawerTitle");
    var detailEl = document.getElementById("drawerDetail");
    var scroller = drawer.querySelector(".drawer-scroll");
    var opener = null;

    function buildInterim(card) {
      // Fallback content from the card's own summary paragraph + bullets.
      var frag = document.createDocumentFragment();
      var lead = card.querySelector(":scope > p");
      if (lead) {
        var p = document.createElement("p");
        p.className = "pd-lead";
        p.textContent = lead.textContent;
        frag.appendChild(p);
      }
      var list = card.querySelector(":scope > ul");
      if (list) {
        var section = document.createElement("section");
        section.className = "pd-section";
        var h4 = document.createElement("h4");
        h4.textContent = "Key terms";
        section.appendChild(h4);
        section.appendChild(list.cloneNode(true));
        frag.appendChild(section);
      }
      return frag;
    }

    function openDrawer(card) {
      var title = card.querySelector("h3");
      titleEl.textContent = title ? title.textContent : "";
      trackEvent("program_open", { program_name: titleEl.textContent });
      trackMeta("ViewContent", { content_type: "loan_program", content_name: titleEl.textContent });

      detailEl.innerHTML = "";
      var tpl = card.querySelector("template.program-detail");
      if (tpl) {
        detailEl.appendChild(tpl.content.cloneNode(true));
      } else {
        detailEl.appendChild(buildInterim(card));
      }

      opener = card;
      backdrop.classList.add("is-open");
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (scroller) scroller.scrollTop = 0;
      closeBtn.focus();
    }

    function closeDrawer() {
      backdrop.classList.remove("is-open");
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (opener) { opener.focus(); opener = null; }
    }

    document.querySelectorAll(".card--program").forEach(function (card) {
      card.addEventListener("click", function () { openDrawer(card); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          openDrawer(card);
        }
      });
    });

    closeBtn.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
    });

    // Keep focus inside the drawer while it's open.
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = drawer.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  })();

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

  /* ---------- Analytics (GA4 custom events) ----------
     Named events for the actions marketing cares about: application
     starts, portal logins, and email clicks. gtag is defined inline in
     every page's <head>; the guard keeps this inert when analytics is
     blocked or absent. GA4 sends clicks via sendBeacon, so events
     survive the navigation to the loan portal. */

  function trackEvent(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  // Meta pixel counterpart. `custom` picks trackCustom (for events with no
  // Meta standard-event equivalent) over the standard track call.
  function trackMeta(name, params, custom) {
    if (typeof window.fbq === "function") window.fbq(custom ? "trackCustom" : "track", name, params || {});
  }

  /* ---------- UTM pass-through to the loan portal ----------
     The portal reads utm_* off the URL it lands on, so portal links get
     the visitor's arrival UTMs (captured into sessionStorage by
     analytics.js) appended at click time. Stored values win over any
     utm_* already on the href; with nothing stored, a website/direct
     fallback fills only the missing keys so hand-tagged links keep their
     tags and portal signups are never untagged. Only the five utm_* keys
     ever pass through — no PII. */

  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  function appendUtms(href) {
    try {
      var stored = null;
      try { stored = sessionStorage.getItem("fsl_utm"); } catch (e) { /* private mode */ }
      var utms = stored ? JSON.parse(stored) : null;

      var hashIdx = href.indexOf("#");
      var hash = hashIdx === -1 ? "" : href.slice(hashIdx);
      var rest = hashIdx === -1 ? href : href.slice(0, hashIdx);
      var queryIdx = rest.indexOf("?");
      var base = queryIdx === -1 ? rest : rest.slice(0, queryIdx);
      var params = new URLSearchParams(queryIdx === -1 ? "" : rest.slice(queryIdx + 1));

      if (utms) {
        UTM_KEYS.forEach(function (key) {
          if (typeof utms[key] === "string") params.set(key, utms[key]);
        });
      } else {
        if (!params.has("utm_source")) params.set("utm_source", "website");
        if (!params.has("utm_medium")) params.set("utm_medium", "direct");
      }
      var qs = params.toString();
      return qs ? base + "?" + qs + hash : base + hash;
    } catch (e) {
      return href; // never break the link
    }
  }

  // Capture phase: the rewrite must land before navigation starts and
  // must not be skippable by stopPropagation in a bubble-phase handler.
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";

    // Label events with the enclosing section so we learn which parts
    // of the page actually drive clicks (hero vs. programs vs. footer).
    var region = a.closest("section[id], header, footer, nav");
    var location = region ? (region.id || region.tagName.toLowerCase()) : "page";

    // Just-in-time rewrite so dynamically added portal links are covered.
    if (href.indexOf("loans.fullstacklending.com") !== -1) {
      var tagged = appendUtms(a.getAttribute("href"));
      if (tagged !== a.getAttribute("href")) a.setAttribute("href", tagged);
    }

    if (href.indexOf("loans.fullstacklending.com/signup") !== -1) {
      trackEvent("apply_click", {
        link_location: location,
        link_text: (a.textContent || "").trim().slice(0, 60)
      });
      trackMeta("InitiateCheckout", { content_name: "loan_application", link_location: location });
    } else if (href.indexOf("loans.fullstacklending.com/login") !== -1) {
      trackEvent("login_click", { link_location: location });
      trackMeta("PortalLogin", { link_location: location }, true);
    } else if (href.indexOf("mailto:") === 0) {
      trackEvent("email_click", { link_location: location });
      trackMeta("Contact", { link_location: location });
    }
  }, true);

  /* ---------- Footer year ---------- */

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
