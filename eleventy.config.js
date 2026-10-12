import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function (eleventyConfig) {
  // Passthrough copy for assets (css, js, images)
  eleventyConfig.addPassthroughCopy("src/assets");

  // Passthrough copy for root-level files
  eleventyConfig.addPassthroughCopy({
    "src/robots.txt": "robots.txt",
    "src/.nojekyll": ".nojekyll"
  });

  // Cache-busting: append a short content hash to local asset URLs so
  // pushes are picked up immediately instead of serving stale cached copies.
  eleventyConfig.addFilter("cacheBust", (url) => {
    try {
      const file = join("src", String(url).replace(/^\//, "").split("?")[0]);
      const hash = createHash("md5").update(readFileSync(file)).digest("hex").slice(0, 8);
      return `${url}?v=${hash}`;
    } catch {
      return url;
    }
  });

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
    },
  };
}
