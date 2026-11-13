// Runs Google Lighthouse (desktop) on each site and draws a score card per site.
// Used by .github/workflows/cards.yml. Output: profile/lighthouse-<name>.svg
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const sites = [
  { name: "portfolio", label: "ckbreuning.com", url: "https://www.ckbreuning.com/" },
  { name: "sgl", label: "sgl.ckbreuning.com", url: "https://sgl.ckbreuning.com/" },
];

const categories = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best Practices"],
  ["seo", "SEO"],
];

// Portfolio colours
const c = {
  bg: "#060818",
  track: "#0F1228",
  title: "#1ADB9E",
  text: "#E8EDF5",
  muted: "#6B7A99",
  good: "#1ADB9E",
  ok: "#E8C840",
  bad: "#FF5A5F",
};

const scoreColor = (s) => (s >= 90 ? c.good : s >= 50 ? c.ok : c.bad);

function runLighthouse(url, name) {
  const out = `/tmp/lh-${name}.json`;
  execFileSync(
    "npx",
    [
      "--yes",
      "lighthouse@13",
      url,
      "--preset=desktop",
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
      "--chrome-flags=--headless=new --no-sandbox",
    ],
    { stdio: "inherit" },
  );
  const report = JSON.parse(readFileSync(out, "utf8"));
  return categories.map(([id, label]) => ({
    label,
    score: Math.round((report.categories[id]?.score ?? 0) * 100),
  }));
}

function gauge(x, { label, score }) {
  const r = 30;
  const len = 2 * Math.PI * r;
  const filled = (score / 100) * len;
  const col = scoreColor(score);
  return `
  <g transform="translate(${x}, 98)">
    <circle r="${r}" fill="none" stroke="${c.track}" stroke-width="6"/>
    <circle r="${r}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${filled.toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90)"/>
    <text y="7" text-anchor="middle" font-size="20" font-weight="700" fill="${col}">${score}</text>
    <text y="56" text-anchor="middle" font-size="12" fill="${c.text}">${label}</text>
  </g>`;
}

function card(site, scores) {
  const width = 400;
  const step = width / scores.length;
  const gauges = scores.map((s, i) => gauge(step * i + step / 2, s)).join("");
  const date = new Date().toISOString().slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="170" viewBox="0 0 ${width} 170" font-family="'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif">
  <title>Lighthouse scores for ${site.label}</title>
  <rect width="${width}" height="170" rx="6" fill="${c.bg}"/>
  <text x="20" y="28" font-size="16" font-weight="600" fill="${c.title}">Lighthouse · ${site.label}</text>
  <text x="20" y="46" font-size="11" fill="${c.muted}">Desktop · tested ${date}</text>${gauges}
</svg>
`;
}

mkdirSync("profile", { recursive: true });
let failed = 0;
for (const site of sites) {
  try {
    const scores = runLighthouse(site.url, site.name);
    writeFileSync(`profile/lighthouse-${site.name}.svg`, card(site, scores));
    console.log(site.label, scores.map((s) => `${s.label} ${s.score}`).join(", "));
  } catch (err) {
    // Keep the previous card if a site is briefly down
    failed++;
    console.error(`Lighthouse failed for ${site.url}:`, err.message);
  }
}
if (failed === sites.length) process.exit(1);
