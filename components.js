// Make custom elements block-level so they don't affect layout
(function injectBaseStyles() {
  const s = document.createElement('style');
  s.textContent = 'site-nav, site-footer { display: block; }';
  document.head.appendChild(s);
})();

// ── <site-nav> ─────────────────────────────────────────────
// Detects whether the current page is index.html and prefixes
// anchor links accordingly so they always land on the right section.
class SiteNav extends HTMLElement {
  connectedCallback() {
    const path = window.location.pathname;
    const onHome = path === '/' || path.endsWith('/index.html') || path.endsWith('\\index.html');
    const p = onHome ? '' : 'index.html';

    this.innerHTML = `
      <header class="max-w-6xl mx-auto px-6 lg:px-10">
        <nav class="flex items-center justify-between py-8 border-b rule-light">
          <a href="index.html" class="flex items-baseline gap-2.5 no-underline">
            <span class="font-serif text-xl text-gold tracking-wide">Fullstack</span>
            <span class="font-sans text-xs tracking-[0.2em] text-muted uppercase">Lending</span>
          </a>

          <div class="hidden md:flex items-center gap-9 text-sm text-muted">
            <a href="${p}#products" class="hover:text-ink transition-colors duration-200">Products</a>
            <a href="${p}#why"      class="hover:text-ink transition-colors duration-200">Why Us</a>
            <a href="${p}#process"  class="hover:text-ink transition-colors duration-200">Process</a>
            <a href="${p}#contact"  class="hover:text-ink transition-colors duration-200">Contact</a>
          </div>

          <a href="https://loans.fullstacklending.com"
             class="text-xs px-5 py-2.5 border border-gold text-gold hover:bg-gold hover:text-ink transition-colors duration-200 tracking-widest uppercase font-medium">
            Apply Now
          </a>
        </nav>
      </header>
    `;
  }
}
customElements.define('site-nav', SiteNav);


// ── <site-footer> ──────────────────────────────────────────
class SiteFooter extends HTMLElement {
  connectedCallback() {
    // ── Google Analytics ──────────────────────────────────
    // Injected here so it loads automatically on every page.
    // Using createElement rather than innerHTML — browsers don't
    // execute scripts inserted via innerHTML.
    if (!document.getElementById('gtag-js')) {
      const gtagSrc = document.createElement('script');
      gtagSrc.id    = 'gtag-js';
      gtagSrc.async = true;
      gtagSrc.src   = 'https://www.googletagmanager.com/gtag/js?id=G-P2R5NRW1WV';
      document.head.appendChild(gtagSrc);

      const gtagCfg = document.createElement('script');
      gtagCfg.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-P2R5NRW1WV');
      `;
      document.head.appendChild(gtagCfg);
    }

    this.innerHTML = `
      <footer class="bg-ink border-t rule-dark">
        <div class="max-w-6xl mx-auto px-6 lg:px-10 py-12">
          <div class="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            <a href="index.html" class="flex items-baseline gap-2.5">
              <span class="font-serif text-lg text-gold">Fullstack</span>
              <span class="font-sans text-xs tracking-[0.2em] text-cream/60 uppercase">Lending</span>
            </a>
            <div class="flex flex-wrap gap-x-8 gap-y-3 text-xs text-cream/60">
              <a href="index.html#products" class="hover:text-cream transition-colors">Products</a>
              <a href="index.html#why"      class="hover:text-cream transition-colors">Why Us</a>
              <a href="index.html#process"  class="hover:text-cream transition-colors">Process</a>
              <a href="index.html#contact"  class="hover:text-cream transition-colors">Contact</a>
              <a href="privacy-policy.html" class="hover:text-cream transition-colors">Privacy Policy</a>
              <a href="terms-of-service.html" class="hover:text-cream transition-colors">Terms of Service</a>
              <a href="#"                   class="hover:text-cream transition-colors">NMLS #1716495</a>
            </div>
          </div>
          <div class="border-t rule-dark pt-8 flex flex-col md:flex-row justify-between gap-6">
            <p class="text-xs leading-relaxed max-w-2xl" style="color:rgba(242,234,216,.45)">
              Fullstack Lending LLC is a private mortgage lender. All loans are subject to credit approval and
              property eligibility. This is not a commitment to lend. Rates and terms vary by borrower and property.
              Equal Housing Lender.
            </p>
            <address class="text-xs not-italic shrink-0" style="color:rgba(242,234,216,.45)">
              30 N Gould St, Ste N<br />
              Sheridan, WY 82801
            </address>
          </div>
        </div>
      </footer>
    `;
  }
}
customElements.define('site-footer', SiteFooter);
