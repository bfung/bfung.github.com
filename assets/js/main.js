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
