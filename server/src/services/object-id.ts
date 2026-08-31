// =============================================================================
// Object-ID intelligence (T13a) — the pure detection + pairing layer for BOLA.
//
// BOLA/IDOR lives at endpoints that expose an object BY ID: GET /users/{id}.
// This module (a) finds the object-id PATH parameter on an endpoint, and
// (b) pairs each such DETAIL endpoint with its COLLECTION endpoint (GET /users)
// so the id-acquisition step (T13a) knows where to fetch a real id from.
//
// Pure + dependency-free → fully unit-testable. It does NOT fire requests or
// emit findings; that's the acquisition/replay machinery (T13a) and verdict
// (T13b) respectively.
// =============================================================================

/** The minimal endpoint shape this module reasons about (subset of ParsedEndpoint). */
export interface EndpointLike {
    method: string; // upper-case
    path: string; // e.g. "/users/{id}"
    parameters: Array<{
        name: string;
        in: "query" | "header" | "path" | "cookie";
        schema?: Record<string, unknown> | null;
    }>;
}

/** A detected object-id path parameter on a detail endpoint. */
export interface ObjectIdParam {
    /** The path-parameter name, e.g. "id", "userId", "user_id", "uuid". */
    name: string;
    /** Best-effort type from the schema: "integer" | "uuid" | "string". */
    kind: "integer" | "uuid" | "string";
}

// A path-parameter name reads as an object id when it's exactly `id`, or ends
// in Id / _id (userId, user_id), or is `uuid`/`guid`. Case-insensitive.
const ID_NAME_RE = /^(id|uuid|guid)$|(^|_)id$|[a-z0-9]Id$/i;

function isIdName(name: string): boolean {
    return ID_NAME_RE.test(name);
}

/** Classify a param schema into a coarse id kind (defaults to string-id). */
function idKind(schema?: Record<string, unknown> | null): ObjectIdParam["kind"] {
    const type = schema?.type;
    const format = schema?.format;
    if (type === "integer" || type === "number") return "integer";
    if (format === "uuid") return "uuid";
    return "string";
}

/**
 * Detect the object-id PATH parameter for an endpoint, or null. Path params are
 * the classic BOLA vector, so we only consider `in: "path"`. When several path
 * params look like ids, the LAST one in the path wins (it identifies the leaf
 * resource, e.g. /users/{userId}/posts/{postId} → postId).
 */
export function detectObjectIdParam(endpoint: EndpointLike): ObjectIdParam | null {
    const pathParams = endpoint.parameters.filter((p) => p.in === "path");
    if (pathParams.length === 0) return null;

    // Order path params by their position in the path so "last in path" is meaningful.
    const order = new Map<string, number>();
    let i = 0;
    for (const m of endpoint.path.matchAll(/\{([^}]+)\}/g)) {
        order.set(m[1]!.trim(), i++);
    }

    const candidates = pathParams
        .filter((p) => isIdName(p.name) || isIdTyped(p.schema))
        .sort((a, b) => (order.get(b.name) ?? -1) - (order.get(a.name) ?? -1));

    const chosen = candidates[0];
    return chosen ? { name: chosen.name, kind: idKind(chosen.schema) } : null;
}

/** A path param can also qualify by TYPE alone (integer or uuid-format string). */
function isIdTyped(schema?: Record<string, unknown> | null): boolean {
    return schema?.type === "integer" || schema?.format === "uuid";
}

/** True when a GET endpoint exposes a single object by id (a BOLA detail target). */
export function isDetailEndpoint(endpoint: EndpointLike): boolean {
    return endpoint.method === "GET" && detectObjectIdParam(endpoint) !== null;
}

/**
 * The collection path for a detail path = the detail path with its trailing
 * id path-segment removed. "/users/{id}" → "/users"; "/orgs/{o}/users/{id}"
 * → "/orgs/{o}/users". Returns null if the path doesn't end in a placeholder.
 */
export function collectionPathFor(detailPath: string): string | null {
    const segments = detailPath.split("/");
    const last = segments[segments.length - 1] ?? "";
    if (!/^\{[^}]+\}$/.test(last)) return null; // detail path must end in {id}
    const trimmed = segments.slice(0, -1).join("/");
    return trimmed === "" ? "/" : trimmed;
}

/** A detail endpoint paired with the collection endpoint that lists its objects. */
export interface EndpointPair<E extends EndpointLike = EndpointLike> {
    detail: E;
    idParam: ObjectIdParam;
    /** GET on the collection path, when one exists in the spec. */
    collection: E | null;
}

/**
 * Pair every GET-by-id DETAIL endpoint with its GET COLLECTION endpoint (if the
 * spec has one). A detail with no matching collection still yields a pair with
 * `collection: null` — acquisition then falls back to the spec's example id.
 */
export function pairEndpoints<E extends EndpointLike>(endpoints: E[]): Array<EndpointPair<E>> {
    // Index GET endpoints by path for O(1) collection lookup.
    const getByPath = new Map<string, E>();
    for (const ep of endpoints) {
        if (ep.method === "GET") getByPath.set(ep.path, ep);
    }

    const pairs: Array<EndpointPair<E>> = [];
    for (const ep of endpoints) {
        if (ep.method !== "GET") continue;
        const idParam = detectObjectIdParam(ep);
        if (!idParam) continue;
        const collPath = collectionPathFor(ep.path);
        const collection = collPath ? (getByPath.get(collPath) ?? null) : null;
        pairs.push({ detail: ep, idParam, collection });
    }
    return pairs;
}
