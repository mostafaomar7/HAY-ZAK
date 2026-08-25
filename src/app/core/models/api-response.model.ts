/**
 * The backend's response envelope. Identical on every endpoint, and fixed —
 * see the API conventions agreed with the backend.
 *
 * Nothing outside `ApiService` and the interceptors should need these types:
 * the wrapper unwraps `data` and throws `ApiError`, so a caller receives `T` or
 * an error and never sees the envelope at all.
 */

/**
 * A page of a list, exactly as the server reports it.
 *
 * It lives inside `data`, beside `items` — not under `meta` — and the size
 * field is `pageSize`. `limit` is not a synonym: the server answers 422 for it,
 * which is the right answer, because a query parameter that is quietly ignored
 * is a page that looks like it worked while returning the wrong rows.
 *
 * **Read `hasNextPage`, never derive it.** `page < totalPages` and
 * `items.length === pageSize` both look equivalent and are not: the second
 * scrolls forever on a set that divides exactly by the page size. The server
 * computes it in one place; a second rule here would be a second rule to keep
 * right, and only one of them would ever be tested.
 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** A list response's `data`. */
export interface ListPayload<T> {
  items: T[];
  pagination?: Pagination;
}

export interface ResponseMeta {
  pagination?: Pagination;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/** One invalid field on a 422. `field` matches the form control's name. */
export interface FieldError {
  field: string;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: {
    /** Stable machine identifier — branch on this, never on `message`. */
    code: string;
    /** Already translated by the server. Display as-is. */
    message: string;
    details?: FieldError[];
    /** Optional extra facts — see `ApiError.meta`. Always read defensively. */
    meta?: Record<string, unknown>;
  };
  /** Support quotes this back to find the exact request in the server log. */
  requestId: string;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** A list and its pagination as one value, so a caller holds one object. */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

/** Query parameters every list endpoint accepts. Page size defaults to 12. */
export interface PaginationParams {
  page?: number;
  /** `pageSize` on the wire — `limit` is silently ignored by the server. */
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/** Stands in when a list response arrives with no pagination of its own. */
export function emptyPagination(pageSize = 12): Pagination {
  return { page: 1, pageSize, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false };
}
