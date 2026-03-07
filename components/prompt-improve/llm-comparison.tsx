"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { improvePrompt } from "@/app/actions/prompts";

interface LLMComparisonProps {
  prompt: string;
  modelId: string;
  modelDisplayName: string;
  onAdopt: (improved: string) => void;
  onDiscard: () => void;
}

export function LLMComparison({
  prompt,
  modelId,
  modelDisplayName,
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
      const response = await improvePrompt({ prompt, modelId });

      if ("error" in response) {
        toast("Prompt-Verbesserung fehlgeschlagen");
        onDiscard();
        return;
      }

      setResult(response);
    });
    // Run only once on mount
  }, []);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onDiscard();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Improve Prompt</DialogTitle>
        </DialogHeader>

        {isPending || !result ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Improving prompt...
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Original
                </span>
                <div className="min-h-24 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                  {prompt}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                Optimized for: {modelDisplayName}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onDiscard}>
                  Discard
                </Button>
                <Button onClick={() => onAdopt(result.improved)}>Adopt</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
