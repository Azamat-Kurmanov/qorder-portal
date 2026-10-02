import { describe, expect, it } from 'vitest';
import { today } from './OccasionRibbon';

describe('праздник под шапкой', () => {
  /** В Алматы полночь наступает на пять часов раньше, чем по Гринвичу. */
  it('«до конца дня» считается по местной дате', () => {
    const justAfterMidnight = new Date(2026, 9, 1, 0, 30);
    expect(today(justAfterMidnight)).toBe('2026-10-01');
  });
});
