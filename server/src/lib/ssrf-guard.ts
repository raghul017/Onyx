// =============================================================================
// SSRF Guard — DNS-resolving check for user-supplied URLs
// =============================================================================

import dns from "node:dns/promises";
import net from "node:net";

/**
 * Returns true if the IP address belongs to a private, loopback, or
 * link-local range that should never be reached by outbound requests.
 */
function isPrivateIPv4(ip: string): boolean {
    return (
        ip.startsWith("127.") ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("169.254.") || // link-local + cloud metadata 169.254.169.254
        ip.startsWith("0.") ||
        ip === "255.255.255.255" ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) // 100.64.0.0/10 CGNAT
    );
}

function isPrivateIP(ip: string): boolean {
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible IPv6 — extract the v4
        // tail and evaluate it as IPv4, so ::ffff:10.0.0.1 is caught too.
        const mapped = lower.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateIPv4(mapped[1]!);
        // Same address in hex-compressed form: Node's URL parser normalizes
        // ::ffff:10.0.0.1 → ::ffff:a00:1, which the dotted regex above misses.
        // Decode the trailing two 16-bit groups back into a dotted quad.
        const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hex) {
            const hi = parseInt(hex[1]!, 16);
            const lo = parseInt(hex[2]!, 16);
            const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
            return isPrivateIPv4(v4);
        }
        return (
            lower === "::1" ||          // loopback
            lower === "::" ||           // unspecified / all-zeros
            lower.startsWith("fe80:") || // link-local
            lower.startsWith("fc") ||    // unique local fc00::/7
            lower.startsWith("fd") ||
            lower.startsWith("ff")       // multicast
        );
    }

    // Reject anything that isn't a well-formed dotted-quad IPv4 (e.g. decimal
    // "2130706433" or hex "0x7f.1" encodings that resolve to loopback).
    if (!net.isIPv4(ip)) return true;
    return isPrivateIPv4(ip);
}

// ---------------------------------------------------------------------------
// Per-host verdict cache
// ---------------------------------------------------------------------------
//
// A single scan fires hundreds of payloads at ONE host, so without a cache we
// ran an identical `dns.lookup` for every job (400 payloads → 400 lookups).
// We memoize the safe/blocked verdict per hostname for a short TTL, collapsing
// those into a single lookup per run. The TTL is deliberately short so a DNS
// record that changes (e.g. a rebinding attempt) is re-vetted quickly; a run
// firing at ~30 jobs/sec drains well inside this window.

const DNS_CACHE_TTL_MS = 60_000; // 1 minute
const DNS_CACHE_MAX = 500; // bound memory — evict oldest when exceeded

type Verdict =
    | { blocked: false }
    | { blocked: true; reason: string };

const verdictCache = new Map<string, { verdict: Verdict; at: number }>();

function cacheGet(hostname: string): Verdict | null {
    const hit = verdictCache.get(hostname);
    if (!hit) return null;
    if (Date.now() - hit.at >= DNS_CACHE_TTL_MS) {
        verdictCache.delete(hostname);
        return null;
    }
    return hit.verdict;
}

function cacheSet(hostname: string, verdict: Verdict): void {
    if (verdictCache.size >= DNS_CACHE_MAX) {
        // Map preserves insertion order — drop the oldest entry.
        const oldest = verdictCache.keys().next().value;
        if (oldest !== undefined) verdictCache.delete(oldest);
    }
    verdictCache.set(hostname, { verdict, at: Date.now() });
}

/**
 * Runs the actual SSRF checks for a hostname. Returns nothing on "safe" and
 * throws on "blocked" — the caller wraps this to memoize the verdict.
 */
async function vetHostname(hostname: string): Promise<void> {
    // Block obvious private hostnames
    if (
        hostname === "localhost" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
    ) {
        throw new Error(`SSRF blocked: internal hostname "${hostname}"`);
    }

    // If the hostname is already a literal IP (in any encoding Node accepts),
    // check it directly. isPrivateIP fails closed on non-dotted-quad IPv4 such
    // as decimal (2130706433) or hex forms.
    if (net.isIP(hostname) !== 0) {
        if (isPrivateIP(hostname)) {
            throw new Error(`SSRF blocked: literal private IP "${hostname}"`);
        }
        return;
    }

    // Resolve ALL addresses (A + AAAA) and block if ANY is private. Using
    // { all: true } closes the gap where dns.lookup returns only the first
    // record while the actual request could connect to a different one.
    let addresses: { address: string }[];
    try {
        addresses = await dns.lookup(hostname, { all: true });
    } catch (err: any) {
        // A genuine "host not found" is safe to pass through (the real request
        // will fail cleanly). Any OTHER resolver error fails CLOSED — we must
        // not send a request we couldn't vet.
        if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN") {
            return;
        }
        throw new Error(`SSRF blocked: DNS resolution error for "${hostname}"`);
    }

    if (addresses.length === 0) return; // nothing resolved — let HTTP fail cleanly

    for (const { address } of addresses) {
        if (isPrivateIP(address)) {
            throw new Error(
                `SSRF blocked: "${hostname}" resolves to private IP ${address}`,
            );
        }
    }
}

/**
 * Resolves a URL's hostname via DNS and throws if it points to a
 * private/internal IP address. The safe/blocked verdict is cached per host for
 * a short TTL so a run firing many payloads at one target does a single lookup.
 *
 * **Must be called before any outbound HTTP request to user-supplied URLs.**
 */
export async function assertNotSSRF(url: string): Promise<void> {
    let hostname = new URL(url).hostname;

    // URL() wraps IPv6 literals in brackets ("[::1]", "[::ffff:10.0.0.1]").
    // Strip them so the literal-IP checks below see a bare address that
    // net.isIP()/isPrivateIP() understand — otherwise a bracketed loopback or
    // ULA address slips through as an unresolvable "hostname".
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
    }

    const cached = cacheGet(hostname);
    if (cached) {
        if (cached.blocked) throw new Error(cached.reason);
        return;
    }

    try {
        await vetHostname(hostname);
        cacheSet(hostname, { blocked: false });
    } catch (err) {
        // Only cache a definitive "blocked" verdict — a transient resolver error
        // that fell through to `return` above is treated as safe and cached as
        // safe, which is the pre-existing behavior.
        cacheSet(hostname, {
            blocked: true,
            reason: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}
