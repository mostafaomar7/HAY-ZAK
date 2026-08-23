import type { HttpContext } from '@angular/common/http';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api-response.model';

type ParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, ParamValue | ParamValue[]>;

interface RequestOptions {
  params?: QueryParams;
  context?: HttpContext;
  headers?: Record<string, string>;
}

/**
 * Single entry point for backend calls: prefixes the base url, builds params
 * safely, and unwraps the `ApiResponse` envelope so callers get `T` directly.
 * If the backend returns bare payloads, use the `*Raw` methods instead.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.getRaw<ApiResponse<T>>(path, options).pipe(map((r) => r.data));
  }

  post<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.postRaw<ApiResponse<T>, B>(path, body, options).pipe(map((r) => r.data));
  }

  put<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(path), body ?? {}, this.build(options))
      .pipe(map((r) => r.data));
  }

  patch<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(this.url(path), body ?? {}, this.build(options))
      .pipe(map((r) => r.data));
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(this.url(path), this.build(options))
      .pipe(map((r) => r.data));
  }

  getRaw<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.url(path), this.build(options));
  }

  postRaw<T, B = unknown>(path: string, body?: B, options: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? {}, this.build(options));
  }

  /** Multipart upload — never set Content-Type manually, the browser adds the boundary. */
  upload<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(path), formData).pipe(map((r) => r.data));
  }

  download(path: string, options: RequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), {
      ...this.build(options),
      responseType: 'blob',
    });
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
