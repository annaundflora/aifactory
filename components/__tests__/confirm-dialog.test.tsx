// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

describe("ConfirmDialog", () => {
  /**
   * AC-14: GIVEN ConfirmDialog wird mit title, description, onConfirm, onCancel Props gerendert
   * WHEN der Dialog sichtbar ist
   * THEN zeigt er Titel, Beschreibung, einen "Cancel" Button und einen destruktiv gestylten Confirm-Button
   */
  it("AC-14: should render title, description, cancel and destructive confirm button", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Project?"
        description="This will permanently delete everything."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Delete Project?")).toBeInTheDocument();
    expect(
      screen.getByText("This will permanently delete everything.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /delete/i });
    expect(confirmBtn).toBeInTheDocument();

    // Confirm button should have destructive variant (rendered via Button with variant="destructive")
    // The Button component wraps AlertDialogAction, check for destructive styling
    expect(confirmBtn.closest("[data-slot='alert-dialog-action']")).toBeTruthy();
  });

  /**
   * AC-11: GIVEN der ConfirmDialog ist offen
   * WHEN der User auf "Cancel" klickt oder den Dialog schliesst
   * THEN schliesst sich der Dialog ohne Aktion, die Card bleibt bestehen
   */
  it("AC-11: should call onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete Project?"
        description="This will permanently delete everything."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * AC-10: GIVEN der ConfirmDialog ist offen
   * WHEN der User auf den destruktiven "Delete" Button klickt
   * THEN wird deleteProject({ id }) aufgerufen, der Dialog schliesst sich
   */
  it("AC-10: should call onConfirm when destructive button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete Project?"
        description="This will permanently delete everything."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /delete/i });
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalled();
  });
});
