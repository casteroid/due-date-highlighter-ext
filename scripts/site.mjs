// Usage: node scripts/site.mjs — assembles the landing page into _site/.
// The demo dates are written relative to the build day, so the Pages workflow rebuilds daily to keep them current.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const OUT = "_site";
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");

/** @type {Record<string, (d: Date) => string>} */
const FORMATS = {
  iso: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  mdy: (d) => `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  dmy: (d) => `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`,
  weekday: (d) => `${WEEKDAYS_EN[d.getDay()]}, ${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`,
  pt: (d) => `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`,
};

/** Replaces `{{date:<days from today>:<format>}}` placeholders. */
function fillDates(html, today) {
  return html.replace(/\{\{date:(-?\d+):(\w+)\}\}/g, (placeholder, days, format) => {
    const render = FORMATS[format];
    if (!render) throw new Error(`Unknown date format in ${placeholder}`);
    return render(new Date(today.getFullYear(), today.getMonth(), today.getDate() + Number(days)));
  });
}

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/img`, { recursive: true });
await cp("site", OUT, { recursive: true });
await cp("store/screenshots", `${OUT}/img`, { recursive: true, filter: (src) => src === "store/screenshots" || src.endsWith(".png") });
for (const icon of ["icon-128.png", "icon-32.png"]) await cp(`src/icons/${icon}`, `${OUT}/img/${icon}`);

const index = `${OUT}/index.html`;
await writeFile(index, fillDates(await readFile(index, "utf8"), new Date()));
