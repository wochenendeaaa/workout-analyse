import { hashTransaction } from "./hasher.js";

// Neon often uses "Swisscard AECS" but also Viseca/Cumulus for CC bills.
const CC_PATTERN = /swisscard|viseca|cumulus.?mastercard/i;

function normalizeDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD.MM.YYYY → YYYY-MM-DD
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : str;
}

export function parseNeonCSV(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      delimiter: ";",
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: async ({ data, errors }) => {
        if (errors.length) console.warn("CSV parse warnings:", errors);
        try {
          const rows = await Promise.all(data.map(rowToTransaction));
          resolve(rows.filter(Boolean));
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

async function rowToTransaction(row) {
  const rawDate = row["Date"]?.trim() ?? "";
  const rawAmount = row["Amount"]?.trim() ?? "";
  if (!rawDate || !rawAmount) return null;

  const amount = parseFloat(rawAmount.replace(",", "."));
  if (isNaN(amount)) return null;

  const date = normalizeDate(rawDate);
  const description = row["Description"]?.trim() ?? "";
  const subject = row["Subject"]?.trim() ?? "";
  const category = row["Category"]?.trim() ?? "";
  const tagsRaw = row["Tags"]?.trim() ?? "";

  const origAmtStr = row["Original amount"]?.trim() ?? "";
  const origCurrStr = row["Original currency"]?.trim() ?? "";
  const exchRateStr = row["Exchange rate"]?.trim() ?? "";

  const originalAmount = origAmtStr ? parseFloat(origAmtStr.replace(",", ".")) : null;
  const originalCurrency = origCurrStr && origCurrStr !== "CHF" ? origCurrStr : null;
  const exchangeRate = exchRateStr ? parseFloat(exchRateStr.replace(",", ".")) : null;

  const id = await hashTransaction(date, rawAmount, description, subject);

  return {
    id,
    date,
    amount,
    originalAmount: originalAmount !== null && isNaN(originalAmount) ? null : originalAmount,
    originalCurrency,
    exchangeRate: exchangeRate !== null && isNaN(exchangeRate) ? null : exchangeRate,
    description,
    subject,
    category,
    tags: tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
    isSpace: (row["Spaces"]?.trim().toLowerCase() ?? "") === "yes",
    isCreditCardPayment: CC_PATTERN.test(description),
    month: date.slice(0, 7),
    importedAt: Date.now(),
  };
}
