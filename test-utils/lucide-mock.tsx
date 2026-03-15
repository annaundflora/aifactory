/**
 * Comprehensive lucide-react mock factory for vitest.
 *
 * Usage in test files:
 *   import { lucideMock } from "@/test-utils/lucide-mock";
 *   vi.mock("lucide-react", () => lucideMock);
 *
 * This covers ALL icons used across the project so tests never break
 * when a component adds a new icon import.
 */

const stub = (name: string) => {
  const id = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  const Comp = (props: Record<string, unknown>) => (
    <span data-testid={`${id}-icon`} {...props} />
  );
  Comp.displayName = name;
  return Comp;
};

// All lucide-react icons used in the project (auto-generated)
export const lucideMock: Record<string, unknown> = {
  AlertCircle: stub("AlertCircle"),
  AlertTriangle: stub("AlertTriangle"),
  ArrowLeft: stub("ArrowLeft"),
  ArrowRightLeft: stub("ArrowRightLeft"),
  ArrowUp: stub("ArrowUp"),
  Check: stub("Check"),
  CheckIcon: stub("CheckIcon"),
  ChevronDown: stub("ChevronDown"),
  ChevronDownIcon: stub("ChevronDownIcon"),
  ChevronLeft: stub("ChevronLeft"),
  ChevronRight: stub("ChevronRight"),
  ChevronUp: stub("ChevronUp"),
  ChevronUpIcon: stub("ChevronUpIcon"),
  Copy: stub("Copy"),
  Cpu: stub("Cpu"),
  Download: stub("Download"),
  FileText: stub("FileText"),
  FolderOpen: stub("FolderOpen"),
  History: stub("History"),
  Image: stub("Image"),
  ImageIcon: stub("ImageIcon"),
  ImageOff: stub("ImageOff"),
  ImagePlus: stub("ImagePlus"),
  Info: stub("Info"),
  Library: stub("Library"),
  Loader2: stub("Loader2"),
  LucideIcon: stub("LucideIcon"),
  MessageSquare: stub("MessageSquare"),
  Minus: stub("Minus"),
  Moon: stub("Moon"),
  MoreHorizontal: stub("MoreHorizontal"),
  MoreVertical: stub("MoreVertical"),
  PanelLeftClose: stub("PanelLeftClose"),
  PanelLeftIcon: stub("PanelLeftIcon"),
  PanelLeftOpen: stub("PanelLeftOpen"),
  PanelRightClose: stub("PanelRightClose"),
  PanelRightOpen: stub("PanelRightOpen"),
  PenLine: stub("PenLine"),
  Pencil: stub("Pencil"),
  Plus: stub("Plus"),
  Redo2: stub("Redo2"),
  RefreshCw: stub("RefreshCw"),
  Scaling: stub("Scaling"),
  Search: stub("Search"),
  Settings: stub("Settings"),
  Sparkles: stub("Sparkles"),
  Square: stub("Square"),
  Star: stub("Star"),
  Sun: stub("Sun"),
  Trash2: stub("Trash2"),
  Type: stub("Type"),
  Undo2: stub("Undo2"),
  X: stub("X"),
  XIcon: stub("XIcon"),
  ZoomIn: stub("ZoomIn"),
};
