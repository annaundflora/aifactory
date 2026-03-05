"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { improvePrompt } from "@/app/actions/prompts";

interface LLMComparisonProps {
  prompt: string;
  onAdopt: (improved: string) => void;
  onDiscard: () => void;
}

export function LLMComparison({
  prompt,
  onAdopt,
  onDiscard,
}: LLMComparisonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    original: string;
    improved: string;
  } | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const response = await improvePrompt({ prompt });

      if ("error" in response) {
        toast("Prompt-Verbesserung fehlgeschlagen");
        onDiscard();
        return;
      }

      setResult(response);
    });
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isPending || !result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Improving prompt...
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Original
          </span>
          <div className="min-h-24 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {result.original}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Improved
          </span>
          <div className="min-h-24 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {result.improved}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDiscard}>
          Discard
        </Button>
        <Button onClick={() => onAdopt(result.improved)}>Adopt</Button>
      </div>
    </div>
  );
}
