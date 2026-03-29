"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HistoryList } from "@/components/workspace/history-list";
import { FavoritesList } from "@/components/workspace/favorites-list";
import type { PromptHistoryEntry } from "@/lib/services/prompt-history-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptTab = "prompt" | "history" | "favorites";

interface PromptTabsProps {
  activeTab: PromptTab;
  onTabChange: (tab: PromptTab) => void;
  children: ReactNode;
  /** Called when a history or favorites entry is loaded; switches tab to "prompt" */
  onLoadHistoryEntry?: (entry: PromptHistoryEntry) => void;
  /** Current prompt field values for confirmation dialog logic */
  promptMotiv?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptTabs({
  activeTab,
  onTabChange,
  children,
  onLoadHistoryEntry,
  promptMotiv = "",
}: PromptTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as PromptTab)}
      data-testid="prompt-tabs"
    >
      <TabsList variant="line" className="w-full rounded-none border-b border-border bg-transparent p-0 h-auto">
        <TabsTrigger
          value="prompt"
          className="flex-1 rounded-none border-b-2 border-transparent pb-2 pt-0 text-[13px] font-semibold text-muted-foreground transition-colors data-[state=active]:border-b-primary! data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent data-[state=active]:bg-transparent after:hidden"
          data-testid="tab-prompt"
        >
          Prompt
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="flex-1 rounded-none border-b-2 border-transparent pb-2 pt-0 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:border-b-primary! data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent data-[state=active]:bg-transparent after:hidden"
          data-testid="tab-history"
        >
          History
        </TabsTrigger>
        <TabsTrigger
          value="favorites"
          className="flex-1 rounded-none border-b-2 border-transparent pb-2 pt-0 text-[13px] font-medium text-muted-foreground transition-colors data-[state=active]:border-b-primary! data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent data-[state=active]:bg-transparent after:hidden"
          data-testid="tab-favorites"
        >
          Favorites
        </TabsTrigger>
      </TabsList>

      <TabsContent value="prompt">
        {children}
      </TabsContent>

      <TabsContent value="history">
        <HistoryList
          onLoadEntry={(entry) => {
            onLoadHistoryEntry?.(entry);
            onTabChange("prompt");
          }}
          promptMotiv={promptMotiv}
        />
      </TabsContent>

      <TabsContent value="favorites">
        <FavoritesList
          onLoadEntry={(entry) => {
            onLoadHistoryEntry?.(entry);
            onTabChange("prompt");
          }}
          promptMotiv={promptMotiv}
        />
      </TabsContent>
    </Tabs>
  );
}
