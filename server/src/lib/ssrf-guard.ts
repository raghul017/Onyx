// =============================================================================
// SSRF Guard — DNS-resolving check for user-supplied URLs
// =============================================================================

import dns from "node:dns/promises";
import net from "node:net";

/**
 * Returns true if the IP address belongs to a private, loopback, or
 * link-local range that should never be reached by outbound requests.
 */
function isPrivateIP(ip: string): boolean {
    if (net.isIPv6(ip)) {
        return (
            ip === "::1" ||
            ip === "::ffff:127.0.0.1" ||
            ip.startsWith("fe80:") ||
            ip.startsWith("fc00:") ||
            ip.startsWith("fd00:")
        );
    }

    return (
        ip.startsWith("127.") ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("169.254.") ||
        ip.startsWith("0.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
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

    // Resolve DNS and check the actual IP the hostname points to
    try {
        const { address } = await dns.lookup(hostname);
        if (isPrivateIP(address)) {
            throw new Error(
                `SSRF blocked: "${hostname}" resolves to private IP ${address}`,
            );
        }
    } catch (err) {
        // Re-throw our own SSRF errors; DNS failures are fine (let the
        // actual HTTP request handle ENOTFOUND gracefully).
        if (err instanceof Error && err.message.startsWith("SSRF blocked")) {
            throw err;
        }
        // DNS lookup failures (ENOTFOUND etc.) — let the caller proceed
        // so the real HTTP call produces a user-friendly error.
    }
}
