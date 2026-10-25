// =============================================================================
// Regression: no request Onyx sends may carry a literal {placeholder}. A live
// scan once got "The value '{id}' is not valid." back from a target, i.e. the
// path template was sent as-is. Every request path goes through one of the two
// builders (attack + mass assignment + rescan → buildAttackRequest; baseline,
// BOLA fetch, BFLA probe, data-exposure rescan → buildBenignRequest; BOLA
// replay → injectObjectId then buildBenignRequest), so this covers them all.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    buildAttackRequest,
    buildBenignRequest,
    injectObjectId,
} from "../request-builder.js";

const ATTACK_TYPES = [
    "SQL_INJECTION", "XSS", "BOUNDARY", "MISSING_AUTH", "PATH_TRAVERSAL",
    "OVERSIZED_PAYLOAD", "TYPE_CONFUSION", "RATE_LIMIT", "BOLA_REPLAY",
    "BFLA_PROBE", "MASS_ASSIGNMENT", "DATA_EXPOSURE", "UNKNOWN",
];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PATHS = ["/users/{id}", "/orgs/{orgId}/items/{ id }", "/a/{x}/b/{y}/c"];
const BASE = "https://api.example.com";
const declared = [
    { name: "id", in: "path" as const, required: true, schema: { type: "integer" } },
    { name: "orgId", in: "path" as const, required: true, schema: { type: "string" } },
];

const noBraces = (url: string) => {
    expect(url).not.toMatch(/[{}]/);
    expect(url).not.toMatch(/%7B|%7D/i);
};

describe("buildAttackRequest — attack, mass assignment, rescan", () => {
    for (const attackType of ATTACK_TYPES)
        for (const method of METHODS)
            for (const path of PATHS) {
                it(`${attackType} ${method} ${path}`, () => {
                    // With declared params, and with none (rows saved before
                    // parameters were persisted re-scan with an empty list).
                    for (const parameters of [declared, []]) {
                        const r = buildAttackRequest({ method, path, baseUrl: BASE, payload: "test", attackType, parameters });
                        noBraces(r.url);
                    }
                });
            }
});

describe("buildBenignRequest — baseline, BOLA fetch, BFLA probe", () => {
    for (const method of METHODS)
        for (const path of PATHS) {
            it(`${method} ${path}`, () => {
                for (const parameters of [declared, []]) {
                    noBraces(buildBenignRequest({ method, path, baseUrl: BASE, parameters }).url);
                }
            });
        }
});

describe("injectObjectId — BOLA replay", () => {
    it("puts the object id in its own segment and fills the rest", () => {
        const { path, parameters } = injectObjectId("/orgs/{orgId}/items/{id}", declared, "id", "42");
        expect(path).toBe("/orgs/{orgId}/items/42");
        expect(parameters.map((p) => p.name)).toEqual(["orgId"]);
        const r = buildBenignRequest({ method: "GET", path, baseUrl: BASE, parameters });
        noBraces(r.url);
        expect(r.url).toMatch(/\/items\/42$/);
    });

    it("URL-encodes the object id", () => {
        const { path } = injectObjectId("/files/{id}", [], "id", "a/b c");
        expect(path).toBe("/files/a%2Fb%20c");
    });

    it("matches a placeholder written with spaces", () => {
        expect(injectObjectId("/u/{ id }", [], "id", "7").path).toBe("/u/7");
    });
});
