import { spawnSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
import { formatCalendarDate, parseCalendarDate, normalizeCalendarDate } from '../calendarDate';

describe('calendarDate helpers', () => {
  describe('local unit behavior', () => {
    it('formats local Date to YYYY-MM-DD using local calendar values', () => {
      const date = new Date(2026, 2, 25, 0, 0, 0); // March 25, 2026
      expect(formatCalendarDate(date)).toBe('2026-03-25');
    });

    it('parses YYYY-MM-DD to a local Date preserving year, month, and day', () => {
      const parsed = parseCalendarDate('2026-03-25');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(2); // March
      expect(parsed.getDate()).toBe(25);
      expect(parsed.getHours()).toBe(12); // local noon
    });

    it('round-trips calendar date string without day drift', () => {
      const input = '2026-11-05';
      const parsed = parseCalendarDate(input);
      const serialized = formatCalendarDate(parsed);
      expect(serialized).toBe(input);
    });

    it('handles fallback for invalid or missing dates gracefully', () => {
      const now = new Date();
      const fallbackEmpty = parseCalendarDate('');
      expect(fallbackEmpty.getFullYear()).toBe(now.getFullYear());

      const fallbackNull = parseCalendarDate(null);
      expect(fallbackNull.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('genuine runtime TZ tests across positive (UTC+) and negative (UTC-) offsets', () => {
    const calendarDateModuleUrl = pathToFileURL(
      path.resolve(__dirname, '../calendarDate.ts')
    ).href;

    const runInTimezone = (targetTz: string, scriptBody: string) => {
      const script = `
        import { formatCalendarDate, parseCalendarDate, normalizeCalendarDate } from "${calendarDateModuleUrl}";
        const effectiveTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offsetMinutes = new Date().getTimezoneOffset();
        ${scriptBody}
      `;

      const result = spawnSync(
        process.execPath,
        ['--no-warnings', '--experimental-strip-types', '-e', script],
        {
          env: {
            ...process.env,
            TZ: targetTz,
          },
          encoding: 'utf8',
        }
      );

      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(`Subprocess failed with status ${result.status}: ${result.stderr}`);
      }

      return JSON.parse(result.stdout.trim());
    };

    it('preserves calendar date in positive offset (Asia/Tokyo, UTC+9) where naive UTC shifts backwards', () => {
      const output = runInTimezone(
        'Asia/Tokyo',
        `
        // 00:30 local in Tokyo on March 25 is March 24 15:30 UTC
        const localEarlyMorning = new Date(2026, 2, 25, 0, 30, 0);
        const naiveUtcSlice = localEarlyMorning.toISOString().slice(0, 10);
        const formatted = formatCalendarDate(localEarlyMorning);

        const parsed = parseCalendarDate('2026-03-25');
        const roundTripped = formatCalendarDate(parsed);

        const normalized = normalizeCalendarDate(localEarlyMorning);

        console.log(JSON.stringify({
          effectiveTz,
          offsetMinutes,
          naiveUtcSlice,
          formatted,
          roundTripped,
          parsedDate: parsed.getDate(),
          normalizedDate: normalized.getDate(),
        }));
        `
      );

      // Verify effective timezone and offset were genuinely established
      expect(output.effectiveTz).toBe('Asia/Tokyo');
      expect(output.offsetMinutes).toBe(-540); // UTC+9 is -540 minutes in JS getTimezoneOffset

      // Demonstrate that naive toISOString().slice(0,10) would shift the calendar day back to 2026-03-24
      expect(output.naiveUtcSlice).toBe('2026-03-24');

      // Verify formatCalendarDate preserves the picked calendar day
      expect(output.formatted).toBe('2026-03-25');
      expect(output.roundTripped).toBe('2026-03-25');
      expect(output.parsedDate).toBe(25);
      expect(output.normalizedDate).toBe(25);
    });

    it('preserves calendar date in negative offset (America/Los_Angeles, UTC-7/8) where naive UTC shifts forward', () => {
      const output = runInTimezone(
        'America/Los_Angeles',
        `
        // 23:30 local in Los Angeles on March 25 is March 26 06:30 UTC
        const localLateNight = new Date(2026, 2, 25, 23, 30, 0);
        const naiveUtcSlice = localLateNight.toISOString().slice(0, 10);
        const formatted = formatCalendarDate(localLateNight);

        const parsed = parseCalendarDate('2026-03-25');
        const roundTripped = formatCalendarDate(parsed);

        const normalized = normalizeCalendarDate(localLateNight);

        console.log(JSON.stringify({
          effectiveTz,
          offsetMinutes,
          naiveUtcSlice,
          formatted,
          roundTripped,
          parsedDate: parsed.getDate(),
          normalizedDate: normalized.getDate(),
        }));
        `
      );

      // Verify effective timezone and offset were genuinely established
      expect(output.effectiveTz).toBe('America/Los_Angeles');
      expect(output.offsetMinutes).toBeGreaterThan(0); // UTC-7 or UTC-8 is positive in JS getTimezoneOffset

      // Demonstrate that naive toISOString().slice(0,10) would shift the calendar day forward to 2026-03-26
      expect(output.naiveUtcSlice).toBe('2026-03-26');

      // Verify formatCalendarDate preserves the picked calendar day
      expect(output.formatted).toBe('2026-03-25');
      expect(output.roundTripped).toBe('2026-03-25');
      expect(output.parsedDate).toBe(25);
      expect(output.normalizedDate).toBe(25);
    });

    it('prevents calendar day drift when formatting client schedule dates (date-only & UTC midnight) in America/Los_Angeles and Asia/Tokyo', () => {
      // Test America/Los_Angeles (negative UTC offset)
      const laOutput = runInTimezone(
        'America/Los_Angeles',
        `
        const dateOnlyStr = '2026-04-15';
        const utcIsoStr = '2026-04-15T00:00:00.000Z';

        // Naive parsing drifts backwards to April 14 in LA because UTC midnight is 17:00 April 14
        const naiveDateOnly = new Date(dateOnlyStr).getDate();
        const naiveUtcIso = new Date(utcIsoStr).getDate();

        // parseCalendarDate normalizes to local noon, strictly preserving April 15
        const safeDateOnly = parseCalendarDate(dateOnlyStr);
        const safeUtcIso = parseCalendarDate(utcIsoStr);

        const enFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const arFormatter = new Intl.DateTimeFormat('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' });

        console.log(JSON.stringify({
          effectiveTz,
          naiveDateOnly,
          naiveUtcIso,
          safeDateOnlyDay: safeDateOnly.getDate(),
          safeUtcIsoDay: safeUtcIso.getDate(),
          enDateOnly: enFormatter.format(safeDateOnly),
          enUtcIso: enFormatter.format(safeUtcIso),
          arDateOnly: arFormatter.format(safeDateOnly),
        }));
        `
      );

      expect(laOutput.effectiveTz).toBe('America/Los_Angeles');
      // Proves the problem statement: naive parsing drifts to the prior day (14)
      expect(laOutput.naiveDateOnly).toBe(14);
      expect(laOutput.naiveUtcIso).toBe(14);
      // Proves the solution: parseCalendarDate preserves the 15th
      expect(laOutput.safeDateOnlyDay).toBe(15);
      expect(laOutput.safeUtcIsoDay).toBe(15);
      expect(laOutput.enDateOnly).toBe('Apr 15, 2026');
      expect(laOutput.enUtcIso).toBe('Apr 15, 2026');

      // Test Asia/Tokyo (positive UTC offset)
      const tokyoOutput = runInTimezone(
        'Asia/Tokyo',
        `
        const dateOnlyStr = '2026-04-15';
        const utcIsoStr = '2026-04-15T00:00:00.000Z';

        const safeDateOnly = parseCalendarDate(dateOnlyStr);
        const safeUtcIso = parseCalendarDate(utcIsoStr);

        const enFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        console.log(JSON.stringify({
          effectiveTz,
          safeDateOnlyDay: safeDateOnly.getDate(),
          safeUtcIsoDay: safeUtcIso.getDate(),
          enDateOnly: enFormatter.format(safeDateOnly),
          enUtcIso: enFormatter.format(safeUtcIso),
        }));
        `
      );

      expect(tokyoOutput.effectiveTz).toBe('Asia/Tokyo');
      expect(tokyoOutput.safeDateOnlyDay).toBe(15);
      expect(tokyoOutput.safeUtcIsoDay).toBe(15);
      expect(tokyoOutput.enDateOnly).toBe('Apr 15, 2026');
      expect(tokyoOutput.enUtcIso).toBe('Apr 15, 2026');
    });
  });
});
