# VibeRedesign Content-Sync Plan

Status: IMPLEMENTED 2026-10-22 — all 8 redesigns + main site render from src/_data/profile.json, resume.json, projects.json, guides.json. Plan produced 2026-10-22; sections 3+ were delivered in the planning report and executed as summarized in git history (767bbf1, 7516ccf, and the final sync commit).
Goal (user's words): update content on all VibeRedesign pages to match the main site,
source content from a single place so main-site changes reflect on all redesigns,
use subagents to update the redesigns, coordinator verifies.

Repo rules (from `AGENTS.md`, binding): source in `src/`, built output in `docs/`
(never hand-edit `docs/`; always commit `docs/` with source; build = `npm run build`;
push to `master`). Vibe pages must stay self-contained (system fonts, vanilla CSS/JS,
zero third-party requests), must not imply job-seeking (contact = simple "find me"
links; tech-modern status stays "systems operational"), no zip/email/phone,
"Irvine, CA" is fine. Each vibe's visual design, markup, and voice-y intro copy are
preserved — only factual content syncs.

---

## 0. Audit verification notes (coordinator audit re-checked against files)

Confirmed: all 16 vibe files contain zero `{{` and zero `{%` (grep count = 0) —
100% hardcoded. Main `src/index.njk` / `src/resume.njk` are also fully hardcoded
except the `projects` / `guides` loops on the home page.

Corrections / refinements to the coordinator's audit:

1. **tech-modern's "32 skills" and "07 roles" are currently CORRECT, not wrong.**
   Main resume has exactly 32 skills (6+5+6+5+6+4) and 7 jobs. They are still
   hardcoded and *will* drift on the next edit — that's the defect. Only
   "03 featured builds" is wrong today (main home shows 5 projects).
2. **All 8 vibe resumes contain all 32 skill strings and all 7 job-tag sets.**
   Skills drift is presentational only: tech-modern/resume abbreviates group
   headings by design (`infra`, `cicd-observability`, …). No skill is missing
   anywhere.
3. **Job bullets match everywhere as text**, but every vibe resume drops the
   GitHub repo links from the Datadog bullet — main has 4 links
   (`vector.dev`, `github.com/vectordotdev/vector`, `quickwit.io`,
   `github.com/quickwit-oss/quickwit`); vibes keep only `vector.dev` /
   `quickwit.io` and drop the `(vectordotdev/vector)` / `(quickwit-oss/quickwit)`
   parentheticals. Company links also vary: conservative, art-deco, and
   experimental resumes link **no** companies; the other five link
   Datadog/Brightloom/Opower exactly like main. Incisent is unlinked everywhere
   (correct — main has no URL for it).
4. **Experimental resume has no identity header at all** — no name, title,
   summary, location, or LinkedIn/GitHub anywhere in the file (verified by
   string search). It goes straight to "WORK FILES". See §1 and Open Question 2.
5. **Mid-century + neubrutalist resumes have no location line** (LinkedIn /
   GitHub / StackOverflow present, "Irvine" absent). The other five resumes
   have Irvine, CA + LinkedIn + GitHub in the header. (StackOverflow is *not*
   in main resume's contact row, so its presence/absence on a vibe resume is
   not drift; required resume-contact subset = location + LinkedIn + GitHub.)
6. Home social label for the blogspot URL: main = **"Blog"** (deliberately
   renamed from "Guides (Blog)" in commit `6f2acae`). Vibes: "Blog"
   (conservative), "GUIDES (BLOG)" (experimental), "Guides Blog" (mid-century,
   neubrutalist), "Guides" (art-deco, minimalist, tech-modern), "guides"
   (swiss). Canonical label = **Blog**.
7. Stale design-voice counts beyond tech-modern: mid-century home lede
   "Three builds, three obsessions…" and its backbar "Back to all three vibes"
   (there are 8 vibes). Experimental's "FILE 02 OF 03" filing numbers are the
   same era's artifact but are decorative filing jokes — exempt (§6).
8. The 3 hardcoded projects on every vibe home appear in legacy order
   (HNanalytics, Luggage Pack, uMatrix) with descriptions **verbatim** from
   `projects.json` — so descriptions never drifted; titles/order/links did.
   Vibe project tag chips are invented ("DATA ANALYSIS · DASHBOARD",
   "WEB APP · GEOMETRY", "P-02 // Geometry") and do not match `projects.json`
   tags (HNanalytics = `data, web app`; Luggage Pack = `web app`;
   uMatrix = `tool`).

---

## 1. Verified per-file drift inventory

Canonical main-site facts (the source of truth being created in §2):

- **Home:** name `Benson Fung`; taglines `build better, be better, boba.` /
  `family, friends, food, fun.`; Projects = all 5 from `projects.json`,
  newest-first (FamilyTreeMe, VibeRedesign, Luggage Pack,
  uMatrix Rule Generalizer, HNanalytics) with data tags, descriptions, links;
  Guides = 1 guide ("Publish and maintain a personal website using Muse from
  Meta and GitHub Pages for free", 2026-10-26, `/guides/personal-website-muse-github-pages/`);
  Socials (6): LinkedIn, GitHub, StackOverflow, Hacker News, Blog, Twitter
  (URLs in §2 schema). Main home itself has **no** summary paragraph —
  home summary prose on a vibe is bonus voice, not required parity.
- **Resume:** title `Software Systems & People Team Builder`; summary
  "A product focused, generalist software systems and engineering leader.
  Interested in technology that improves lives through transparency,
  efficiency, and simplification."; contact = Irvine, CA + LinkedIn + GitHub;
  7 jobs (title, company, location, dates, bullets, tags — §2 schema);
  Education = University of Illinois Urbana-Champaign, Aug 1999 – May 2003,
  "B.S. in Computer Science", "Software Engineering Certification Program";
  Skills = Core Expertise (6) + 5 groups (Languages 5, Infra & Orchestration 6,
  Data Platforms 5, AWS Cloud 6, CI/CD & Observability 4) = 32.

### 1a. Homes (`src/vibe-redesign/<vibe>.njk`)

Common to **all 8 homes**: only 3 of 5 projects, legacy order, invented tag
labels, **no Guides section / no guide title anywhere**, project link labels
hand-written per vibe instead of `links[].label` from data.

| Vibe | Hero / identity gaps | Social-label gap | Count / stale-copy problems |
|---|---|---|---|
| conservative | Has extended About (summary + extra voice sentences, §6 exempt) — first sentence must come from data. Hero line "Engineering Manager, Datadog — Irvine, California" must derive from `resume.experience[0]` + `profile.locationLong` | "Blog" ✓ already canonical | None |
| experimental | No title/summary prose; identity is voice-form: "ENGINEERING MANAGER — DATADOG // SYSTEMS & PEOPLE TEAM BUILDER", "EST. HUMAN — IRVINE, CA" (exempt, §6) | "GUIDES (BLOG)" → Blog | "FILE 02 OF 03" (exempt filing joke) |
| mid-century | Summary present ✓ (from data after refactor) | "Guides Blog" → Blog | Lede "Three builds, three obsessions: data, packing geometry, and taming the browser." → replacement in §4.4; backbar "Back to all three vibes" → "Back to all vibes" |
| art-deco | No title/summary prose (voice: "Portfolio — Est. MMIV"); tagline 2 rendered "Family · Friends · Food · Fun" — punctuation/case is presentation, text must source from data | "Guides" → Blog | Intro "Three constructions in code" (in the Selected Work intro paragraph) → generic replacement §4.4 |
| tech-modern | No summary prose; title inside terminal `whoami` line (voice, exempt). **Terminal content is duplicated**: static HTML *and* a JS `lines` array — both must interpolate the same data | "Guides" → Blog | Stats block: `03 featured builds` → computed `05`; `07 roles` / `32 skills` → computed (currently right, hardcoded); terminal `7 roles` → computed; `20+ years` stays literal (§6) |
| minimalist | Name + taglines only by design (exempt: no title/summary). Project title links point at `links[0].url` — loop must preserve that pattern | "Guides" → Blog | None. Needs a Guides block in its plain list style (§4.2) |
| neubrutalist | Title + summary present ✓ | "Guides Blog" → Blog | Project category words "P-01 // Data", "P-02 // Geometry", "P-03 // Devtools" → `project.tags[0]` from data |
| swiss | Title present (lowercase by CSS/design); no summary (exempt). Sections numbered 01 Projects / 02 Contact — Guides insertion rule in §4.2 | "guides" label text → Blog (case via CSS) | None |

All 8 homes: contact-section location flourishes ("Irvine, CA · remote-friendly"
etc. on mid-century, art-deco, tech-modern, neubrutalist) are voice — keep,
but the location string itself comes from `profile.location` /
`profile.locationLong`.

### 1b. Resumes (`src/vibe-redesign/<vibe>/resume.njk`)

Common to **all 8 resumes**: 7/7 jobs with correct titles, companies, dates,
bullets (text) and per-job tags; all 32 skills present. Common defects:
Datadog bullet loses the 2 GitHub repo links + parentheticals (§0.3);
everything hardcoded.

| Vibe | Header gaps | Education gaps | Link gaps | Other |
|---|---|---|---|---|
| conservative | Complete (Irvine, CA · LinkedIn · GitHub) | **Lossy**: "B.S. Computer Science — University of Illinois at Urbana-Champaign (1999 – 2003)" — no months, no "in", **certification program dropped** | No company links (presentation choice, §2 note) | — |
| experimental | **No header at all** — no name/title/summary/location/socials anywhere (exempt by design, Open Q2) | **Lossy**: one line "B.S. COMPUTER SCIENCE — UNIV. OF ILLINOIS URBANA-CHAMPAIGN" — no dates, no certification. Joke stamp "ABET-CERTIFIED NERD" is voice (exempt) | No company links; no social links | "7 JOBS" + "32 SKILLS CATALOGUED" → computed counts (§4.3). Skills shuffle JS manipulates DOM nodes — loop-rendered markup is compatible, pilot must confirm |
| mid-century | **No location line** — add `profile.location` into existing contact row | Complete ✓ | Company links ✓ like main | Section intro "Two decades of building systems…" is voice (exempt) |
| art-deco | Complete (Irvine, CA · LinkedIn · GitHub) | **Lossy**: "B.S. Computer Science — University of Illinois Urbana-Champaign" — no dates, no certification | No company links (presentation choice) | — |
| tech-modern | Complete (+ StackOverflow extra, allowed) | Complete ✓ | Company links ✓ | Skill group headings abbreviated by design (`infra`, `cicd-observability`, …) — groups map by **order**, heading text exempt (§6) |
| minimalist | Complete (Irvine, CA · LinkedIn · GitHub) | Complete ✓ | Company links ✓ | — |
| neubrutalist | **No location line** — add `profile.location` into existing contact row | Complete ✓ | Company links ✓ | — |
| swiss | Complete (lowercase styling is CSS/design) | Complete ✓ | Company links ✓ | Case is hand-written lowercase in source for many strings — see the case rule in §4.5 |

---

## 2. Single-source architecture

### 2.1 Data files

Existing, **unchanged**: `src/_data/site.json` (`name`, `url` — keep as the
canonical name/URL per repo AGENTS.md), `src/_data/projects.json`,
`src/_data/guides.json` (already the single source for projects/guides;
`project-card.njk` / `guide-card.njk` already consume them).

New, created once by the coordinator in Phase 0 and then **frozen**:

**`src/_data/profile.json`** — exposes global `profile`:

```json
{
  "title": "Software Systems & People Team Builder",
  "taglinePrimary": "build better, be better, boba.",
  "taglineSecondary": "family, friends, food, fun.",
  "summary": "A product focused, generalist software systems and engineering leader. Interested in technology that improves lives through transparency, efficiency, and simplification.",
  "location": "Irvine, CA",
  "locationLong": "Irvine, California",
  "avatar": "https://www.gravatar.com/avatar/f4057026c971b50fb44fb0b190adccef",
  "socials": [
    { "id": "linkedin",     "label": "LinkedIn",     "url": "https://www.linkedin.com/in/bensonfung",      "display": "linkedin.com/in/bensonfung" },
    { "id": "github",       "label": "GitHub",       "url": "https://github.com/bfung",                    "display": "github.com/bfung", "handle": "@bfung" },
    { "id": "stackoverflow","label": "StackOverflow","url": "https://stackoverflow.com/users/45793/benson","display": "stackoverflow.com/users/45793/benson" },
    { "id": "hackernews",   "label": "Hacker News",  "url": "https://news.ycombinator.com/user?id=bfung",  "display": "news.ycombinator.com/user?id=bfung" },
    { "id": "blog",         "label": "Blog",         "url": "https://benson-guides.blogspot.com/",         "display": "benson-guides.blogspot.com" },
    { "id": "twitter",      "label": "Twitter",      "url": "https://twitter.com/fungbenson",              "display": "twitter.com/fungbenson", "handle": "@fungbenson" }
  ]
}
```

Field notes:
- `summary` is copied **verbatim from `src/resume.njk`** ("product focused",
  no hyphen — the hyphenated "product-focused" variant lives only in main
  home's meta description front matter and stays there).
- `socials` order = the order vibe contact lists already use
  (LinkedIn, GitHub, StackOverflow, Hacker News, Blog, Twitter). Main home's
  Connect grid order differs (no GitHub, GitHub is in the hero) — the main
  refactor filters, it does not reorder (§3).
- `display` serves swiss / experimental / tech-modern, which print the URL-ish
  text next to the label. `handle` only where a design uses it (tech-modern).
- `avatar` has no `?s=` size; consumers append `?s=192` (home) / `?s=400`
  (OG/JSON-LD) exactly as today. No vibe page uses the avatar (monograms
  only) — main-site use only.
- Name is **not** duplicated here: templates use `site.name`.

**`src/_data/resume.json`** — exposes global `resume`:

```json
{
  "experience": [
    {
      "title": "Engineering Manager",
      "company": "Datadog",
      "companyUrl": "https://www.datadoghq.com/",
      "companyNote": null,
      "location": "Remote",
      "start": "Dec 2022",
      "end": "Present",
      "bulletsHtml": [
        "Lead Demo Engineering, a software development team creating content that showcases what the Datadog platform can do.",
        "Lead the Community Open Source Engineering team, engaging the open source community around <a href=\"https://vector.dev\" target=\"_blank\" rel=\"noopener\">Vector</a> (<a href=\"https://github.com/vectordotdev/vector\" target=\"_blank\" rel=\"noopener\">vectordotdev/vector</a>) and <a href=\"https://quickwit.io\" target=\"_blank\" rel=\"noopener\">Quickwit</a> (<a href=\"https://github.com/quickwit-oss/quickwit\" target=\"_blank\" rel=\"noopener\">quickwit-oss/quickwit</a>)."
      ],
      "tags": ["Engineering Leadership", "Open Source", "Rust", "Observability"]
    }
    /* …6 more jobs, same shape, newest-first, copied verbatim from src/resume.njk:
       Director of Data Platform / Brightloom (https://www.brightloom.com/) / Remote / Sep 2021 – Aug 2022 / 3 bullets / [Management, AWS, FinOps, Data Platform]
       Principal DevOps Engineer & Manager / Brightloom / Remote / Jan 2020 – Sep 2021 / 3 bullets / [Kubernetes, DevOps, CI/CD, InfoSec, Terraform]
       Sr. Staff DevOps Engineer & Manager / Brightloom / Remote / Jan 2019 – Jan 2020 / 2 bullets / [Datadog, IoT, Firmware, Ansible, Linux]
       Engineering Manager (Core Platform) / Opower, companyNote "Acq. by Oracle" / San Francisco, CA / Nov 2014 – Jul 2016 / 1 bullet / [Leadership, Developer Tooling, Infrastructure]
       Senior Software Engineer / Opower, companyNote "Acq. by Oracle" / San Francisco, CA / Aug 2011 – Jul 2014 / 2 bullets / [Java, API Gateway, Microservices, OAuth2]
       Software Engineer / Incisent Technologies, companyUrl null / Chicago, IL / Oct 2004
...[truncated 19676 chars]