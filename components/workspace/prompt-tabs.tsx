"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptTab = "prompt" | "history" | "favorites";

interface PromptTabsProps {
  activeTab: PromptTab;
  onTabChange: (tab: PromptTab) => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptTabs({
  activeTab,
  onTabChange,
  children,
}: PromptTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as PromptTab)}
      data-testid="prompt-tabs"
    >
      <TabsList className="w-full">
        <TabsTrigger
          value="prompt"
          className="flex-1"
          data-testid="tab-prompt"
        >
          Prompt
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="flex-1"
          data-testid="tab-history"
        >
          History
        </TabsTrigger>
        <TabsTrigger
          value="favorites"
          className="flex-1"
          data-testid="tab-favorites"
        >
          Favorites
        </TabsTrigger>
      </TabsList>

      <TabsContent value="prompt">
        {children}
      </TabsContent>

      <TabsContent value="history">
        <p className="py-6 text-center text-sm text-muted-foreground">
          Prompt history will appear here.
        </p>
      </TabsContent>

      <TabsContent value="favorites">
        <p className="py-6 text-center text-sm text-muted-foreground">
          Favorite prompts will appear here.
        </p>
      </TabsContent>
    </Tabs>
  );
}
