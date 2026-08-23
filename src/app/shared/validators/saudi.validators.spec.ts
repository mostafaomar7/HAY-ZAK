import { FormControl } from '@angular/forms';
import { saudiIban, saudiMobile, saudiNationalId } from './saudi.validators';

const check = (fn: (c: FormControl) => unknown, value: unknown) => fn(new FormControl(value));

describe('saudi validators', () => {
  describe('saudiIban (FR-LSR-02)', () => {
    it('accepts a valid Saudi IBAN in any spacing', () => {
      expect(check(saudiIban, 'SA0380000000608010167519')).toBeNull();
      expect(check(saudiIban, 'SA03 8000 0000 6080 1016 7519')).toBeNull();
    });

    it('rejects the wrong length or country code', () => {
      expect(check(saudiIban, 'SA038000000060801016')).toEqual({ saudiIban: true });
      expect(check(saudiIban, 'EG380000000608010167519')).toEqual({ saudiIban: true });
    });

    it('catches a single-digit typo that the format check alone would pass', () => {
      expect(check(saudiIban, 'SA0380000000608010167518')).toEqual({ ibanChecksum: true });
    });
  });

  describe('saudiMobile', () => {
    it('accepts local and international forms', () => {
      ['0512345678', '+966512345678', '00966512345678', '0501234567'].forEach((value) =>
        expect(check(saudiMobile, value)).withContext(value).toBeNull(),
      );
    });

    it('rejects numbers that are not Saudi mobiles', () => {
      ['0412345678', '051234567', '01012345678'].forEach((value) =>
        expect(check(saudiMobile, value)).withContext(value).toEqual({ saudiMobile: true }),
      );
    });
  });

  describe('saudiNationalId', () => {
    it('accepts a National ID (1...) and an Iqama (2...)', () => {
      expect(check(saudiNationalId, '1012345678')).toBeNull();
      expect(check(saudiNationalId, '2012345678')).toBeNull();
    });

    it('rejects a wrong prefix or length', () => {
      expect(check(saudiNationalId, '3012345678')).toEqual({ saudiNationalId: true });
      expect(check(saudiNationalId, '101234567')).toEqual({ saudiNationalId: true });
    });
  });
});
