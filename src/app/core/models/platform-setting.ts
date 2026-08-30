import { Permission } from '../constants/permissions';

/**
 * The platform's settings (FR-ADM-06).
 *
 * Two things about this endpoint shape every screen that touches it.
 *
 * **The value is always a string on the wire**, whatever the setting actually
 * is. `"1500"`, never `1500`; `"true"`, never `true`. The server parses it
 * against `dataType` and refuses with a 422 if it will not convert, so the
 * client's job is to render the right kind of input and send the text back —
 * not to decide the type.
 *
 * **The permission depends on the group, not on the screen.** A row in the
 * `financial` group needs `settings:financial`, which the finance officer
 * holds and the system administrator also holds; every other group needs
 * `settings:manage`, which only the system administrator holds. Neither is a
 * superset of the other, so the answer cannot be worked out from the URL or
 * from who is looking — it has to be read off each row.
 */

export type SettingGroup = 'general' | 'financial' | 'booking' | 'operations' | 'content';

export type SettingDataType = 'string' | 'number' | 'boolean' | 'json';

export interface PlatformSetting {
  key: string;
  /** Always a string here, and sent back as one. */
  value: string;
  dataType: SettingDataType;
  group: SettingGroup;
  labelAr: string;
  labelEn: string;
  /** What changing it actually does. Worth showing — it is written for this. */
  hintAr: string | null;
  hintEn: string | null;
  /** False means read-only; writing anyway is a 409. */
  isEditable: boolean;
  /** Also served, converted, from `/public/settings`. */
  isPublic: boolean;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WirePlatformSetting {
  key: string;
  value: string | number | boolean | null;
  dataType: SettingDataType;
  group: SettingGroup;
  labelAr: string;
  labelEn: string;
  hintAr?: string | null;
  hintEn?: string | null;
  isEditable?: boolean;
  isPublic?: boolean;
}

/** `PUT /admin/settings/:key`. */
export interface UpdateSettingRequest {
  value: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function settingFromWire(wire: WirePlatformSetting): PlatformSetting {
  return {
    key: wire.key,
    // Coerced rather than trusted: the contract says string, and a server that
    // one day sends a number would otherwise put `1500` into an input bound to
    // a string and send `[object Object]` back for a json setting.
    value: wire.value === null || wire.value === undefined ? '' : String(wire.value),
    dataType: wire.dataType,
    group: wire.group,
    labelAr: wire.labelAr,
    labelEn: wire.labelEn,
    hintAr: wire.hintAr ?? null,
    hintEn: wire.hintEn ?? null,
    // Defaults to read-only when the flag is missing. Under-granting is the
    // safe direction: an editable field that turns out not to be answers 409
    // after somebody has typed, which reads as the platform being broken.
    isEditable: wire.isEditable ?? false,
    isPublic: wire.isPublic ?? false,
  };
}

/**
 * Which permission writing this particular row needs.
 *
 * Read from the row rather than from the tab, because a screen grouping them
 * differently — or a new group arriving from the server — must not change the
 * answer. The server refuses either way; this only decides whether to offer an
 * editable field or a read-only one.
 */
export function settingWritePermission(setting: PlatformSetting): Permission {
  return setting.group === 'financial'
    ? Permission.SetFinancialSettings
    : Permission.ManageSettings;
}
