// Augment Express Request with user info from JWT and org context
export {};

import type { OrgMember } from "@prisma/client";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
            };
            /** How the request authenticated (T10a): interactive JWT session vs API token. */
            authMethod?: "jwt" | "apiToken";
            orgMember?: OrgMember;  // set by requireOrgMember middleware
            orgId?: string;          // set by injectOrgContext middleware
        }
    }
}
