const KEY = "neon_txns";

export function getTxns() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function mergeTxns(incoming) {
  const existing = getTxns();
  const seen = new Set(existing.map(t => t.id));
  const fresh = incoming.filter(t => !seen.has(t.id));
  localStorage.setItem(KEY, JSON.stringify([...existing, ...fresh]));
  return { added: fresh.length, skipped: incoming.length - fresh.length, total: existing.length + fresh.length };
}

export function setCategory(id, category) {
  const txns = getTxns();
  const t = txns.find(t => t.id === id);
  if (t) { t.category = category; localStorage.setItem(KEY, JSON.stringify(txns)); }
}

export function setCreditCardPayment(id, value) {
  const txns = getTxns();
  const t = txns.find(t => t.id === id);
  if (t) { t.isCreditCardPayment = value; localStorage.setItem(KEY, JSON.stringify(txns)); }
}

export function exportJSON() {
  return JSON.stringify(getTxns(), null, 2);
}

export function exportCSV() {
  const txns = getTxns();
  if (!txns.length) return "";
  const keys = ["date","amount","description","subject","category","tags","isSpace","isCreditCardPayment",
    "month","originalAmount","originalCurrency","exchangeRate","id"];
  const esc = v => {
    const s = Array.isArray(v) ? v.join("|") : String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...txns.map(t => keys.map(k => esc(t[k])).join(","))].join("\n");
}

export function clearAll() {
  localStorage.removeItem(KEY);
}
