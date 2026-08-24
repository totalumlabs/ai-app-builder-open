/**
 * Shared primitives.
 *
 * Import from here, not from the individual files:
 *   import { PageHeader, Section, EmptyState } from "@/components/primitives";
 *
 * Everything in this folder takes ALREADY-TRANSLATED copy as props. Primitives
 * never own user-visible strings except the handful of generic labels they read
 * from `common.*` (close, copy, retry, confirm, cancel).
 */

export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Section, type SectionProps } from "./Section";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { Modal, ModalPrimitive, type ModalProps } from "./Modal";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { CopyButton, type CopyButtonProps } from "./CopyButton";
export { Spinner, SpinnerBlock, type SpinnerProps } from "./Spinner";
export { StatusPill, type StatusPillProps, type StatusTone } from "./StatusPill";
export {
  SkeletonBox,
  SkeletonText,
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonList,
  SkeletonTable,
  SkeletonPageHeader,
} from "./Skeletons";
