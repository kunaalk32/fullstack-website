/* Fullstack Lending — analytics loader with a US-only geo gate.

   We lend only in the United States and do not wish to process the data
   of visitors in the EU/EEA, UK, or other GDPR-scope regions. Because the
   site is static (no server or edge to read the visitor's country), we
   detect it client-side and load Google Analytics + the Meta Pixel ONLY
   for visitors we can confirm are in the US.

   Fail closed: if the country can't be determined — lookup blocked, both
   providers down, or anything other than a confirmed "US" — nothing loads
   and no analytics/advertising requests are made. The trade-off is that a
   geo-lookup outage costs some US analytics coverage, never EU tracking.

   The one request every visitor makes is the geo lookup itself, which
   sends their IP to a geolocation provider (not an ad tracker) solely to
   decide whether to load analytics. Moving the site behind a CDN edge
   (e.g. Cloudflare) would let us read the country server-side and drop
   this third-party call entirely. */

(function () {
  "use strict";

  /* ---------- UTM capture (runs on every page, before the geo gate) ----------
     Arrival utm_* params are stashed for the session so outbound portal
     links can carry them (main.js rewrites those links at click time).
     This is first-party CRM attribution, not GA/Meta, so it must NOT be
     gated behind the US-only analytics check below. A page with no utm_*
     params leaves the stored set alone, so the landing page's params
     survive navigation across the site. */
  try {
    var arrival = new URLSearchParams(window.location.search);
    var utms = {};
    var hasUtms = false;
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
      .forEach(function (key) {
        var value = arrival.get(key);
        if (value !== null) { utms[key] = value; hasUtms = true; }
      });
    if (hasUtms) sessionStorage.setItem("fsl_utm", JSON.stringify(utms));
  } catch (e) { /* private mode etc. — portal links fall back to website/direct */ }

  var GA_ID = "G-P2R5NRW1WV";
  var META_ID = "1058965793168149";
  var CACHE_KEY = "fsl_geo_cc";

  function loadGoogleAnalytics() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
  }

  function loadMetaPixel() {
    // Standard Meta Pixel bootstrap (defines fbq + loads fbevents.js).
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", META_ID);
    window.fbq("track", "PageView");
  }

  function enableAnalytics() {
    loadGoogleAnalytics();
    loadMetaPixel();
  }

  function fetchCountry(url, pick) {
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("geo http")); })
      .then(function (d) {
        var c = pick(d);
        return c ? c : Promise.reject(new Error("geo empty"));
      });
  }

  // Two independent providers so a single outage doesn't blind us; both
  // return an ISO 3166-1 alpha-2 country code.
  function detectCountry() {
    return fetchCountry("https://get.geojs.io/v1/ip/country.json", function (d) { return d.country; })
      .catch(function () {
        return fetchCountry("https://ipapi.co/json/", function (d) { return d.country_code; });
      });
  }

  function gateOn(countryCode) {
    if ((countryCode || "").toUpperCase() === "US") enableAnalytics();
  }

  // Reuse the first lookup for the rest of the browsing session — cuts
  // geo-provider calls to one per visit and speeds up later page views.
  var cached = null;
  try { cached = sessionStorage.getItem(CACHE_KEY); } catch (e) { /* private mode */ }

  if (cached) {
    gateOn(cached);
    return;
  }

  detectCountry().then(function (cc) {
    cc = (cc || "").toUpperCase();
    try { sessionStorage.setItem(CACHE_KEY, cc || "XX"); } catch (e) { /* ignore */ }
    gateOn(cc);
  }).catch(function () {
    // Both providers failed: fail closed, load nothing, retry next page.
  });
})();
