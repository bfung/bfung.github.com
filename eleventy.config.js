export default function (eleventyConfig) {
  // Passthrough copy for assets (css, js, images)
  eleventyConfig.addPassthroughCopy("src/assets");

  // Passthrough copy for root-level files
  eleventyConfig.addPassthroughCopy({
    "src/robots.txt": "robots.txt",
    "src/.nojekyll": ".nojekyll"
  });

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
    },
  };
}
