import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OperationButtonProps {
  icon: LucideIcon;
  successIcon: LucideIcon;
  onClick: () => Promise<void>;
  title: string;
  className?: string;
  disabled?: boolean;
  isActive?: boolean;
}

const OperationButton = React.memo<OperationButtonProps>(({
  icon,
  successIcon,
  onClick,
  title,
  className,
  disabled = false,
  isActive = false,
}) => {
  const handleClick = React.useCallback(async () => {
    if (disabled) return;

    try {
      await onClick();
    } catch (error) {
      console.error('Operation failed:', error);
    }
  }, [onClick, disabled]);

  // Show success icon when active (after click), show default icon when not active and not hovered
  const CurrentIcon = isActive ? successIcon : icon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 !shadow-none !bg-base-20",
        "text-muted-foreground hover:text-foreground",
        "transition-all duration-150 ease-in-out",
        "opacity-40 hover:opacity-80",
        isActive && "opacity-100 text-foreground",
        className
      )}
      aria-label={title}
    >
      <CurrentIcon 
        className={cn(
          "h-4 w-4",
        )} 
      />
    </Button>
  );
});

OperationButton.displayName = 'OperationButton';

export default OperationButton;
