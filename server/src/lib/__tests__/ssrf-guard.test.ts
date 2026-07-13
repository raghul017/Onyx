// =============================================================================
// Behavior-lock tests for the SSRF guard (assertNotSSRF).
//
// DNS is fully mocked so tests are deterministic and OFFLINE. Literal-IP URLs
// are vetted WITHOUT any DNS lookup (the guard short-circuits on net.isIP), so
// the private/loopback/link-local/CGNAT/metadata/IPv4-mapped cases need no
// resolver at all. Only the hostname (non-literal) cases hit dns.lookup, which
// we stub. Each case uses a distinct host to avoid the guard's per-host cache.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted so the fn exists before vi.mock's hoisted factory references it.
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ default: { lookup }, lookup }));

import { assertNotSSRF } from "../ssrf-guard.js";

beforeEach(() => {
    lookup.mockReset();
});

describe("assertNotSSRF — BLOCKS internal / private targets (literal IPs, no DNS)", () => {
    const blocked: [string, string][] = [
        ["private 10.x", "http://10.0.0.1/"],
        ["private 192.168.x", "http://192.168.1.10/"],
        ["private 172.16.x", "http://172.16.5.5/"],
        ["loopback 127.0.0.1", "http://127.0.0.1/"],
        ["loopback ::1 (bracketed)", "http://[::1]/"],
        ["link-local 169.254.x", "http://169.254.1.1/"],
        ["CGNAT 100.64.x", "http://100.64.0.1/"],
        ["cloud metadata 169.254.169.254", "http://169.254.169.254/latest/meta-data/"],
        ["IPv4-mapped IPv6 ::ffff:10.0.0.1", "http://[::ffff:10.0.0.1]/"],
    ];

    for (const [name, url] of blocked) {
        it(`blocks ${name}`, async () => {
            await expect(assertNotSSRF(url)).rejects.toThrow(/SSRF blocked/);
            expect(lookup).not.toHaveBeenCalled(); // literal IP => no DNS needed
        });
    }

    it("blocks the internal hostname 'localhost' without resolving", async () => {
        await expect(assertNotSSRF("http://localhost:3000/")).rejects.toThrow(/SSRF blocked/);
        expect(lookup).not.toHaveBeenCalled();
    });

    it("blocks a public hostname that RESOLVES to a private IP", async () => {
        // Classic DNS-rebinding shape: benign name, private A record.
        lookup.mockResolvedValue([{ address: "10.1.2.3" }]);
        await expect(assertNotSSRF("http://rebind.example-blocked.test/")).rejects.toThrow(
            /SSRF blocked/,
        );
        expect(lookup).toHaveBeenCalledTimes(1);
    });
});

describe("assertNotSSRF — ALLOWS legitimate public targets", () => {
    it("allows a public hostname that resolves to a public IP", async () => {
        lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
        await expect(assertNotSSRF("https://public.example-allowed.test/api")).resolves.toBeUndefined();
        expect(lookup).toHaveBeenCalledTimes(1);
    });

    it("allows a literal public IP without any DNS lookup", async () => {
        await expect(assertNotSSRF("http://93.184.216.34/")).resolves.toBeUndefined();
        expect(lookup).not.toHaveBeenCalled();
    });
});
