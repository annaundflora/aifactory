"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { GALLERY_DROP_TARGET_ATTR } from "@/lib/constants/drag-types";
import type { GalleryDragPayload } from "@/lib/constants/drag-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TouchDragState {
  isDragging: boolean;
  payload: GalleryDragPayload | null;
  currentX: number;
  currentY: number;
  activeDropTargetId: string | null;
}

type DropCallback = (payload: GalleryDragPayload) => void;

interface TouchDragContextValue {
  state: TouchDragState;
  startDrag: (payload: GalleryDragPayload, x: number, y: number) => void;
  updatePosition: (x: number, y: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  registerDropTarget: (id: string, onDrop: DropCallback) => void;
  unregisterDropTarget: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TouchDragContext = createContext<TouchDragContextValue | null>(null);

const INITIAL_STATE: TouchDragState = {
  isDragging: false,
  payload: null,
  currentX: 0,
  currentY: 0,
  activeDropTargetId: null,
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TouchDragProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TouchDragState>(INITIAL_STATE);
  const dropTargetsRef = useRef<Map<string, DropCallback>>(new Map());

  const startDrag = useCallback(
    (payload: GalleryDragPayload, x: number, y: number) => {
      setState({
        isDragging: true,
        payload,
        currentX: x,
        currentY: y,
        activeDropTargetId: null,
      });
    },
    []
  );

  const updatePosition = useCallback((x: number, y: number) => {
    // Hit-test via elementFromPoint to find drop target under finger
    const el = document.elementFromPoint(x, y);
    const dropTarget = el?.closest(`[${GALLERY_DROP_TARGET_ATTR}]`);
    const targetId = dropTarget?.getAttribute(GALLERY_DROP_TARGET_ATTR) ?? null;

    setState((prev) => ({
      ...prev,
      currentX: x,
      currentY: y,
      activeDropTargetId: targetId,
    }));
  }, []);

  const endDrag = useCallback(() => {
    setState((prev) => {
      if (prev.activeDropTargetId && prev.payload) {
        const cb = dropTargetsRef.current.get(prev.activeDropTargetId);
        if (cb) {
          // Fire callback asynchronously to avoid setState-during-render
          queueMicrotask(() => cb(prev.payload!));
        }
      }
      return INITIAL_STATE;
    });
  }, []);

  const cancelDrag = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const registerDropTarget = useCallback((id: string, onDrop: DropCallback) => {
    dropTargetsRef.current.set(id, onDrop);
  }, []);

  const unregisterDropTarget = useCallback((id: string) => {
    dropTargetsRef.current.delete(id);
  }, []);

  return (
    <TouchDragContext.Provider
      value={{
        state,
        startDrag,
        updatePosition,
        endDrag,
        cancelDrag,
        registerDropTarget,
        unregisterDropTarget,
      }}
    >
      {children}
    </TouchDragContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTouchDrag() {
  const ctx = useContext(TouchDragContext);
  if (!ctx) {
    throw new Error("useTouchDrag must be used within a TouchDragProvider");
  }
  return ctx;
}

/**
 * Returns the context value or null if outside a provider.
 * Useful for components that may or may not be inside a TouchDragProvider.
 */
export function useTouchDragOptional() {
  return useContext(TouchDragContext);
}
