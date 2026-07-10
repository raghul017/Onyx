// =============================================================================
// OrgSwitcher — dropdown to switch between personal and org contexts
// =============================================================================

import { Building2, ChevronDown, Plus, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOrgStore, type OrgContext } from "@/store/useOrgStore";
import type { OrgSummary } from "@/services/api";

interface OrgSwitcherProps {
    orgs: OrgSummary[];
}

export default function OrgSwitcher({ orgs }: OrgSwitcherProps) {
    const navigate = useNavigate();
    const { activeOrg, setActiveOrg, clearOrg } = useOrgStore();

    const label = activeOrg ? activeOrg.name : "Personal";

    const handleSelect = (org: OrgSummary | null) => {
        if (!org) {
            clearOrg();
        } else {
            setActiveOrg(org as OrgContext);
        }
    };

    return (
        <div className="relative group">
            <button
                className="flex items-center gap-1.5 text-[#666] hover:text-black text-[12px] font-mono transition-colors border border-[#e6e6e6] hover:border-black px-2.5 py-1.5"
                aria-label="Switch organization"
            >
                {activeOrg ? <Building2 size={12} /> : <User size={12} />}
                <span className="max-w-[100px] truncate">{label}</span>
                <ChevronDown size={10} className="text-[#999]" />
            </button>

            {/* Dropdown */}
            <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-[#e6e6e6] z-50 hidden group-focus-within:block group-hover:block">
                {/* Personal */}
                <button
                    onClick={() => handleSelect(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#f5f5f5] transition-colors text-left ${!activeOrg ? "text-[#3b82f6] font-medium" : "text-[#333]"}`}
                >
                    <User size={11} />
                    Personal
                </button>

                {orgs.length > 0 && (
                    <div className="border-t border-[#e6e6e6]">
                        {orgs.map((org) => (
                            <button
                                key={org.id}
                                onClick={() => handleSelect(org)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#f5f5f5] transition-colors text-left ${activeOrg?.id === org.id ? "text-[#3b82f6] font-medium" : "text-[#333]"}`}
                            >
                                <Building2 size={11} />
                                <span className="flex-1 truncate">{org.name}</span>
                                <span className="text-[9px] text-[#999] uppercase font-mono">{org.role}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="border-t border-[#e6e6e6]">
                    <button
                        onClick={() => navigate("/settings")}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#666] hover:text-black hover:bg-[#f5f5f5] transition-colors text-left"
                    >
                        <Plus size={11} />
                        Create organization
                    </button>
                </div>
            </div>
        </div>
    );
}
