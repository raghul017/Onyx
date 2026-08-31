// =============================================================================
// Tests for object-id intelligence (T13a): id-param detection (name + type,
// positive/negative) and collection/detail pairing (matched + unmatched paths).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    detectObjectIdParam,
    isDetailEndpoint,
    collectionPathFor,
    pairEndpoints,
    type EndpointLike,
} from "../object-id.js";

const ep = (
    method: string,
    path: string,
    params: EndpointLike["parameters"] = [],
): EndpointLike => ({ method, path, parameters: params });

const pathParam = (name: string, schema: Record<string, unknown> | null = null) =>
    ({ name, in: "path" as const, schema });

describe("detectObjectIdParam", () => {
    it("detects id / *Id / *_id / uuid path names", () => {
        expect(detectObjectIdParam(ep("GET", "/users/{id}", [pathParam("id")]))?.name).toBe("id");
        expect(detectObjectIdParam(ep("GET", "/users/{userId}", [pathParam("userId")]))?.name).toBe("userId");
        expect(detectObjectIdParam(ep("GET", "/users/{user_id}", [pathParam("user_id")]))?.name).toBe("user_id");
        expect(detectObjectIdParam(ep("GET", "/things/{uuid}", [pathParam("uuid")]))?.name).toBe("uuid");
    });

    it("detects by TYPE even when the name isn't id-like (integer / uuid format)", () => {
        expect(
            detectObjectIdParam(ep("GET", "/users/{slug}", [pathParam("slug", { type: "integer" })]))?.kind,
        ).toBe("integer");
        expect(
            detectObjectIdParam(ep("GET", "/users/{ref}", [pathParam("ref", { format: "uuid" })]))?.kind,
        ).toBe("uuid");
    });

    it("returns null for non-id path params and for query-only id params", () => {
        expect(detectObjectIdParam(ep("GET", "/users/{name}", [pathParam("name", { type: "string" })]))).toBeNull();
        // an `id` in QUERY is not the classic BOLA path vector → ignored
        expect(
            detectObjectIdParam(ep("GET", "/users", [{ name: "id", in: "query", schema: null }])),
        ).toBeNull();
    });

    it("picks the LAST id path param (the leaf resource)", () => {
        const e = ep("GET", "/orgs/{orgId}/users/{userId}", [
            pathParam("orgId"),
            pathParam("userId"),
        ]);
        expect(detectObjectIdParam(e)?.name).toBe("userId");
    });

    it("classifies kind from schema (integer/uuid/string)", () => {
        expect(detectObjectIdParam(ep("GET", "/u/{id}", [pathParam("id", { type: "integer" })]))?.kind).toBe("integer");
        expect(detectObjectIdParam(ep("GET", "/u/{id}", [pathParam("id", { format: "uuid" })]))?.kind).toBe("uuid");
        expect(detectObjectIdParam(ep("GET", "/u/{id}", [pathParam("id")]))?.kind).toBe("string");
    });
});

describe("isDetailEndpoint", () => {
    it("true only for GET-by-id", () => {
        expect(isDetailEndpoint(ep("GET", "/users/{id}", [pathParam("id")]))).toBe(true);
        expect(isDetailEndpoint(ep("POST", "/users/{id}", [pathParam("id")]))).toBe(false); // not GET
        expect(isDetailEndpoint(ep("GET", "/users", []))).toBe(false); // no id param
    });
});

describe("collectionPathFor", () => {
    it("strips the trailing {id} segment", () => {
        expect(collectionPathFor("/users/{id}")).toBe("/users");
        expect(collectionPathFor("/orgs/{o}/users/{id}")).toBe("/orgs/{o}/users");
    });
    it("returns null when the path doesn't end in a placeholder", () => {
        expect(collectionPathFor("/users")).toBeNull();
        expect(collectionPathFor("/users/{id}/posts")).toBeNull();
    });
});

describe("pairEndpoints", () => {
    it("pairs a detail with its matching collection", () => {
        const endpoints = [
            ep("GET", "/users", []),
            ep("GET", "/users/{id}", [pathParam("id")]),
            ep("POST", "/users", []),
        ];
        const pairs = pairEndpoints(endpoints);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]!.detail.path).toBe("/users/{id}");
        expect(pairs[0]!.collection?.path).toBe("/users");
        expect(pairs[0]!.idParam.name).toBe("id");
    });

    it("yields a pair with collection=null when no collection endpoint exists", () => {
        const pairs = pairEndpoints([ep("GET", "/users/{id}", [pathParam("id")])]);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]!.collection).toBeNull();
    });

    it("ignores non-detail GETs and non-GET methods", () => {
        const pairs = pairEndpoints([
            ep("GET", "/health", []),
            ep("DELETE", "/users/{id}", [pathParam("id")]),
        ]);
        expect(pairs).toHaveLength(0);
    });
});
