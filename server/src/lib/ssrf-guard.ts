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

/**
 * Resolves a URL's hostname via DNS and throws if it points to a
 * private/internal IP address.
 *
 * **Must be called before any outbound HTTP request to user-supplied URLs.**
 */
export async function assertNotSSRF(url: string): Promise<void> {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

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
