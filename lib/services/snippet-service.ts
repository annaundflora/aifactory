import { db } from "@/lib/db";
import { promptSnippets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type Snippet = {
  id: string;
  text: string;
  category: string;
  createdAt: Date;
};

export const SnippetService = {
  async create(text: string, category: string): Promise<Snippet> {
    const [snippet] = await db
      .insert(promptSnippets)
      .values({ text, category })
      .returning();

    return mapToSnippet(snippet);
  },

  async update(id: string, text: string, category: string): Promise<Snippet | null> {
    const [snippet] = await db
      .update(promptSnippets)
      .set({ text, category })
      .where(eq(promptSnippets.id, id))
      .returning();

    return snippet ? mapToSnippet(snippet) : null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(promptSnippets)
      .where(eq(promptSnippets.id, id))
      .returning({ id: promptSnippets.id });

    return result.length > 0;
  },

  async getAll(): Promise<Record<string, Snippet[]>> {
    const rows = await db
      .select()
      .from(promptSnippets)
      .orderBy(promptSnippets.category, promptSnippets.createdAt);

    const grouped: Record<string, Snippet[]> = {};
    for (const row of rows) {
      const snippet = mapToSnippet(row);
      if (!grouped[snippet.category]) {
        grouped[snippet.category] = [];
      }
      grouped[snippet.category].push(snippet);
    }

    return grouped;
  },
};

function mapToSnippet(row: {
  id: string | null;
  text: string;
  category: string;
  createdAt: Date;
}): Snippet {
  return {
    id: row.id!,
    text: row.text,
    category: row.category,
    createdAt: row.createdAt,
  };
}
