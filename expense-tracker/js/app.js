import { parseNeonCSV } from "./parser.js";
import { getTxns, mergeTxns, clearAll, exportJSON, exportCSV } from "./storage.js";
import { renderDashboard, getAvailableMonths } from "./dashboard.js";

// crypto.subtle only available in secure contexts (localhost or https).
if (!window.isSecureContext || !window.crypto?.subtle) {
  document.body.innerHTML =
    `<p style="padding:2rem;color:#dc2626;font-family:sans-serif">
      This app needs a secure context to hash transaction IDs.<br>
      Run it with: <code>python -m http.server</code> and open <code>http://localhost:8000</code>
    </p>`;
  throw new Error("insecure context");
}

let selectedMonth = null;

function init() {
  // Restore any previously imported data
  const stored = getTxns();
  if (stored.length) {
    selectedMonth = getAvailableMonths(stored)[0];
    _showDashboard(stored);
  }

  // File picker
  document.getElementById("file-input").addEventListener("change", e => {
    _handleFiles([...e.target.files]);
    e.target.value = ""; // allow re-selecting the same file
  });

  // Drag-and-drop
  const dz = document.getElementById("drop-zone");
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drop-zone--active"); });
  dz.addEventListener("dragleave", e => {
    if (!dz.contains(e.relatedTarget)) dz.classList.remove("drop-zone--active");
  });
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drop-zone--active");
    _handleFiles([...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith(".csv")));
  });

  // Month picker
  document.getElementById("month-select").addEventListener("change", e => {
    selectedMonth = e.target.value;
    renderDashboard(getTxns(), selectedMonth);
  });

  // Export
  document.getElementById("export-json-btn").addEventListener("click", () =>
    _download("neon-expenses.json", exportJSON(), "application/json")
  );
  document.getElementById("export-csv-btn").addEventListener("click", () =>
    _download("neon-expenses.csv", exportCSV(), "text/csv")
  );

  // Clear
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (!confirm("Delete all imported data? This cannot be undone.")) return;
    clearAll();
    selectedMonth = null;
    document.getElementById("dashboard").hidden = true;
    document.getElementById("header-actions").hidden = true;
    document.getElementById("drop-zone").classList.remove("drop-zone--compact");
    _banner("All data cleared.", "neutral", 3000);
  });
}

async function _handleFiles(files) {
  if (!files.length) return;

  let totalAdded = 0;
  let totalSkipped = 0;
  let newestMonth = null;

  for (const file of files) {
    let text;
    try { text = await file.text(); } catch (e) {
      _banner(`Cannot read ${file.name}: ${e.message}`, "error", 6000);
      continue;
    }

    let txns;
    try { txns = await parseNeonCSV(text); } catch (e) {
      _banner(`Error parsing ${file.name}: ${e.message}`, "error", 6000);
      continue;
    }

    if (!txns.length) {
      _banner(`No transactions found in ${file.name}. Is it a Neon CSV?`, "warning", 6000);
      continue;
    }

    const result = mergeTxns(txns);
    totalAdded   += result.added;
    totalSkipped += result.skipped;

    // Track the most recent month across all dropped files
    const fileMonths = getAvailableMonths(txns);
    if (!newestMonth || fileMonths[0] > newestMonth) newestMonth = fileMonths[0];
  }

  if (totalAdded === 0 && totalSkipped === 0) return;

  const all = getTxns();
  selectedMonth = newestMonth ?? getAvailableMonths(all)[0];
  _showDashboard(all);

  const msg = totalAdded > 0
    ? `Imported ${totalAdded} transaction${totalAdded !== 1 ? "s" : ""}` +
      (totalSkipped ? ` · ${totalSkipped} duplicate${totalSkipped !== 1 ? "s" : ""} skipped` : "") + "."
    : `No new transactions — ${totalSkipped} duplicate${totalSkipped !== 1 ? "s" : ""} already stored.`;
  _banner(msg, totalAdded > 0 ? "success" : "neutral", 5000);
}

function _showDashboard(allTxns) {
  document.getElementById("dashboard").hidden = false;
  document.getElementById("header-actions").hidden = false;
  document.getElementById("drop-zone").classList.add("drop-zone--compact");
  renderDashboard(allTxns, selectedMonth);
}

function _banner(msg, type, ms) {
  const el = document.getElementById("import-banner");
  el.textContent = msg;
  el.className = `banner banner--${type}`;
  if (ms) setTimeout(() => { if (el.textContent === msg) el.className = "banner hidden"; }, ms);
}

function _download(name, content, mime) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

init();
