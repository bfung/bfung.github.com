// Vibe carryover: remember the last VibeRedesign a visitor opened, and
// re-apply its look to every page rendered with the shared layout
// (base.njk) — Resume, Projects, Guides, FamilyTreeMe, AI Financing
// Map, and the VibeRedesign hub itself. The main Home page (/) is the
// exception: visiting it clears the stored vibe and restores the
// original theme, so a vibe never follows a visitor back home.
//
// Why this file exists: each VibeRedesign page is a standalone template
// with its own inline <style> and its own class names, so its styling
// cannot "follow" a visitor onto a differently-marked-up page. The
// shared layout instead re-skins itself from design tokens (see
// src/assets/css/vibes.css), and this file is the only thing that
// decides which token set is active. It must stay tiny and dependency-
// free: base.njk loads it synchronously in <head>, before style.css,
// so data-vibe is set before the first paint (no flash of the default
// theme), and the 16 VibeRedesign templates load the same file so a
// visit to any vibe home or resume is what records the choice.
//
// Mechanism (same-origin localStorage, no URL rewriting, no cookies):
//   1. ?vibe=<slug> on any page wins and is persisted; ?vibe=none clears.
//      An explicit ?vibe= on Home wins over the Home reset below.
//   2. Otherwise a /vibe-redesign/<slug>/ or /vibe-redesign/<slug>/resume/
//      URL records that slug. The hub (/vibe-redesign/) records nothing,
//      so it keeps — and shows — the carried vibe instead of clearing it.
//   3. Otherwise the main Home page ("/", or "/index.html") clears the
//      stored vibe and restores the original theme. It is checked after
//      vibe URLs so a vibe page served as .../index.html is not
//      mistaken for Home.
//   4. Otherwise the stored slug (if any) is re-applied.
// Internal links need no changes: storage survives navigation. External
// project links leave this site, so no vibe can follow them — that is
// out of scope by design, not a bug to chase.
// A vibe is a fixed look, so while one is active the main site's
// light/dark toggle has nothing to switch (vibes.css overrides the
// data-theme tokens); the banner in base.njk and a visit to Home are
// the ways back out.
(function () {
  "use strict";

  // Keep in step with src/assets/css/vibes.css. Unknown slugs are
  // ignored, never stored, so a stale or mistyped value can never
  // leave a page half-themed.
  var VIBES = {
    "art-deco": "Art Deco",
    "conservative": "Conservative",
    "experimental": "Experimental",
    "mid-century": "Mid-Century",
    "minimalist": "Minimalist",
    "neubrutalist": "Neubrutalist",
    "swiss": "Swiss",
    "tech-modern": "Tech Modern",
  };
  var KEY = "bfung-vibe";

  function readStored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value && VIBES[value] ? value : null;
    } catch (e) {
      return null;
    }
  }

  function store(slug) {
    try {
      if (slug) window.localStorage.setItem(KEY, slug);
      else window.localStorage.removeItem(KEY);
    } catch (e) {
      // Private mode / blocked storage: the vibe still applies to
      // this page load via data-vibe; it just will not persist.
    }
  }

  function currentSlug() {
    return document.documentElement.getAttribute("data-vibe") || null;
  }

  function updateBanner() {
    var banner = document.querySelector("[data-vibe-banner]");
    if (!banner) return;
    var slug = currentSlug();
    var label = banner.querySelector("[data-vibe-name]");
    if (slug && VIBES[slug]) {
      if (label) label.textContent = VIBES[slug];
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function apply(slug) {
    if (slug && VIBES[slug]) {
      document.documentElement.setAttribute("data-vibe", slug);
    } else {
      document.documentElement.removeAttribute("data-vibe");
    }
    updateBanner();
  }

  // Runs immediately (this file is loaded synchronously in <head>),
  // before stylesheets are applied, so there is no unthemed flash.
  var params = new URLSearchParams(window.location.search);
  var param = params.get("vibe");
  var pathMatch = window.location.pathname.match(
    /^\/vibe-redesign\/([^/]+)\/?/
  );
  var pathSlug =
    pathMatch && VIBES[pathMatch[1]] ? pathMatch[1] : null;
  var isHome =
    window.location.pathname === "/" ||
    window.location.pathname === "/index.html";

  if (param === "none") {
    store(null);
    apply(null);
  } else if (param && VIBES[param]) {
    store(param);
    apply(param);
  } else if (pathSlug) {
    store(pathSlug);
    apply(pathSlug);
  } else if (isHome) {
    // Home is the reset: a vibe carried from a VibeRedesign or a
    // project ends here, and later pages render in the original theme.
    store(null);
    apply(null);
  } else {
    apply(readStored());
  }

  // The banner lives in the shared layout only; wire it once the
  // document is parsed. Clearing removes the attribute, so vibes.css
  // stops applying instantly — no reload needed.
  function wireBanner() {
    updateBanner();
    var clear = document.querySelector("[data-vibe-clear]");
    if (clear) {
      clear.addEventListener("click", function () {
        store(null);
        apply(null);
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireBanner);
  } else {
    wireBanner();
  }

  window.BfungVibe = {
    get: currentSlug,
    set: function (slug) {
      if (!slug || !VIBES[slug]) return;
      store(slug);
      apply(slug);
    },
    clear: function () {
      store(null);
      apply(null);
    },
  };
})();
