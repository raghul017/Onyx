import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Plan } from "@/services/api";

export type OrgRole = "OWNER" | "ADMIN" | "VIEWER";

export interface OrgContext {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    role: OrgRole;
}

interface OrgStore {
    activeOrg: OrgContext | null;
    setActiveOrg: (org: OrgContext | null) => void;
    clearOrg: () => void;
}

export const useOrgStore = create<OrgStore>()(
    persist(
        (set) => ({
            activeOrg: null,
            setActiveOrg: (org) => set({ activeOrg: org }),
            clearOrg: () => set({ activeOrg: null }),
        }),
        { name: "onyx-org-storage" },
    ),
);
