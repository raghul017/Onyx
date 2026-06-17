// =============================================================================
// Domain Verification Service
// Proves the user owns the target domain before Onyx is allowed to attack it.
// Two methods: file probe (/.well-known/onyx-verify.txt) or DNS TXT record.
// =============================================================================

import crypto from "crypto";
import dns from "dns/promises";

export function generateVerificationToken(): string {
    return "onyx-verify-" + crypto.randomBytes(20).toString("hex");
}

export function extractDomain(specUrl: string): string {
    return new URL(specUrl).hostname.toLowerCase();
}

async function probeFileMethod(domain: string, token: string): Promise<boolean> {
    for (const scheme of ["https", "http"]) {
        const url = `${scheme}://${domain}/.well-known/onyx-verify.txt`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                redirect: "follow",
                headers: { "User-Agent": "Onyx-Verify/1.0" },
            });
            clearTimeout(timer);
            if (res.ok) {
                const body = (await res.text()).trim();
                if (body === token) return true;
            }
            // HTTPS responded (even with non-200) — don't fall through to HTTP
            break;
        } catch {
            clearTimeout(timer);
            // Connection error on HTTPS → try HTTP
            if (scheme === "https") continue;
        }
    }
    return false;
}

async function probeDnsMethod(domain: string, token: string): Promise<boolean> {
    try {
        const records = await dns.resolveTxt(`_onyx-verify.${domain}`);
        return records.flat().some((r) => r === token);
    } catch {
        return false;
    }
}

export async function verifyDomain(
    domain: string,
    token: string,
): Promise<"file" | "dns" | false> {
    if (await probeFileMethod(domain, token)) return "file";
    if (await probeDnsMethod(domain, token)) return "dns";
    return false;
}
