import React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClipboard } from '../hooks/useClipboard';
import OperationButton from './OperationButton';
import type { DisplayMessage } from './ChatMessages';

export interface MessageOperationsProps {
  message: DisplayMessage;
  className?: string;
}

const MessageOperations = React.memo<MessageOperationsProps>(({
  message,
  className,
}) => {
  const { copyToClipboard, isSuccess } = useClipboard(1000);

  const handleCopy = React.useCallback(async () => {
    if (!message.text.trim()) {
      return;
    }

    const success = await copyToClipboard(message.text);
    if (!success) {
      // Error is already handled in useClipboard hook
      console.warn('Failed to copy message content');
    }
  }, [message.text, copyToClipboard]);

  // Don't render operations for system messages or empty messages
  if (message.sender === 'system' || !message.text.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center space-x-2 mt-1",
        "bg-base-20", // Ensure transparent background
        className
      )}
      role="toolbar"
      aria-label="Message operations"
    >
      <OperationButton
        icon={Copy}
        successIcon={Check}
        onClick={handleCopy}
        title="Copy message"
        isActive={isSuccess}
      />
      {/* Other operations can be added here */}
    </div>
  );
});

MessageOperations.displayName = 'MessageOperations';

export default MessageOperations;
