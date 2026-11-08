/** One stylesheet for every highlight; colours come from the inline --ddh-bg / --ddh-fg properties. */
export const HIGHLIGHT_CSS = `
[data-ddh]{border-radius:2px}
.ddh-background{background:var(--ddh-bg);color:var(--ddh-fg);padding:0 2px}
.ddh-underline{text-decoration:underline 2px var(--ddh-bg);text-underline-offset:2px}
.ddh-outline{outline:2px solid var(--ddh-bg);outline-offset:1px}
.ddh-badge{background:var(--ddh-bg);color:var(--ddh-fg);border-radius:999px;padding:0 .4em}
[data-ddh-badge]::after{content:attr(data-ddh-badge);font-size:.75em;margin-left:.3em;opacity:.8}
.ddh-flash{animation:ddh-flash 1s ease-out}
@keyframes ddh-flash{0%{outline:3px solid var(--ddh-bg);outline-offset:2px}100%{outline:3px solid transparent;outline-offset:2px}}
`;
