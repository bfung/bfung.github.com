// Vibe themes: the eight VibeRedesigns are selectable themes for the
// whole site, not just a carryover from a VibeRedesign visit. vibe.js
// is the single source of truth for which theme is active: it remembers
// the choice in localStorage (bfung-vibe) and sets data-vibe on <html>;
// src/assets/css/vibes.css re-skins every page rendered with the shared
// layout (base.njk) from that vibe's palette and type.
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
// visit to any vibe home or resume still records that choice.
//
// Mechanism (same-origin localStorage, no URL rewriting, no cookies):
//   1. ?vibe=<slug> on any page wins and is persisted; ?vibe=none clears
//      back to the Default theme. An explicit ?vibe= on Home wins too.
//   2. Otherwise a /vibe-redesign/<slug>/ or /vibe-redesign/<slug>/resume/
//      URL records that slug. The hub (/vibe-redesign/) records nothing,
//      so it keeps — and shows — the current theme instead of clearing it.
//   3. Otherwise the stored slug (if any) is re-applied — on every page,
//      Home included. Home no longer resets to Default: Default is now
//      an explicit choice in the header picker, like any other theme.
// Internal links need no changes: storage survives navigation. External
// project links leave this site, so no vibe can follow them — that is
// out of scope by design, not a bug to chase.
// A vibe is a fixed look, so while one is active the main site's
// light/dark toggle has nothing to switch (vibes.css overrides the
// data-theme tokens); the toggle is disabled until Default is chosen
// again. The header picker (see main.js) cycles themes on tap and opens
// the full list via its chevron / a long press; the banner in base.njk
// and choosing Default are the other ways back out.
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
  // Cycle order for the header picker's tap-to-cycle: Default first,
  // then the vibes alphabetically. Keep in step with the menu order in
  // src/_includes/base.njk.
  var ORDER = [
    null,
    "art-deco",
    "conservative",
    "experimental",
    "mid-century",
    "minimalist",
    "neubrutalist",
    "swiss",
    "tech-modern",
  ];
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

  function labelFor(slug) {
    return slug && VIBES[slug] ? VIBES[slug] : "Default";
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

  // The light/dark toggle is meaningless while a vibe is active, so
  // disable it there and re-enable it for Default. This element does
  // not exist yet when this file runs in <head>, so apply() is a no-op
  // for it on first paint and main.js re-syncs on DOMContentLoaded.
  function syncThemeToggle(slug) {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    if (slug && VIBES[slug]) {
      toggle.disabled = true;
      toggle.setAttribute("aria-disabled", "true");
      toggle.title =
        "Light/dark is off while the " + VIBES[slug] + " theme is active";
    } else {
      toggle.disabled = false;
      toggle.removeAttribute("aria-disabled");
      toggle.title = "Toggle theme";
    }
  }

  function apply(slug, silent) {
    if (slug && VIBES[slug]) {
      document.documentElement.setAttribute("data-vibe", slug);
    } else {
      document.documentElement.removeAttribute("data-vibe");
    }
    updateBanner();
    syncThemeToggle(slug);
    if (!silent) {
      try {
        window.dispatchEvent(
          new CustomEvent("bfung:vibe-change", {
            detail: { slug: slug || null, label: labelFor(slug) },
          })
        );
      } catch (e) {
        // Very old browsers without CustomEvent: the picker re-syncs
        // from data-vibe on its own events instead.
      }
    }
  }

  // Runs immediately (this file is loaded synchronously in <head>),
  // before stylesheets are applied, so there is no unthemed flash.
  // The initial apply is silent: no UI exists yet to listen for the
  // event, and the picker reads the state from data-vibe on load.
  var params = new URLSearchParams(window.location.search);
  var param = params.get("vibe");
  var pathMatch = window.location.pathname.match(
    /^\/vibe-redesign\/([^/]+)\/?/
  );
  var pathSlug =
    pathMatch && VIBES[pathMatch[1]] ? pathMatch[1] : null;

  if (param === "none") {
    store(null);
    apply(null, true);
  } else if (param && VIBES[param]) {
    store(param);
    apply(param, true);
  } else if (pathSlug) {
    store(pathSlug);
    apply(pathSlug, true);
  } else {
    apply(readStored(), true);
  }

  // The banner lives in the shared layout only; wire it once the
  // document is parsed. Clearing removes the attribute, so vibes.css
  // stops applying instantly — no reload needed.
  function wireBanner() {
    updateBanner();
    syncThemeToggle(currentSlug());
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
    label: labelFor,
    vibes: VIBES,
    order: ORDER,
    set: function (slug) {
      if (!slug) {
        store(null);
        apply(null);
        return;
      }
      if (!VIBES[slug]) return;
      store(slug);
      apply(slug);
    },
    clear: function () {
      store(null);
      apply(null);
    },
    next: function () {
      var idx = ORDER.indexOf(currentSlug());
      var nextSlug = ORDER[(idx + 1) % ORDER.length];
      if (nextSlug) {
        store(nextSlug);
        apply(nextSlug);
      } else {
        store(null);
        apply(null);
      }
      return nextSlug;
    },
  };
})();
