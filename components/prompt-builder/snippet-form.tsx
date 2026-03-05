"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Snippet } from "@/lib/services/snippet-service";

interface SnippetFormProps {
  snippet?: Snippet;
  categories: string[];
  onSave: (snippet: Snippet) => void;
  onCancel: () => void;
}

export function SnippetForm({
  snippet,
  categories,
  onSave,
  onCancel,
}: SnippetFormProps) {
  const [text, setText] = useState(snippet?.text ?? "");
  const [category, setCategory] = useState(snippet?.category ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  const isEditing = !!snippet;

  const resolvedCategory = useCustomCategory
    ? customCategory.trim()
    : category;

  async function handleSave() {
    const trimmedText = text.trim();

    if (!trimmedText) {
      setError("Snippet text is required");
      return;
    }

    if (!resolvedCategory) {
      setError("Category is required");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const { createSnippet, updateSnippet } = await import(
        "@/app/actions/prompts"
      );

      let result: Snippet | { error: string };

      if (isEditing) {
        result = await updateSnippet({
          id: snippet.id,
          text: trimmedText,
          category: resolvedCategory,
        });
      } else {
        result = await createSnippet({
          text: trimmedText,
          category: resolvedCategory,
        });
      }

      if ("error" in result) {
        setError(result.error);
        setSaving(false);
        return;
      }

      onSave(result);
    } catch {
      setError("Failed to save snippet");
      setSaving(false);
    }
  }

  return (
    <div
      className="space-y-3 rounded-md border bg-muted/30 p-3"
      data-testid="snippet-form"
    >
      <div>
        <Input
          ref={textInputRef}
          placeholder="Snippet text, e.g. 'on white background'"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) {
              handleSave();
            }
          }}
          data-testid="snippet-text-input"
          aria-invalid={!!error && !text.trim()}
        />
      </div>

      <div className="space-y-2">
        {!useCustomCategory ? (
          <div className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (error) setError("");
              }}
              data-testid="snippet-category-select"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => setUseCustomCategory(true)}
              data-testid="snippet-new-category-btn"
            >
              + New
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={customCategory}
              onChange={(e) => {
                setCustomCategory(e.target.value);
                if (error) setError("");
              }}
              data-testid="snippet-custom-category-input"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => {
                setUseCustomCategory(false);
                setCustomCategory("");
              }}
            >
              Existing
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive" data-testid="snippet-form-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          data-testid="snippet-save-btn"
          className="flex-1"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          data-testid="snippet-cancel-btn"
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
