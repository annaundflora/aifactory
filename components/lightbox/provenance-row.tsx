"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getProvenanceData, type ProvenanceItem } from "@/app/actions/references";

// ---------------------------------------------------------------------------
// Role Color Schema (from discovery.md "Rollen-Farbschema")
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<
  string,
  { badgeBg: string; text: string }
> = {
  style: { badgeBg: "#F3E8FF", text: "#9333EA" },
  content: { badgeBg: "#DBEAFE", text: "#3B82F6" },
  structure: { badgeBg: "#D1FAE5", text: "#059669" },
  character: { badgeBg: "#FEF3C7", text: "#D97706" },
  color: { badgeBg: "#FCE7F3", text: "#DB2777" },
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? { badgeBg: "#F3F4F6", text: "#6B7280" };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// ProvenanceRow Component
// ---------------------------------------------------------------------------

export interface ProvenanceRowProps {
  generationId: string;
}

export function ProvenanceRow({ generationId }: ProvenanceRowProps) {
  const [items, setItems] = useState<ProvenanceItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await getProvenanceData(generationId);
      if (!cancelled) {
        setItems(data);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [generationId]);

  // AC-3: Don't render anything while loading or when there are no references
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div data-testid="provenance-row">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">
        References
      </h3>
      <div className="mt-1 flex flex-wrap gap-3">
        {items.map((item) => {
          const colors = getRoleColor(item.role);
          return (
            <div
              key={item.id}
              className="flex flex-col items-center gap-1"
              data-testid={`provenance-item-${item.slotPosition}`}
            >
              {/* AC-4: Thumbnail 48x48px with imageUrl */}
              <div className="relative h-12 w-12 overflow-hidden rounded">
                <Image
                  src={item.imageUrl}
                  alt={`Reference @${item.slotPosition}`}
                  width={48}
                  height={48}
                  className="h-12 w-12 object-cover"
                />
              </div>
              {/* AC-2: @-number label */}
              <span className="text-[10px] font-semibold text-muted-foreground">
                @{item.slotPosition}
              </span>
              {/* AC-2: Role name, color-coded */}
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                style={{
                  backgroundColor: colors.badgeBg,
                  color: colors.text,
                }}
              >
                {capitalize(item.role)}
              </span>
              {/* AC-2: Strength level */}
              <span className="text-[10px] text-muted-foreground">
                {capitalize(item.strength)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
