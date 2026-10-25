// Upload the RUM bundle source map to Datadog (Source Code Integration).
//
// What this enables: RUM Error Tracking can unminify stack traces from the
// minified rum-init.js bundle and link stack frames to this GitHub repo.
// datadog-ci collects the Git metadata (repo URL, commit hash, file paths)
// from this working directory, so run this AFTER commit + push — the
// recorded commit must be the one deployed to GitHub Pages.
//
// Tag matching — these MUST match the RUM init in src/assets/js/rum-init.src.js:
//   --service bfung.github.io                          == datadogRum.init service
//   --release-version <version from package.json>      == datadogRum.init version
//   --minified-path-prefix https://bfung.github.io/assets/js
//       == the URL the bundle is served from (https://bfung.github.io/assets/js/rum-init.js)
// `env` (prod) is NOT part of source-map matching.
//
// Usage:
//   DD_API_KEY=<dedicated Datadog API key> npm run upload:sourcemaps
//   npm run upload:sourcemaps -- --dry-run   (validates without uploading;
//       needs no key — a placeholder is used for datadog-ci's startup check)
// The API key is never committed. Create a dedicated key in Datadog
// (Organization Settings > API Keys) — do not reuse a personal key.
// Either DD_API_KEY or DATADOG_API_KEY works; both are passed through
// because datadog-ci reads both names in different places.
// DD_SITE defaults to us3.datadoghq.com; override it only if the org moves sites.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const version = pkg.version;
const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.DD_API_KEY ?? process.env.DATADOG_API_KEY;

if (!apiKey && !dryRun) {
  console.error(
    "Missing API key. Create a dedicated Datadog API key and run:\n" +
      "  DD_API_KEY=<key> npm run upload:sourcemaps",
  );
  process.exit(1);
}

// Refuse on a dirty tree: the uploaded Git metadata must describe the
// commit that is actually deployed, and the bundle must be the committed one.
const status = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
if (status) {
  console.error(
    "Working tree is not clean. Commit and push first, then run the upload\n" +
      "so the source map is tied to the deployed commit:\n" +
      status,
  );
  process.exit(1);
}

const env = {
  ...process.env,
  DD_SITE: process.env.DD_SITE ?? "us3.datadoghq.com",
  DATADOG_SITE: process.env.DATADOG_SITE ?? "us3.datadoghq.com",
};
// datadog-ci needs an API key set even for --dry-run (its metrics logger
// reads it at startup); a dry run uploads nothing, so a placeholder is
// enough when no real key is present.
const effectiveKey = apiKey ?? (dryRun ? "dry-run" : undefined);
if (effectiveKey) {
  env.DD_API_KEY = effectiveKey;
  env.DATADOG_API_KEY = effectiveKey;
}

const args = [
  "datadog-ci",
  "sourcemaps",
  "upload",
  "src/assets/js",
  "--service",
  "bfung.github.io",
  "--release-version",
  version,
  "--minified-path-prefix",
  "https://bfung.github.io/assets/js",
];
if (dryRun) args.push("--dry-run");

console.log(
  `Uploading source maps: service=bfung.github.io release-version=${version}` +
    (dryRun ? " (dry run)" : ""),
);
execFileSync("npx", args, { stdio: "inherit", env });
