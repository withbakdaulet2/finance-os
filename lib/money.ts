// Parsing of money typed by the user. The result stays a STRING so it reaches
// Postgres numeric(14,2) without passing through floating point.

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/; // numeric(14,2): 12 integer digits, 2 decimals

export type ParsedAmount = { ok: true; value: string } | { ok: false };

// Accepts "1500", "1 500,50", "1500.5". Rejects negatives, 3+ decimals, text.
export function parseAmountInput(raw: string): ParsedAmount {
  const cleaned = raw.replace(/[\s\u00A0]/g, "").replace(",", ".");
  return AMOUNT_PATTERN.test(cleaned)
    ? { ok: true, value: cleaned }
    : { ok: false };
}
