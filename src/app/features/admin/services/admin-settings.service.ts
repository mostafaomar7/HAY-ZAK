import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  PlatformSetting,
  SettingGroup,
  UpdateSettingRequest,
  WirePlatformSetting,
} from '@core/models/platform-setting';
import { settingFromWire } from '@core/models/platform-setting';
import { ApiService } from '@core/services/api.service';

interface WireSettingsResponse {
  settings?: WirePlatformSetting[] | null;
}

interface WireSettingResponse {
  setting: WirePlatformSetting;
}

/**
 * Reading and writing the platform's settings (FR-ADM-06).
 *
 * **Reading is open to any administrator; writing is not.** A `financial` row
 * needs `settings:financial` and every other row needs `settings:manage`, and
 * neither permission contains the other — so the finance officer opens the
 * page, sees everything, and can only change the financial half. The rule is
 * per row (`settingWritePermission`), not per screen, because the group is on
 * the data and a tab is only a way of arranging it.
 *
 * The value goes back as a **string**, always. The server owns the parsing and
 * answers 422 when a value will not convert; a client that sent `1500` for one
 * setting and `"1500"` for another would be guessing at a contract that is not
 * ambiguous.
 */
@Injectable()
export class AdminSettingsService {
  private readonly api = inject(ApiService);

  list(group?: SettingGroup): Observable<PlatformSetting[]> {
    return this.api
      .get<WireSettingsResponse>(API_ENDPOINTS.admin.settings, { params: { group } })
      .pipe(map((response) => (response.settings ?? []).map(settingFromWire)));
  }

  /**
   * Writes one.
   *
   * Takes the value already as text. Callers hold what is in the input, and
   * converting a number to a string here would mean converting it back on the
   * way in — two conversions to end up where the field started.
   */
  update(key: string, value: string): Observable<PlatformSetting> {
    return this.api
      .put<WireSettingResponse, UpdateSettingRequest>(API_ENDPOINTS.admin.settingByKey(key), {
        value,
      })
      .pipe(map((response) => settingFromWire(response.setting)));
  }
}
