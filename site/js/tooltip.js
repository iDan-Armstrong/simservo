// One floating help box for every glossary term, finding code and severity badge.
// Hover or keyboard focus shows it; tap toggles it on touch screens; Escape hides it.
// A mouse click on a term still reaches the finding or button around it.

import { CODES, SEVERITY, lookup } from "./glossary.js";

let tip = null;
let current = null;

function textFor(el) {
  if (el.dataset.term) {
    const t = lookup(el.dataset.term);
    return t ? { title: t.term, body: t.def } : null;
  }
  if (el.dataset.code) {
    const prefix = el.dataset.code.slice(0, 3);
    return CODES[prefix] ? { title: el.dataset.code, body: CODES[prefix] } : null;
  }
  if (el.dataset.sev) return SEVERITY[el.dataset.sev] ? { title: el.dataset.sev, body: SEVERITY[el.dataset.sev] } : null;
  return null;
}

function show(el) {
  const t = textFor(el);
  if (!t) return;
  current = el;
  tip.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = t.title;
  const p = document.createElement("span");
  p.textContent = t.body;
  tip.append(b, p);
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  tip.style.width = `${w}px`;
  let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  let top = r.bottom + 8;
  tip.style.left = `${left + window.scrollX}px`;
  tip.style.top = `${top + window.scrollY}px`;
  const h = tip.offsetHeight;
  if (top + h > window.innerHeight - 8) tip.style.top = `${r.top - h - 8 + window.scrollY}px`;
  el.setAttribute("aria-describedby", "tip");
}

function hide() {
  if (current) current.removeAttribute("aria-describedby");
  current = null;
  if (tip) tip.hidden = true;
}

const target = (e) => e.target.closest && e.target.closest(".term, [data-code], [data-sev]");

export function installTooltips() {
  tip = document.createElement("div");
  tip.id = "tip";
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);
  document.addEventListener("mouseover", (e) => { const el = target(e); if (el && el !== current) show(el); });
  document.addEventListener("mouseout", (e) => { const el = target(e); if (el && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener("focusin", (e) => { const el = target(e); if (el) show(el); });
  document.addEventListener("focusout", (e) => { if (target(e)) hide(); });
  let touch = false;
  document.addEventListener("pointerdown", (e) => { touch = e.pointerType === "touch" || e.pointerType === "pen"; }, true);
  document.addEventListener("click", (e) => {
    const el = target(e);
    if (el && touch && el.classList.contains("term")) { e.stopPropagation(); el === current ? hide() : show(el); }
    else if (!el) hide();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("scroll", hide, { passive: true });
}
