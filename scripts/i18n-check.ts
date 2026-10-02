import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ar, en } from '../apps/web/src/messages/index';

const messagesDir = path.resolve(process.cwd(), 'packages/shared/src/messages');
const files = [
  { locale: 'en', file: path.join(messagesDir, 'en.ts'), messages: en },
  { locale: 'ar', file: path.join(messagesDir, 'ar.ts'), messages: ar },
] as const;

function getDuplicateKeys(filePath: string) {
  const source = readFileSync(filePath, 'utf8');
  const keyPattern = /^[\t ]*['"]([^'"]+)['"]\s*:/gm;
  const counts = new Map<string, number>();

  for (const match of source.matchAll(keyPattern)) {
    const key = match[1];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

const [base, target] = files;
const baseKeys = Object.keys(base.messages);
const targetKeys = Object.keys(target.messages);
const baseKeySet = new Set(baseKeys);
const targetKeySet = new Set(targetKeys);

const missing = baseKeys.filter((key) => !targetKeySet.has(key));
const extra = targetKeys.filter((key) => !baseKeySet.has(key));
const duplicateReports = files.flatMap(({ locale, file }) =>
  getDuplicateKeys(file).map(({ key, count }) => ({ locale, key, count })),
);

const problems: string[] = [];

if (missing.length > 0) {
  problems.push(`Missing keys in ${target.locale}: ${missing.join(', ')}`);
}

if (extra.length > 0) {
  problems.push(`Extra keys in ${target.locale}: ${extra.join(', ')}`);
}

for (const report of duplicateReports) {
  problems.push(`Duplicate key in ${report.locale}: ${report.key} (${report.count}x)`);
}

if (problems.length > 0) {
  console.error('[i18n-check] Key parity failed.');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`[i18n-check] ${target.locale} matches ${base.locale}.`);
