// =============================================================================
// ID acquisition (T13a) — as identity A, obtain a real object id that belongs to
// A, so identity B can later replay the detail request against it (BOLA).
//
// Strategy, in order:
//   1. If the pair has a COLLECTION endpoint, fire GET (as A) and extract an id
//      from the JSON (fields id/_id/uuid/guid, including inside arrays).
//   2. Else / if empty, fall back to the detail endpoint's SPEC example/enum id
//      value for the id param.
//   3. Else the pair is UNRESOLVED → skipped (no replay enqueued).
//
// The HTTP fire + credential resolution are INJECTED so this module is DB-free
// and unit-testable, and so it reuses the SSRF-guarded fetch, timeout, and T3
// redaction of the real request path. Acquired ids are cached per run+pair.
// =============================================================================

import type { EndpointPair, ObjectIdParam } from "./object-id.js";

// ---------------------------------------------------------------------------
// Pure extraction
// ---------------------------------------------------------------------------

const ID_FIELDS = ["id", "_id", "uuid", "guid"];

/**
 * Extract the FIRST plausible object id from a parsed JSON collection response.
 * Handles: a bare array of objects, `{ data: [...] }`/`{ items: [...] }`/
 * `{ results: [...] }` envelopes, and a single object. Returns a string id (or
 * null). Numbers are stringified so they slot into a path segment.
 */
export function extractIdFromJson(body: unknown): string | null {
    const arr = toObjectArray(body);
    for (const el of arr) {
        const id = idOf(el);
        if (id != null) return id;
    }
    return null;
}

/** Coerce a JSON value into an array of candidate objects to scan. */
function toObjectArray(body: unknown): unknown[] {
    if (Array.isArray(body)) return body;
    if (body && typeof body === "object") {
        const obj = body as Record<string, unknown>;
        // Common list envelopes.
        for (const key of ["data", "items", "results", "records"]) {
            if (Array.isArray(obj[key])) return obj[key] as unknown[];
        }
        // A single detail object also counts.
        return [obj];
    }
    return [];
}

/** Read an id field off one object, as a string, or null. */
function idOf(el: unknown): string | null {
    if (!el || typeof el !== "object") return null;
    const obj = el as Record<string, unknown>;
    for (const f of ID_FIELDS) {
        const v = obj[f];
        if (typeof v === "string" && v.length > 0) return v;
        if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return null;
}

/**
 * Pull an example id straight from the detail endpoint's id-param schema:
 * `example`, `default`, or the first `enum` value. Stringified. Null if none.
 */
export function exampleIdFromParam(
    idParam: ObjectIdParam,
    schema?: Record<string, unknown> | null,
): string | null {
    if (!schema) return null;
    const candidates = [schema.example, schema.default];
    if (Array.isArray(schema.enum) && schema.enum.length > 0) candidates.push(schema.enum[0]);
    for (const c of candidates) {
        if (typeof c === "string" && c.length > 0) return c;
        if (typeof c === "number" && Number.isFinite(c)) return String(c);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Acquisition orchestration (injected IO)
// ---------------------------------------------------------------------------

/** Result of one collection fetch (already parsed + safe — no raw secrets). */
export interface CollectionFetchResult {
    /** Parsed JSON body, or null if the response wasn't usable JSON. */
    json: unknown | null;
    statusCode: number;
}

/** Fires GET on the collection endpoint AS identity A. Injected (SSRF/timeout live here). */
export type CollectionFetcher = (
    collection: NonNullable<EndpointPair["collection"]>,
) => Promise<CollectionFetchResult>;

export interface AcquiredId {
    objectId: string;
    /** Where it came from — useful for T13b context + debugging. */
    source: "collection" | "example";
}

/**
 * Acquire an object id for ONE pair as identity A. Tries the collection endpoint
 * first (if any), then the spec example. Returns null when unresolved (the pair
 * is then skipped — no replay is enqueued for it).
 */
export async function acquireIdForPair(
    pair: EndpointPair,
    fetchCollection: CollectionFetcher,
): Promise<AcquiredId | null> {
    if (pair.collection) {
        try {
            const res = await fetchCollection(pair.collection);
            if (res.statusCode >= 200 && res.statusCode < 300 && res.json != null) {
                const id = extractIdFromJson(res.json);
                if (id != null) return { objectId: id, source: "collection" };
            }
        } catch {
            // Collection fetch failed (SSRF block / non-JSON / network) → fall through.
        }
    }

    // Fallback: the detail endpoint's example/default/enum id.
    const detailIdSchema = pair.detail.parameters.find(
        (p) => p.in === "path" && p.name === pair.idParam.name,
    )?.schema;
    const example = exampleIdFromParam(pair.idParam, detailIdSchema);
    if (example != null) return { objectId: example, source: "example" };

    return null; // unresolved → skip
}
