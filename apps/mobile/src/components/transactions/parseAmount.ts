/**
 * Strict decimal-only amount parser.
 *
 * Supported inputs:
 * - ASCII digits (0-9), Arabic-Indic digits (٠-٩), Eastern Arabic-Indic / Persian digits (۰-۹).
 * - Optional leading sign ('+' or '-').
 * - At most one decimal separator: standard dot ('.'), comma (','), or Arabic decimal '٫' (U+066B).
 *
 * Decimal comma choice:
 * In mobile decimal keyboards and multilingual/European/Arabic locales, the comma ',' is commonly
 * provided as the decimal separator key on the numeric keypad. To provide an unambiguous, deterministic
 * user experience without speculative thousands-grouping heuristics, this parser treats a single comma,
 * dot, or Arabic decimal separator (U+066B) strictly as the decimal point. Any thousands-grouping
 * syntax (such as multiple commas/dots like '1,000.00' or '1.000,00' or Arabic grouping U+066C)
 * is explicitly rejected as ambiguous or malformed input.
 */
export function parseLocaleAmount(input: string | null | undefined): number {
  if (input == null) return NaN;
  const trimmed = input.trim();
  if (!trimmed) return NaN;

  // Convert Arabic-Indic (U+0660..U+0669) and Eastern Arabic-Indic / Persian (U+06F0..U+06F9) digits to ASCII
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  let normalized = '';
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const arIndex = arabicDigits.indexOf(char);
    if (arIndex !== -1) {
      normalized += String(arIndex);
      continue;
    }
    const faIndex = persianDigits.indexOf(char);
    if (faIndex !== -1) {
      normalized += String(faIndex);
      continue;
    }
    normalized += char;
  }

  // Handle optional leading sign
  let sign = 1;
  let numStr = normalized;
  if (numStr.startsWith('-')) {
    sign = -1;
    numStr = numStr.slice(1);
  } else if (numStr.startsWith('+')) {
    numStr = numStr.slice(1);
  }

  // Must not be empty after sign, and must not contain subsequent signs
  if (!numStr || numStr.includes('-') || numStr.includes('+')) {
    return NaN;
  }

  // Count decimal separators (. , \u066B). Reject if grouping or multiple separators are present
  const separators = numStr.match(/[.,\u066B]/g) || [];
  if (separators.length > 1) {
    // Rejects multiple commas, multiple dots, mixed dot/comma, or multiple decimal marks (e.g. 1.2.3, 1,000.50)
    return NaN;
  }

  // Must only contain digits and at most one decimal separator
  if (!/^[\d.,\u066B]+$/.test(numStr)) {
    return NaN;
  }

  // Must contain at least one digit
  if (!/\d/.test(numStr)) {
    return NaN;
  }

  // Normalize single decimal separator (if present) to standard dot '.'
  let cleanStr = numStr;
  if (separators.length === 1) {
    const sep = separators[0];
    const parts = numStr.split(sep);
    if (parts.length !== 2) return NaN;
    const [intPart, decPart] = parts;
    cleanStr = `${intPart || '0'}.${decPart}`;
  }

  const parsed = Number(cleanStr);
  if (!Number.isFinite(parsed)) return NaN;

  return sign * parsed;
}
