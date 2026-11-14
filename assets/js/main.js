document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const htmlEl = document.documentElement;

  // Function to get current effective theme (saved, system, or default to light)
  const getEffectiveTheme = () => {
    const savedTheme = localStorage.getItem("color-scheme");
    if (savedTheme) return savedTheme;
    
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return systemPrefersDark ? "dark" : "light";
  };

  // Initialize theme attribute based on current effective state (in case inline script missed it)
  const activeTheme = getEffectiveTheme();
  htmlEl.setAttribute("data-theme", activeTheme);

  // Apply theme change
  const applyTheme = (theme, persist = true) => {
    htmlEl.setAttribute("data-theme", theme);
    if (metaColorScheme) {
      metaColorScheme.content = theme;
    }
    if (persist) {
      localStorage.setItem("color-scheme", theme);
    } else {
      localStorage.removeItem("color-scheme");
    }
  };

  // Toggle theme on button click
  themeToggle.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme") || getEffectiveTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  });

  // Listen to system theme changes and react only if the user hasn't pinned their choice
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("color-scheme")) {
      const systemTheme = e.matches ? "dark" : "light";
      applyTheme(systemTheme, false);
    }
  });

  // --- Site-wide theme picker (hybrid) ---
  // Tap the main button to cycle Default -> vibes (alphabetical) ->
  // Default; the chevron, or a long press on the main button, opens
  // the full list to jump straight to any theme. State lives in
  // vibe.js (window.BfungVibe); this only wires the header UI.
  const vibePicker = document.getElementById("vibe-picker");
  if (vibePicker && window.BfungVibe) {
    const cycleBtn = document.getElementById("vibe-cycle");
    const menuBtn = document.getElementById("vibe-menu-btn");
    const menu = document.getElementById("vibe-menu");
    const announce = document.getElementById("vibe-announce");
    const cycleName = cycleBtn
      ? cycleBtn.querySelector("[data-vibe-cycle-name]")
      : null;
    const menuItems = menu
      ? Array.from(menu.querySelectorAll("[data-vibe]"))
      : [];
    let menuOpen = false;
    let longPressTimer = null;
    let longPressFired = false;

    const syncPicker = (announceChange) => {
      const slug = window.BfungVibe.get();
      const label = window.BfungVibe.label(slug);
      if (cycleBtn) {
        cycleBtn.setAttribute(
          "aria-label",
          `Theme: ${label} — tap for next theme, hold or use the arrow for all themes`
        );
      }
      if (cycleName) cycleName.textContent = label;
      menuItems.forEach((item) => {
        item.setAttribute(
          "aria-checked",
          String(item.getAttribute("data-vibe") === (slug || ""))
        );
      });
      if (announceChange && announce) {
        announce.textContent = `Theme changed to ${label}`;
      }
    };

    const openMenu = () => {
      if (!menu || !menuBtn || menuOpen) return;
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
      menuOpen = true;
      const current =
        menuItems.find((item) => item.getAttribute("aria-checked") === "true") ||
        menuItems[0];
      if (current) current.focus();
    };

    const closeMenu = (focusBack) => {
      if (!menu || !menuBtn || !menuOpen) return;
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuOpen = false;
      if (focusBack) menuBtn.focus();
    };

    const toggleMenu = () => (menuOpen ? closeMenu(false) : openMenu());

    if (cycleBtn) {
      cycleBtn.addEventListener("click", () => {
        if (longPressFired) {
          longPressFired = false;
          return;
        }
        window.BfungVibe.next();
      });
      // Long press (500ms) opens the menu instead of cycling. The
      // click that follows a long press is suppressed via the flag.
      cycleBtn.addEventListener("pointerdown", () => {
        longPressFired = false;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          openMenu();
        }, 500);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((evt) =>
        cycleBtn.addEventListener(evt, () => clearTimeout(longPressTimer))
      );
      cycleBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        longPressFired = true;
        openMenu();
      });
    }

    if (menuBtn) menuBtn.addEventListener("click", toggleMenu);

    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        const slug = item.getAttribute("data-vibe");
        if (slug) window.BfungVibe.set(slug);
        else window.BfungVibe.clear();
        closeMenu(true);
      });
    });

    if (menu) {
      menu.addEventListener("keydown", (e) => {
        const idx = menuItems.indexOf(document.activeElement);
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu(true);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          (menuItems[idx + 1] || menuItems[0]).focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          (menuItems[idx - 1] || menuItems[menuItems.length - 1]).focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          menuItems[0].focus();
        } else if (e.key === "End") {
          e.preventDefault();
          menuItems[menuItems.length - 1].focus();
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (menuOpen && !vibePicker.contains(e.target)) closeMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) closeMenu(true);
    });

    window.addEventListener("bfung:vibe-change", () => syncPicker(true));
    syncPicker(false);
  }

  // --- Mobile navigation toggle (progressive enhancement) ---
  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (navToggle && navMenu) {
    const setMenuOpen = (open) => {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    const isMenuOpen = () => navToggle.getAttribute("aria-expanded") === "true";

    navToggle.addEventListener("click", () => {
      setMenuOpen(!isMenuOpen());
    });

    // Close after choosing a link
    navMenu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMenuOpen(false);
    });

    // Close on Escape, returning focus to the toggle
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isMenuOpen()) {
        setMenuOpen(false);
        navToggle.focus();
      }
    });

    // Close when tapping outside the nav
    document.addEventListener("click", (e) => {
      if (isMenuOpen() && !e.target.closest(".site-nav")) setMenuOpen(false);
    });

    // Reset when resizing up to the desktop layout
    window.matchMedia("(min-width: 640px)").addEventListener("change", (e) => {
      if (e.matches) setMenuOpen(false);
    });
  }
});
