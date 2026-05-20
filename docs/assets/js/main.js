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
});
