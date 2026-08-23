export const STORAGE_KEYS = {
  accessToken: 'hayzaq.access_token',
  refreshToken: 'hayzaq.refresh_token',
  user: 'hayzaq.user',
  language: 'hayzaq.lang',
  theme: 'hayzaq.theme',
  /**
   * The in-progress booking (unit, dates, goods, acknowledgement).
   *
   * Session storage, not local: a half-finished booking is tied to the tab the
   * renter is working in, and the design's "register mid-journey" flow only has
   * to survive a redirect, not a browser restart.
   */
  bookingDraft: 'hayzaq.booking_draft',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
