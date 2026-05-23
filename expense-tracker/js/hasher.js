// Stable 16-char hex ID for dedup. Fields chosen to survive CSV re-exports:
// same date+amount+merchant+reference = same transaction.
export async function hashTransaction(date, rawAmount, description, subject) {
  const input = `${date}|${rawAmount}|${description}|${subject}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
