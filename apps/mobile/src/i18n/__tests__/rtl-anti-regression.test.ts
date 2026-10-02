import fs from 'fs';
import path from 'path';

describe('RTL Layout Anti-Regression', () => {
  const srcDir = path.resolve(__dirname, '../../');

  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          files.push(...getSourceFiles(fullPath));
        }
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.includes('.test.')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  it('ensures no files under src/ contain manual row-reverse or ternary isRTL direction flips', () => {
    const files = getSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      { name: 'row-reverse', regex: /row-reverse/ },
      { name: "isRTL ? 'right'", regex: /isRTL\s*\?\s*['"]right['"]/ },
      { name: "isRTL ? 'left'", regex: /isRTL\s*\?\s*['"]left['"]/ },
      { name: "isRTL ? 'flex-start'", regex: /isRTL\s*\?\s*['"]flex-start['"]/ },
      { name: "isRTL ? 'flex-end'", regex: /isRTL\s*\?\s*['"]flex-end['"]/ },
    ];

    const violations: { file: string; line: number; pattern: string; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comment-only lines
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }

        for (const { name, regex } of forbiddenPatterns) {
          if (regex.test(line)) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              pattern: name,
              text: line.trim(),
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
