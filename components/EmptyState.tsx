import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Use alert semantics when the state came from a failed request. */
  error?: boolean;
}

/** One designed empty state for every list, filter, and failed panel. */
const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction,
  error = false,
}) => (
  <div className={`state-panel ${error ? 'state-panel--error' : ''}`} role={error ? 'alert' : 'status'}>
    <span className="state-panel__mark" aria-hidden="true">
      <FolderOpen className="h-5 w-5" />
    </span>
    <p className="state-panel__eyebrow ps2-label">{error ? 'Error' : 'Empty'}</p>
    <p className="state-panel__title">{title}</p>
    {message && <p className="state-panel__message">{message}</p>}
    {actionLabel && onAction && (
      <button type="button" className="state-panel__action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
