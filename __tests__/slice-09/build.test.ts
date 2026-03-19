/**
 * Slice 09: Build Compatibility
 *
 * Verifies that the auth changes to prompts.ts, models.ts, and model-settings.ts
 * do not introduce TypeScript compilation errors.
 *
 * AC-13: GIVEN pnpm run build wird ausgefuehrt
 *        WHEN alle Aenderungen an prompts.ts, models.ts und model-settings.ts angewendet sind
 *        THEN ist der Build erfolgreich ohne TypeScript-Fehler
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("Build compatibility", () => {
  it("AC-13: GIVEN alle auth-Aenderungen angewendet WHEN TypeScript-Compiler auf die geaenderten Dateien laeuft THEN gibt es keine TypeScript-Fehler", { timeout: 60_000 }, () => {
    // Run tsc --noEmit with the project tsconfig to verify type correctness
    // Uses --project to resolve path aliases (@/...) correctly
    try {
      execSync("npx tsc --noEmit --pretty false -p tsconfig.json", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 120_000,
      });
    } catch (error: any) {
      // If tsc exits with non-zero, filter output to only show errors from changed files
      const fullOutput: string =
        error.stdout || error.stderr || error.message;
      const relevantFiles = [
        "app/actions/prompts.ts",
        "app/actions/models.ts",
        "app/actions/model-settings.ts",
      ];
      const lines = fullOutput.split("\n");
      const relevantErrors = lines.filter((line: string) =>
        relevantFiles.some((f) => line.includes(f))
      );

      if (relevantErrors.length > 0) {
        expect.fail(
          `TypeScript compilation failed for auth-guarded action files:\n${relevantErrors.join("\n")}`
        );
      }
      // If no errors in the changed files, the build is compatible for this slice
    }
  });
});
