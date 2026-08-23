import { calculatePrice, daysBetweenDates, maskIban, round2 } from './money.utils';

describe('money.utils', () => {
  describe('calculatePrice', () => {
    const base = { commissionRate: 0.1, vatRate: 0.15 } as const;

    it('computes the subtotal as days x daily price (FR-BKG-02)', () => {
      const result = calculatePrice(100, 7, { ...base, commissionBearer: 'lessor' });
      expect(result.subtotal).toBe(700);
      expect(result.days).toBe(7);
    });

    it('deducts commission and VAT from the lessor when the lessor bears it', () => {
      const result = calculatePrice(100, 10, {
        ...base,
        commissionBearer: 'lessor',
        vatBase: 'commission',
      });
      // 1000 gross, 100 commission, 15 VAT on the commission.
      expect(result.totalAmount).toBe(1000);
      expect(result.commissionAmount).toBe(100);
      expect(result.vatAmount).toBe(15);
      expect(result.netToLessor).toBe(885);
    });

    it('adds commission on top when the renter bears it', () => {
      const result = calculatePrice(100, 10, {
        ...base,
        commissionBearer: 'renter',
        vatBase: 'commission',
      });
      expect(result.totalAmount).toBe(1115);
      expect(result.netToLessor).toBe(1000);
    });

    it('charges VAT on the whole booking when vatBase is total', () => {
      const result = calculatePrice(100, 10, {
        ...base,
        commissionBearer: 'renter',
        vatBase: 'total',
      });
      expect(result.vatAmount).toBe(150);
    });

    it('keeps every amount at two decimals', () => {
      const result = calculatePrice(33.33, 3, {
        ...base,
        commissionBearer: 'lessor',
        vatBase: 'commission',
      });
      const amounts = [
        result.subtotal,
        result.commissionAmount,
        result.vatAmount,
        result.totalAmount,
        result.netToLessor,
      ];
      amounts.forEach((value) => expect(value).toBe(round2(value)));
    });

    it('never lets the split option pay out more than the gross', () => {
      const result = calculatePrice(200, 5, {
        ...base,
        commissionBearer: 'shared',
        vatBase: 'commission',
      });
      expect(result.netToLessor).toBeLessThan(result.subtotal);
      expect(result.totalAmount).toBeGreaterThan(result.subtotal);
    });
  });

  describe('daysBetweenDates', () => {
    it('counts whole days regardless of the time of day', () => {
      expect(daysBetweenDates('2026-09-01T22:00:00', '2026-09-08T02:00:00')).toBe(7);
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
