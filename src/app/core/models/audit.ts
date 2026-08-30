import type { AdminRole } from '../enums/user-role.enum';

/**
 * The audit trail (FR-ADM-09) — `audit:view`, the system administrator's alone.
 *
 * Narrow on purpose: this records what every administrator did, including
 * whoever is reading it, so it is not something an operations supervisor or a
 * finance officer should be able to open.
 *
 * The pair that makes it worth having is `oldValue` → `newValue`. "Somebody
 * changed the commission" is a rumour; "this person changed it from 15% to 5%
 * at 14:12" is a record. Any screen that shows one without the other has
 * thrown away the point of the log.
 *
 * There is no bulk export, deliberately, and nothing here should add one
 * without asking first.
 */

// ── Domain ────────────────────────────────────────────────────────────────

/**
 * Who did it — **or nobody**.
 *
 * `null` where a background job acted, or where the account has since been
 * removed. Every screen has to have an answer for that; "—" is one, a crash is
 * not, and inventing a name is worse than either.
 */
export interface AuditActor {
  id: string;
  fullName: string;
  adminRole: AdminRole | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /**
   * The change, as **objects** — `{ status: 'OPEN' }` → `{ status: 'RESOLVED',
   * resolution: 'NO_ACTION', … }`. Not pre-rendered text.
   *
   * Rendered here rather than printed: `{{ oldValue }}` on an object is
   * `[object Object]`, which is the failure mode this field is most likely to
   * meet, and the pair is the whole value of the log.
   */
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  actor: AuditActor | null;
  /** `ADMIN`, `SYSTEM`, and so on — what kind of thing acted. */
  actorType: string | null;
  ipAddress: string | null;
  /** Ties a row to a request in the server logs. */
  requestId: string | null;
  createdAt: string;
}

/** `from` and `to` are plain dates, and `to` covers its whole day. */
export interface AuditQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  /** `YYYY-MM-DD`. */
  from?: string;
  /** `YYYY-MM-DD`, inclusive. */
  to?: string;
  page?: number;
}

// ── Wire ──────────────────────────────────────────────────────────────────

export interface WireAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  actor?: { id: string; fullName: string; adminRole?: AdminRole | null } | null;
  actorType?: string | null;
  ipAddress?: string | null;
  requestId?: string | null;
  createdAt: string;
}

/**
 * `GET /admin/audit/actions` — what is actually present, for the filter.
 *
 * Each entry pairs the action with the kind of thing it happened to, because
 * the same verb applies to more than one entity.
 */
export interface AuditAction {
  action: string;
  entityType: string;
}

export interface WireAuditActions {
  actions?: AuditAction[] | null;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export function auditEntryFromWire(wire: WireAuditEntry): AuditEntry {
  return {
    id: wire.id,
    action: wire.action,
    entityType: wire.entityType,
    entityId: wire.entityId ?? null,
    oldValue: wire.oldValue ?? null,
    newValue: wire.newValue ?? null,
    actor: wire.actor
      ? {
          id: wire.actor.id,
          fullName: wire.actor.fullName,
          adminRole: wire.actor.adminRole ?? null,
        }
      : null,
    actorType: wire.actorType ?? null,
    ipAddress: wire.ipAddress ?? null,
    requestId: wire.requestId ?? null,
    createdAt: wire.createdAt,
  };
}

/**
 * One change as `field: value` lines, in the order the server wrote them.
 *
 * A single line of JSON is unreadable in a table cell and `[object Object]` is
 * worse; a null or an empty object reads as "nothing recorded" rather than as
 * an empty row.
 */
export function describeAuditValue(value: Record<string, unknown> | null): string[] {
  if (!value) return [];
  return Object.entries(value).map(([key, raw]) => `${key}: ${formatAuditValue(raw)}`);
}

function formatAuditValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '—';
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}
