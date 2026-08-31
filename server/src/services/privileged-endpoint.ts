// =============================================================================
// Privileged-endpoint heuristic (T14a) — decide whether an endpoint looks like a
// privileged / administrative function that a lower-privileged user should NOT
// be able to call. Pure + conservative: a false positive here costs a wasted
// probe, but a WRONG "privileged" label on a public endpoint would produce a
// bogus BFLA finding, so the bar is deliberately high and the list documented.
//
// Signals (ANY one is sufficient):
//   1. An administrative PATH SEGMENT — /admin, /administrator, /internal,
//      /manage(ment), /config(uration), /settings, /roles, /permissions,
//      /privileges, /audit, /sudo, /root, /superuser, /impersonate, /backup,
//      /system. Matched per-SEGMENT so /badminton or /configurator can't match.
//   2. A WRITE method on a user/account-administration collection —
//      POST/PUT/PATCH/DELETE on /users, /accounts, /members, /tenants, /orgs…
//      (reading /users is common and public-ish; MUTATING them is not).
//   3. A DELETE on any admin-ish path (already covered by 1, kept explicit).
//   4. An operationId that names an administrative action (deleteUser,
//      promoteUser, grantRole, impersonate…).
//
// NOT a signal: plain GET on ordinary resources (/products, /orders, /health).
//
// NOTE: the spec's declared OAuth2 SCOPES would be the strongest signal, but the
// parser's AuthRequirement doesn't currently carry scopes (only scheme/type/in/
// name), so scope-based detection is deferred — see the ticket summary.
// =============================================================================

/** Path segments that mark an administrative area. Matched whole-segment. */
export const ADMIN_PATH_SEGMENTS = [
    "admin",
    "administrator",
    "administration",
    "internal",
    "manage",
    "management",
    "config",
    "configuration",
    "settings",
    "roles",
    "permissions",
    "privileges",
    "audit",
    "audit-log",
    "audit-logs",
    "sudo",
    "root",
    "superuser",
    "impersonate",
    "backup",
    "backups",
    "system",
] as const;

/** Collections whose MUTATION is an administrative act (reads are not). */
export const ADMIN_WRITE_COLLECTIONS = [
    "users",
    "user",
    "accounts",
    "account",
    "members",
    "membership",
    "memberships",
    "tenants",
    "tenant",
    "orgs",
    "organizations",
    "organisation",
    "organizations",
    "groups",
    "teams",
] as const;

/** Verbs in an operationId that denote an administrative action. */
const ADMIN_OPERATION = /(^|[^a-z])(delete|remove|purge|promote|demote|grant|revoke|impersonate|suspend|ban|disable|enable|reset|elevate|assume)[A-Z_]?/i;

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Destructive methods escalate a confirmed BFLA to CRITICAL. */
export const DESTRUCTIVE_METHODS = new Set(["DELETE"]);

/** Split a path into lowercase segments, ignoring {placeholders} and blanks. */
function segmentsOf(path: string): string[] {
    return path
        .split("/")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && !s.startsWith("{"));
}

export interface PrivilegedEndpointInput {
    method: string;
    path: string;
    operationId?: string | undefined;
}

export interface PrivilegedVerdict {
    privileged: boolean;
    /** Short, human reason — surfaced in the finding's evidence. */
    reason: string | null;
}

/**
 * Decide whether this endpoint is a privileged/administrative function.
 * Conservative: a plain GET on a non-admin path is never privileged.
 */
export function classifyPrivilegedEndpoint(
    input: PrivilegedEndpointInput,
): PrivilegedVerdict {
    const method = (input.method || "").toUpperCase();
    const segs = segmentsOf(input.path || "");

    // 1) Administrative path segment (whole-segment match).
    const adminSeg = segs.find((s) =>
        (ADMIN_PATH_SEGMENTS as readonly string[]).includes(s),
    );
    if (adminSeg) {
        return { privileged: true, reason: `administrative path segment "/${adminSeg}"` };
    }

    // 2) A WRITE on a user/account-administration collection.
    if (WRITE_METHODS.has(method)) {
        const adminColl = segs.find((s) =>
            (ADMIN_WRITE_COLLECTIONS as readonly string[]).includes(s),
        );
        if (adminColl) {
            return {
                privileged: true,
                reason: `${method} on the account-administration collection "/${adminColl}"`,
            };
        }
    }

    // 3) An operationId naming an administrative action.
    if (input.operationId && ADMIN_OPERATION.test(input.operationId)) {
        return {
            privileged: true,
            reason: `operationId "${input.operationId}" names an administrative action`,
        };
    }

    return { privileged: false, reason: null };
}

/** Convenience predicate. */
export function isPrivilegedEndpoint(input: PrivilegedEndpointInput): boolean {
    return classifyPrivilegedEndpoint(input).privileged;
}
