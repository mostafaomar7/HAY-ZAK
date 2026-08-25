/**
 * The backend's response envelope. Identical on every endpoint, and fixed —
 * see the API conventions agreed with the backend.
 *
 * Nothing outside `ApiService` and the interceptors should need these types:
 * the wrapper unwraps `data` and throws `ApiError`, so a caller receives `T` or
 * an error and never sees the envelope at all.
 */

/**
 * A page of a list, as the running server reports it.
 *
 * It lives inside `data`, beside `items` — **not** under `meta.pagination`, and
 * the size field is `pageSize`, not `limit`. Both differ from the written
 * integration guide; these are the shapes verified against the server, and the
 * discrepancy is logged in `docs/api/backend-notes.md`.
 *
 * There is no `hasNextPage`, so it is derived below rather than read.
 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** The server sends no `hasNextPage`; `page < totalPages` is the same fact. */
export function hasNextPage(pagination: Pagination): boolean {
  return pagination.page < pagination.totalPages;
}

export function hasPrevPage(pagination: Pagination): boolean {
  return pagination.page > 1;
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

/**
 * A list and its pagination as one value.
 *
 * The wire format splits them — the rows are `data`, the counts are
 * `meta.pagination` — and rejoining them here means a caller holds one object
 * rather than two halves it has to keep together.
 */
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

/** Stands in when a list response arrives without its `meta.pagination`. */
export function emptyPagination(pageSize = 12): Pagination {
  return { page: 1, pageSize, total: 0, totalPages: 0 };
}
