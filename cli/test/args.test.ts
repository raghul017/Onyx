// Arg parsing — flags/env, defaults, validation, api-url normalization.
import { describe, it, expect } from "vitest";
import { parseScanArgs, normalizeApiUrl } from "../src/args.js";

const emptyEnv = {} as NodeJS.ProcessEnv;

describe("parseScanArgs", () => {
    it("parses required + defaults", () => {
        const r = parseScanArgs(
            ["--spec", "https://api/openapi.json", "--api-token", "onyx_x"],
            emptyEnv,
        );
        expect(r.error).toBeUndefined();
        expect(r.options).toMatchObject({
            spec: "https://api/openapi.json",
            apiToken: "onyx_x",
            failOn: "high",
            format: "table",
            timeoutSeconds: 300,
            apiUrl: "http://localhost:3000/api",
        });
    });

    it("reads token + api-url from env", () => {
        const r = parseScanArgs(["--spec", "https://api/o.json"], {
            ONYX_TOKEN: "onyx_env",
            ONYX_API_URL: "https://onyx.example.com",
        } as NodeJS.ProcessEnv);
        expect(r.options?.apiToken).toBe("onyx_env");
        expect(r.options?.apiUrl).toBe("https://onyx.example.com/api");
    });

    it("supports --flag=value and passes auth-recipe/org", () => {
        const r = parseScanArgs(
            ["--spec=https://a/o.json", "--api-token=onyx_x", "--auth-recipe=r1", "--org=o1", "--fail-on=critical", "--format=sarif"],
            emptyEnv,
        );
        expect(r.options).toMatchObject({ authRecipe: "r1", orgId: "o1", failOn: "critical", format: "sarif" });
    });

    it("errors on missing spec / token / bad enums", () => {
        expect(parseScanArgs(["--api-token", "onyx_x"], emptyEnv).error).toMatch(/--spec/);
        expect(parseScanArgs(["--spec", "https://a"], emptyEnv).error).toMatch(/token/);
        expect(parseScanArgs(["--spec", "https://a", "--api-token", "t", "--fail-on", "nope"], emptyEnv).error).toMatch(/fail-on/);
        expect(parseScanArgs(["--spec", "https://a", "--api-token", "t", "--format", "xml"], emptyEnv).error).toMatch(/format/);
    });

    it("--help short-circuits", () => {
        expect(parseScanArgs(["--help"], emptyEnv).help).toBe(true);
    });
});

describe("normalizeApiUrl", () => {
    it("appends /api when missing, strips trailing slashes", () => {
        expect(normalizeApiUrl("https://x.com")).toBe("https://x.com/api");
        expect(normalizeApiUrl("https://x.com/")).toBe("https://x.com/api");
        expect(normalizeApiUrl("https://x.com/api")).toBe("https://x.com/api");
        expect(normalizeApiUrl("https://x.com/api/")).toBe("https://x.com/api");
    });
});
