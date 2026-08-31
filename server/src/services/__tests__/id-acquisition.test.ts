// =============================================================================
// Tests for ID acquisition (T13a): pure JSON id extraction (incl. arrays +
// envelopes), spec-example fallback, and the acquire orchestration order
// (collection → example → unresolved). The collection fetch is injected.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import {
    extractIdFromJson,
    exampleIdFromParam,
    acquireIdForPair,
} from "../id-acquisition.js";
import type { EndpointPair } from "../object-id.js";

describe("extractIdFromJson", () => {
    it("extracts id from a bare array of objects", () => {
        expect(extractIdFromJson([{ id: "abc" }, { id: "def" }])).toBe("abc");
    });
    it("extracts from {data:[...]} / {items:[...]} / {results:[...]} envelopes", () => {
        expect(extractIdFromJson({ data: [{ id: "x1" }] })).toBe("x1");
        expect(extractIdFromJson({ items: [{ _id: "x2" }] })).toBe("x2");
        expect(extractIdFromJson({ results: [{ uuid: "x3" }] })).toBe("x3");
    });
    it("stringifies numeric ids", () => {
        expect(extractIdFromJson([{ id: 42 }])).toBe("42");
    });
    it("reads id off a single object", () => {
        expect(extractIdFromJson({ id: "solo" })).toBe("solo");
    });
    it("returns null when no id field is present or the list is empty", () => {
        expect(extractIdFromJson([])).toBeNull();
        expect(extractIdFromJson([{ name: "no-id" }])).toBeNull();
        expect(extractIdFromJson("not json-ish")).toBeNull();
    });
});

describe("exampleIdFromParam", () => {
    const idParam = { name: "id", kind: "string" as const };
    it("reads example / default / first enum", () => {
        expect(exampleIdFromParam(idParam, { example: "ex1" })).toBe("ex1");
        expect(exampleIdFromParam(idParam, { default: 7 })).toBe("7");
        expect(exampleIdFromParam(idParam, { enum: ["e1", "e2"] })).toBe("e1");
    });
    it("returns null with no usable value", () => {
        expect(exampleIdFromParam(idParam, {})).toBeNull();
        expect(exampleIdFromParam(idParam, null)).toBeNull();
    });
});

// Helper to build a minimal pair.
const makePair = (opts: {
    collection?: boolean;
    idExample?: unknown;
}): EndpointPair => ({
    detail: {
        method: "GET",
        path: "/users/{id}",
        parameters: [
            {
                name: "id",
                in: "path",
                schema: opts.idExample !== undefined ? { example: opts.idExample } : null,
            },
        ],
    },
    idParam: { name: "id", kind: "string" },
    collection: opts.collection
        ? { method: "GET", path: "/users", parameters: [] }
        : null,
});

describe("acquireIdForPair", () => {
    it("acquires an id from the collection response (as identity A)", async () => {
        const fetchCollection = vi.fn().mockResolvedValue({ json: [{ id: "from-coll" }], statusCode: 200 });
        const got = await acquireIdForPair(makePair({ collection: true }), fetchCollection);
        expect(got).toEqual({ objectId: "from-coll", source: "collection" });
        expect(fetchCollection).toHaveBeenCalledTimes(1);
    });

    it("falls back to the spec example when the collection list is empty", async () => {
        const fetchCollection = vi.fn().mockResolvedValue({ json: [], statusCode: 200 });
        const got = await acquireIdForPair(makePair({ collection: true, idExample: "ex-id" }), fetchCollection);
        expect(got).toEqual({ objectId: "ex-id", source: "example" });
    });

    it("uses the example when there's no collection endpoint at all", async () => {
        const fetchCollection = vi.fn();
        const got = await acquireIdForPair(makePair({ collection: false, idExample: 99 }), fetchCollection);
        expect(got).toEqual({ objectId: "99", source: "example" });
        expect(fetchCollection).not.toHaveBeenCalled();
    });

    it("returns null (unresolved) when collection is empty AND no example", async () => {
        const fetchCollection = vi.fn().mockResolvedValue({ json: [], statusCode: 200 });
        expect(await acquireIdForPair(makePair({ collection: true }), fetchCollection)).toBeNull();
    });

    it("falls back to example when the collection fetch errors/non-2xx", async () => {
        const fetchCollection = vi.fn().mockResolvedValue({ json: null, statusCode: 500 });
        const got = await acquireIdForPair(makePair({ collection: true, idExample: "ex" }), fetchCollection);
        expect(got).toEqual({ objectId: "ex", source: "example" });
    });
});
