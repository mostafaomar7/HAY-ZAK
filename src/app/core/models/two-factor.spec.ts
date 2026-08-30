import { isTwoFactorChallenge, twoFactorStatusFromWire } from './two-factor';

/**
 * The guard is the security-relevant part of this file.
 *
 * A login that answers with a challenge carries no `tokens`, so a caller that
 * tested for their presence instead would read `undefined`, take the
 * signed-in branch, and navigate somebody into the application without a
 * session — failing silently, which is the worst way for an authentication
 * check to fail.
 */
describe('two-factor', () => {
  describe('isTwoFactorChallenge', () => {
    it('recognises the challenge', () => {
      expect(isTwoFactorChallenge({ twoFactorRequired: true, challengeToken: 'x' })).toBeTrue();
    });

    it('rejects a session, which is the case that must not be confused', () => {
      expect(
        isTwoFactorChallenge({ user: { id: 'u-1' }, tokens: { accessToken: 'a' } }),
      ).toBeFalse();
    });

    it('rejects anything else without throwing', () => {
      expect(isTwoFactorChallenge(null)).toBeFalse();
      expect(isTwoFactorChallenge(undefined)).toBeFalse();
      expect(isTwoFactorChallenge({})).toBeFalse();
      // Truthy but not `true`: the flag is read strictly, so a server that
      // started sending a string could not quietly turn the check off.
      expect(isTwoFactorChallenge({ twoFactorRequired: 'yes' })).toBeFalse();
    });
  });

  describe('twoFactorStatusFromWire', () => {
    it('defaults every optional field rather than letting undefined reach a template', () => {
      const status = twoFactorStatusFromWire({ enabled: false });

      expect(status.enabledAt).toBeNull();
      expect(status.setupPending).toBeFalse();
      expect(status.recoveryCodesRemaining).toBe(0);
      expect(status.required).toBeFalse();
    });

    it('carries the real values through', () => {
      const status = twoFactorStatusFromWire({
        enabled: true,
        enabledAt: '2026-08-30T10:00:00Z',
        setupPending: false,
        recoveryCodesRemaining: 8,
        required: true,
      });

      expect(status.enabled).toBeTrue();
      expect(status.recoveryCodesRemaining).toBe(8);
      // Required means the console is closed until enrolment, which is a
      // different screen from "not allowed".
      expect(status.required).toBeTrue();
    });
  });
});
