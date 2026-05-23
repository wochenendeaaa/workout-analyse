import { getTxns, setCategory, setCreditCardPayment } from "./storage.js";
import { renderCategoryChart, renderMerchantChart } from "./charts.js";

const CATEGORIES = [
  "Groceries","Restaurants","Transport","Health","Entertainment",
  "Shopping","Travel","Housing","Utilities","Insurance","Education",
  "Subscriptions","Other",
];

// Module-level state so event handlers can trigger re-renders without
// importing from app.js (avoids circular dependency).
let _selectedMonth = null;

const chf = n => `CHF ${Math.abs(n).toFixed(2)}`;
const sign = n => n >= 0 ? "+" : "−";
const esc = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function getAvailableMonths(txns) {
  return [...new Set(txns.map(t => t.month))].sort().reverse();
}

export function renderDashboard(allTxns, selectedMonth) {
  _selectedMonth = selectedMonth;

  const months = getAvailableMonths(allTxns);
  _updateMonthPicker(months, selectedMonth);

  const monthTxns = allTxns.filter(t => t.month === selectedMonth);
  const spaceTxns = monthTxns.filter(t => t.isSpace);
  const ccTxns    = monthTxns.filter(t => t.isCreditCardPayment && !t.isSpace);
  const realTxns  = monthTxns.filter(t => !t.isSpace && !t.isCreditCardPayment);

  _renderStats(realTxns, monthTxns.length);
  _renderBanners(spaceTxns, ccTxns);
  _renderCharts(realTxns);
  _renderSubscriptions(allTxns);
  _renderUncategorized(realTxns);
  _renderSpacesSection(spaceTxns);
  _renderCCSection(ccTxns);
}

// ── Month picker ────────────────────────────────────────────────────────────

function _updateMonthPicker(months, selected) {
  const sel = document.getElementById("month-select");
  sel.innerHTML = months.map(m =>
    `<option value="${m}"${m === selected ? " selected" : ""}>${_fmtMonth(m)}</option>`
  ).join("");
}

function _fmtMonth(m) {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

// ── Stats ───────────────────────────────────────────────────────────────────

function _renderStats(realTxns, totalCount) {
  const income   = realTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spending = realTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const net = income + spending;

  document.getElementById("stat-income").textContent   = chf(income);
  document.getElementById("stat-spending").textContent = chf(spending);

  const netEl   = document.getElementById("stat-net");
  netEl.textContent = `${sign(net)}${chf(net)}`;
  netEl.className   = `stat__value ${net >= 0 ? "positive" : "negative"}`;

  const netCard = document.getElementById("stat-card-net");
  netCard.className = `stat-card ${net >= 0 ? "stat-card--positive" : "stat-card--negative"}`;

  document.getElementById("stat-count").textContent  = realTxns.length;
  document.getElementById("total-count").textContent = `${totalCount} total this month`;
}

// ── Banners ─────────────────────────────────────────────────────────────────

function _renderBanners(spaceTxns, ccTxns) {
  const ccBanner = document.getElementById("cc-banner");
  if (ccTxns.length) {
    const total = ccTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    ccBanner.innerHTML =
      `⚠ <strong>${ccTxns.length} credit card payment${ccTxns.length > 1 ? "s" : ""}</strong>` +
      ` totaling ${chf(total)} excluded from totals.` +
      ` <a href="#cc-section" class="banner-link">Review ↓</a>`;
    ccBanner.className = "banner banner--warning";
  } else {
    ccBanner.className = "banner hidden";
  }

  const spBanner = document.getElementById("spaces-banner");
  if (spaceTxns.length) {
    const total = spaceTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    spBanner.innerHTML =
      `ℹ <strong>${spaceTxns.length} Spaces transfer${spaceTxns.length > 1 ? "s" : ""}</strong>` +
      ` (${chf(total)}) excluded — internal envelope movements.` +
      ` <a href="#spaces-section" class="banner-link">View ↓</a>`;
    spBanner.className = "banner banner--info";
  } else {
    spBanner.className = "banner hidden";
  }
}

// ── Charts ──────────────────────────────────────────────────────────────────

function _renderCharts(realTxns) {
  const spending = realTxns.filter(t => t.amount < 0);

  const byCat = {};
  for (const t of spending) {
    const cat = t.category || "(uncategorized)";
    byCat[cat] = (byCat[cat] ?? 0) + Math.abs(t.amount);
  }

  const byMerchant = {};
  for (const t of spending) {
    byMerchant[t.description] = (byMerchant[t.description] ?? 0) + Math.abs(t.amount);
  }

  renderCategoryChart(byCat);
  renderMerchantChart(byMerchant);
}

// ── Subscriptions ────────────────────────────────────────────────────────────

function _renderSubscriptions(allTxns) {
  const el    = document.getElementById("subs-content");
  const badge = document.getElementById("subs-badge");
  const months = getAvailableMonths(allTxns);

  if (months.length < 2) {
    el.innerHTML = '<p class="empty">Load 2+ months to detect recurring charges.</p>';
    badge.hidden = true;
    return;
  }

  const spending = allTxns.filter(t => !t.isSpace && !t.isCreditCardPayment && t.amount < 0);

  // Group transactions by merchant, then sum per month
  const byDesc = {};
  for (const t of spending) {
    (byDesc[t.description] ??= {})[t.month] =
      (byDesc[t.description][t.month] ?? 0) + Math.abs(t.amount);
  }

  const subs = [];
  for (const [desc, monthMap] of Object.entries(byDesc)) {
    const seenMonths = Object.keys(monthMap);
    if (seenMonths.length < 2) continue;

    const amounts = Object.values(monthMap);
    const med = _median(amounts);
    // Skip if amounts vary more than 30% — likely not a subscription
    if (Math.max(...amounts) / Math.min(...amounts) - 1 > 0.30) continue;

    subs.push({ desc, monthlyAmount: med, months: seenMonths.sort(), annualCost: med * 12 });
  }

  subs.sort((a, b) => b.annualCost - a.annualCost);

  if (!subs.length) {
    el.innerHTML = '<p class="empty">No recurring charges detected yet.</p>';
    badge.hidden = true;
    return;
  }

  badge.textContent = subs.length;
  badge.hidden = false;

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Merchant</th>
          <th class="num">Monthly avg</th>
          <th class="num">Annual est.</th>
          <th>Seen in</th>
        </tr>
      </thead>
      <tbody>
        ${subs.map(s => `
          <tr>
            <td>${esc(s.desc)}</td>
            <td class="num">${chf(s.monthlyAmount)}</td>
            <td class="num">${chf(s.annualCost)}</td>
            <td class="muted">${s.months.map(_fmtMonth).join(", ")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

// ── Uncategorized ────────────────────────────────────────────────────────────

function _renderUncategorized(realTxns) {
  const uncats = realTxns.filter(t => !t.category && t.amount < 0)
    .sort((a, b) => a.amount - b.amount); // biggest spending first
  const badge = document.getElementById("uncat-badge");
  const el    = document.getElementById("uncat-content");

  badge.textContent = uncats.length;
  badge.className   = `badge ${uncats.length ? "badge--warn" : "badge--ok"}`;

  if (!uncats.length) {
    el.innerHTML = '<p class="empty good">All transactions categorized ✓</p>';
    return;
  }

  // Quick-pick buttons: top 5 most-used categories in loaded data
  const catCounts = {};
  for (const t of realTxns.filter(t => t.category)) {
    catCounts[t.category] = (catCounts[t.category] ?? 0) + 1;
  }
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const quickCats = topCats.length ? topCats : CATEGORIES.slice(0, 5);

  el.innerHTML = `
    <div class="uncat-list">
      ${uncats.map(t => `
        <div class="uncat-row" data-id="${t.id}">
          <div class="uncat-row__info">
            <span class="uncat-row__desc">${esc(t.description)}</span>
            <span class="uncat-row__meta">${t.date}${t.subject ? " · " + esc(t.subject) : ""} · <strong>${chf(t.amount)}</strong></span>
          </div>
          <div class="uncat-row__actions">
            ${quickCats.map(c =>
              `<button class="btn btn--quick" data-id="${t.id}" data-cat="${esc(c)}">${esc(c)}</button>`
            ).join("")}
            <select class="select select--sm" data-id="${t.id}">
              <option value="">More…</option>
              ${CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>
        </div>
      `).join("")}
    </div>`;

  el.querySelectorAll(".btn--quick").forEach(btn =>
    btn.addEventListener("click", () => _applyCategory(btn.dataset.id, btn.dataset.cat))
  );
  el.querySelectorAll("select[data-id]").forEach(sel =>
    sel.addEventListener("change", () => { if (sel.value) _applyCategory(sel.dataset.id, sel.value); })
  );
}

function _applyCategory(id, category) {
  setCategory(id, category);
  renderDashboard(getTxns(), _selectedMonth);
}

// ── Spaces section ───────────────────────────────────────────────────────────

function _renderSpacesSection(spaceTxns) {
  const section = document.getElementById("spaces-section");
  document.getElementById("spaces-badge").textContent = spaceTxns.length;
  section.hidden = spaceTxns.length === 0;
  if (!spaceTxns.length) return;

  document.getElementById("spaces-content").innerHTML = `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Description</th><th>Subject</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${spaceTxns.map(t => `
          <tr>
            <td>${t.date}</td>
            <td>${esc(t.description)}</td>
            <td class="muted">${esc(t.subject)}</td>
            <td class="num ${t.amount >= 0 ? "positive" : "negative"}">${sign(t.amount)} ${chf(t.amount)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

// ── CC payments section ──────────────────────────────────────────────────────

function _renderCCSection(ccTxns) {
  const section = document.getElementById("cc-section");
  document.getElementById("cc-badge").textContent = ccTxns.length;
  section.hidden = ccTxns.length === 0;
  if (!ccTxns.length) return;

  const el = document.getElementById("cc-content");
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Description</th><th>Subject</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>
        ${ccTxns.map(t => `
          <tr>
            <td>${t.date}</td>
            <td>${esc(t.description)}</td>
            <td class="muted">${esc(t.subject)}</td>
            <td class="num negative">${chf(t.amount)}</td>
            <td><button class="btn btn--ghost btn--sm untag-cc" data-id="${t.id}">Remove tag</button></td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  el.querySelectorAll(".untag-cc").forEach(btn =>
    btn.addEventListener("click", () => {
      setCreditCardPayment(btn.dataset.id, false);
      renderDashboard(getTxns(), _selectedMonth);
    })
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
