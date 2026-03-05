"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { OptionChip } from "@/components/prompt-builder/option-chip";

interface CategoryTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  styleOptions: string[];
  colorOptions: string[];
  selectedOptions: Set<string>;
  onToggleOption: (option: string) => void;
}

export function CategoryTabs({
  activeTab,
  onTabChange,
  styleOptions,
  colorOptions,
  selectedOptions,
  onToggleOption,
}: CategoryTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full">
        <TabsTrigger value="style" data-testid="tab-style">
          Style
        </TabsTrigger>
        <TabsTrigger value="colors" data-testid="tab-colors">
          Colors
        </TabsTrigger>
      </TabsList>

      <TabsContent value="style">
        <div className="grid grid-cols-3 gap-2" data-testid="style-grid">
          {styleOptions.map((option) => (
            <OptionChip
              key={option}
              label={option}
              selected={selectedOptions.has(option.toLowerCase())}
              onToggle={() => onToggleOption(option)}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="colors">
        <div className="grid grid-cols-3 gap-2" data-testid="colors-grid">
          {colorOptions.map((option) => (
            <OptionChip
              key={option}
              label={option}
              selected={selectedOptions.has(option.toLowerCase())}
              onToggle={() => onToggleOption(option)}
            />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
