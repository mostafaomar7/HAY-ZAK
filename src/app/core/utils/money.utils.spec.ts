import { applyBps, calculatePrice, daysBetweenDates, maskIban, sarToHalalas } from './money.utils';

describe('money.utils', () => {
  describe('calculatePrice', () => {
    const base = { commissionRateBps: 1000, vatRateBps: 1500 } as const;

    /** 100.00 SAR a day. Every figure below is halalas. */
    const daily = sarToHalalas(100);

    it('computes the subtotal as days x daily price (FR-BKG-02)', () => {
      const result = calculatePrice(daily, 7, { ...base, commissionBearer: 'lessor' });
      expect(result.subtotalHalalas).toBe(70_000);
      expect(result.days).toBe(7);
    });

    it('deducts commission and VAT from the lessor when the lessor bears it', () => {
      const result = calculatePrice(daily, 10, {
        ...base,
        commissionBearer: 'lessor',
        vatBase: 'commission',
      });
      // 1,000.00 gross, 100.00 commission, 15.00 VAT on the commission.
      expect(result.totalHalalas).toBe(100_000);
      expect(result.commissionHalalas).toBe(10_000);
      expect(result.vatHalalas).toBe(1_500);
      expect(result.netToLessorHalalas!).toBe(88_500);
    });

    it('adds commission on top when the renter bears it', () => {
      const result = calculatePrice(daily, 10, {
        ...base,
        commissionBearer: 'renter',
        vatBase: 'commission',
      });
      expect(result.totalHalalas).toBe(111_500);
      expect(result.netToLessorHalalas!).toBe(100_000);
    });

    it('charges VAT on the whole booking when vatBase is total', () => {
      const result = calculatePrice(daily, 10, {
        ...base,
        commissionBearer: 'renter',
        vatBase: 'total',
      });
      expect(result.vatHalalas).toBe(15_000);
    });

    /**
     * The reason money is integers. In riyals this is 33.33 × 3 = 99.99, whose
     * 10% is 9.999 — a figure that has to become 10.00 or 9.99 and, in floats,
     * was liable to become neither exactly.
     */
    it('keeps every amount a whole number of halalas', () => {
      const result = calculatePrice(sarToHalalas(33.33), 3, {
        ...base,
        commissionBearer: 'lessor',
        vatBase: 'commission',
      });

      for (const value of [
        result.subtotalHalalas,
        result.commissionHalalas,
        result.vatHalalas,
        result.totalHalalas,
        result.netToLessorHalalas!,
      ]) {
        expect(Number.isInteger(value)).withContext(String(value)).toBeTrue();
      }
    });

    it('splits a commission that does not halve evenly without losing a halala', () => {
      // 999 halalas of commission: one half is 500, the other 499.
      const result = calculatePrice(3_330, 3, {
        ...base,
        commissionBearer: 'shared',
        vatBase: 'commission',
      });

      const renterPaid = result.totalHalalas - result.subtotalHalalas - result.vatHalalas;
      const lessorPaid = result.subtotalHalalas - result.netToLessorHalalas!;

      expect(renterPaid + lessorPaid).toBe(result.commissionHalalas!);
    });

    it('never lets the split option pay out more than the gross', () => {
      const result = calculatePrice(sarToHalalas(200), 5, {
        ...base,
        commissionBearer: 'shared',
        vatBase: 'commission',
      });
      expect(result.netToLessorHalalas!).toBeLessThan(result.subtotalHalalas);
      expect(result.totalHalalas).toBeGreaterThan(result.subtotalHalalas);
    });
  });

  describe('applyBps', () => {
    it('reads 1500 as 15%', () => {
      expect(applyBps(100_000, 1500)).toBe(15_000);
    });

    it('rounds to the nearest halala', () => {
      // 15% of 3.33 SAR is 0.4995 SAR.
      expect(applyBps(333, 1500)).toBe(50);
    });
  });

  describe('daysBetweenDates', () => {
    /**
     * The range is half-open: the 10th to the 15th is five nights, and the unit
     * is free again on the 15th for the next renter.
     */
    it('counts a half-open range as nights, not calendar days touched', () => {
      expect(daysBetweenDates('2026-10-10', '2026-10-15')).toBe(5);
    });

    /**
     * `new Date('2026-10-10')` is UTC midnight, which is 9 October in any
     * negative offset. The whole reason these are parsed field by field.
     */
    it('reads a plain date the same in every timezone', () => {
      expect(daysBetweenDates('2026-01-01', '2026-01-02')).toBe(1);
      expect(daysBetweenDates('2026-03-01', '2026-04-01')).toBe(31);
    });

    it('returns 0 rather than a negative count for a reversed range', () => {
      expect(daysBetweenDates('2026-09-08', '2026-09-01')).toBe(0);
    });
  });

  it('masks an IBAN down to its last four characters (NFR-SEC-02)', () => {
    const masked = maskIban('SA0380000000608010167519');
    expect(masked).toContain('7519');
    expect(masked).not.toContain('0380000000608010');
  });
});
