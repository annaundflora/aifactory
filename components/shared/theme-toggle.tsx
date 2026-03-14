"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="shrink-0 size-8 text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
