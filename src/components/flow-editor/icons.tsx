import {
  Clock,
  GalleryHorizontal,
  GitBranch,
  LockOpen,
  MessageSquare,
  MousePointerClick,
  StickyNote,
  Tag,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { EditorKind } from "@/lib/flow/types";

/** Ícone Lucide de cada tipo de caixinha. */
export const KIND_ICON: Record<EditorKind, LucideIcon> = {
  TRIGGER: Zap,
  MESSAGE: MessageSquare,
  QUESTION: MousePointerClick,
  CAROUSEL: GalleryHorizontal,
  FOLLOW_GATE: LockOpen,
  CONDITION: GitBranch,
  DELAY: Clock,
  ADD_TAG: Tag,
  NOTE: StickyNote,
};
