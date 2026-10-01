import type { MessageKey, MessageVars } from '../messages';

type Translator = (key: MessageKey, vars?: MessageVars) => string;

// Display-only translation for enum values that we keep stored verbatim
// (CLIENT, TOOLS, COMPLETED, ...). The DB/API payloads still see the raw
// upper-case identifier — only what the user reads changes.

const CATEGORY_KEYS: Record<string, MessageKey> = {
  CLIENT: 'transactions.form.catClient',
  PROJECT: 'transactions.form.catProject',
  TOOLS: 'transactions.form.catTools',
  OPERATIONS: 'transactions.form.catOperations',
  TAXES: 'transactions.form.catTaxes',
  OTHER: 'transactions.form.catOther',
};

const titleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[_\s-])\w/g, (m) => m.toUpperCase()).replace(/_/g, ' ');

export function categoryLabel(value: string, t: Translator) {
  const key = CATEGORY_KEYS[value];
  return key ? t(key) : titleCase(value);
}
