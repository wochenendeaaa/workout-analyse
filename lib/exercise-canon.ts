export interface CatalogEntry {
  id: string;
  canonicalName: string;
  aliases: string; // JSON-encoded string[]
}

export interface CanonicalizationResult {
  catalogId: string;
  canonicalName: string;
  confidence: "high" | "low";
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-zäöüß0-9\s]/g, "");
}

/**
 * Matches a raw exercise name against the catalog using exact alias lookup
 * first, then Levenshtein distance as fallback.
 *
 * Returns null when no entry is close enough (distance ratio > 0.4).
 */
export function canonicalize(
  rawName: string,
  catalog: CatalogEntry[],
): CanonicalizationResult | null {
  const needle = normalize(rawName);
  if (!needle) return null;

  let bestEntry: CatalogEntry | null = null;
  let bestDist = Infinity;
  let bestTermLen = 1;

  for (const entry of catalog) {
    const terms: string[] = [normalize(entry.canonicalName)];
    try {
      const aliases = JSON.parse(entry.aliases) as string[];
      for (const a of aliases) terms.push(normalize(a));
    } catch {
      /* malformed aliases JSON — skip */
    }

    for (const term of terms) {
      if (term === needle) {
        return { catalogId: entry.id, canonicalName: entry.canonicalName, confidence: "high" };
      }
      const d = levenshtein(needle, term);
      if (d < bestDist) {
        bestDist = d;
        bestEntry = entry;
        bestTermLen = term.length;
      }
    }
  }

  if (!bestEntry) return null;

  // Use max of needle and matching term length so short aliases don't inflate acceptance
  const maxLen = Math.max(needle.length, bestTermLen, 1);
  if (bestDist / maxLen > 0.4) return null;

  return {
    catalogId: bestEntry.id,
    canonicalName: bestEntry.canonicalName,
    confidence: bestDist <= 2 ? "high" : "low",
  };
}
