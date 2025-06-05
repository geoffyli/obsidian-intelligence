import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Settings } from "lucide-react";

interface ChatHeaderProps {
	onClearChat: () => void;
	onOpenSettings: () => void;
	isProcessing?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
	onClearChat,
	onOpenSettings,
	isProcessing = false,
}) => {
	return (
		<div className="flex items-center justify-between border-b border-border bg-background">
			{/* Left side - Title */}
			<div className="flex items-center space-x-2">
				<h2 className="mt-2 mb-2">Intelligence Chat</h2>
			</div>

			{/* Right side - Actions */}
			<div className="flex items-center space-x-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearChat}
					disabled={isProcessing}
					className="text-muted-foreground hover:text-foreground hover:bg-muted"
					title="Clear chat history"
				>
					<RotateCcw className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={onOpenSettings}
					disabled={isProcessing}
					className="text-muted-foreground hover:text-foreground hover:bg-muted"
					title="Open settings"
				>
					<Settings className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};

export default ChatHeader;
