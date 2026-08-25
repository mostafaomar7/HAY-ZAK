import type { HttpContext } from '@angular/common/http';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ERROR_CODES } from '../models/api-error.model';
import type { ApiEnvelope, ListPayload, PaginatedResponse } from '../models/api-response.model';
import { emptyPagination } from '../models/api-response.model';

type ParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, ParamValue | ParamValue[]>;

interface RequestOptions {
  params?: QueryParams;
  context?: HttpContext;
  headers?: Record<string, string>;
}

/**
 * The only place in the application that speaks HTTP.
 *
 * Every response carries the same envelope, so unwrapping it belongs in one
 * method rather than in every caller: `get<Unit>(…)` yields a `Unit`, and a
 * failure arrives as an `ApiError` carrying the server's code and its already
 * translated message. No component calls `fetch` or `HttpClient` directly.
 *
 * `list()` is separate from `get()` because a list response is two halves —
 * the rows in `data`, the counts in `meta.pagination` — and a caller should
 * receive them joined rather than have to reach into the envelope for one.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), this.build(options))
      .pipe(map((envelope) => unwrap(envelope)));
  }

  /**
   * A paged list.
   *
   * The rows and the counts both arrive inside `data` — `{ items, pagination }`
   * — and some collections (the reference lists) send `items` with no
   * pagination at all. Both are normalised here so a caller always receives the
   * same pair.
   */
  list<T>(path: string, options: RequestOptions = {}): Observable<PaginatedResponse<T>> {
    return this.http
      .get<ApiEnvelope<ListPayload<T>>>(this.url(path), this.build(options))
      .pipe(
        map((envelope) => unwrapPage(envelope, Number(options.params?.['pageSize']) || undefined)),
      );
  }

  post<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body ?? {}, this.build(options))
      .pipe(map((envelope) => unwrap(envelope)));
  }

  put<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(this.url(path), body ?? {}, this.build(options))
      .pipe(map((envelope) => unwrap(envelope)));
  }

  patch<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(this.url(path), body ?? {}, this.build(options))
      .pipe(map((envelope) => unwrap(envelope)));
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path), this.build(options))
      .pipe(map((envelope) => unwrap(envelope)));
  }

  /**
   * Multipart upload. Never set Content-Type by hand — the browser has to add
   * the boundary, and a manual header omits it.
   */
  upload<T>(path: string, formData: FormData): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), formData)
      .pipe(map((envelope) => unwrap(envelope)));
  }

  download(path: string, options: RequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), { ...this.build(options), responseType: 'blob' });
  }

  private url(path: string): string {
    return path.startsWith('http') ? path : `${environment.apiUrl}/${path.replace(/^\//, '')}`;
  }

  private build(options: RequestOptions) {
    return {
      params: this.toHttpParams(options.params),
      context: options.context,
      headers: options.headers,
    };
  }

  /** Drops null/undefined/'' so the query string stays clean, expands arrays. */
  private toHttpParams(source?: QueryParams): HttpParams {
    let params = new HttpParams();
    if (!source) return params;

    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && item !== undefined && item !== '') {
            params = params.append(key, String(item));
          }
        }
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}

/**
 * A 2xx carrying `success: false` should not happen, but a caller that trusted
 * `data` on one would read `undefined` as a value and fail somewhere far away
 * from the cause. Throwing here keeps the failure next to its reason.
 */
function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (envelope?.success === false) {
    throw new ApiError({
      code: envelope.error?.code ?? ERROR_CODES.MALFORMED,
      message: envelope.error?.message ?? '',
      status: 200,
      details: envelope.error?.details,
      requestId: envelope.requestId,
    });
  }

  return envelope?.data as T;
}

function unwrapPage<T>(
  envelope: ApiEnvelope<ListPayload<T>>,
  pageSize?: number,
): PaginatedResponse<T> {
  const payload = unwrap(envelope);

  // A bare array is tolerated: an endpoint that returns one is still a list,
  // and failing on the shape would be failing on something that works.
  const items = Array.isArray(payload) ? payload : (payload?.items ?? []);
  const pagination = Array.isArray(payload) ? undefined : payload?.pagination;

  return {
    items,
    pagination: pagination ?? { ...emptyPagination(pageSize), total: items.length, totalPages: 1 },
  };
}
