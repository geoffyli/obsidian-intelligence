import React from "react";
import { cn } from "@/lib/utils";

// The possible statuses for the agent
export type AgentStatus =
	| "idle"
	| "thinking"
	| "retrieving"
	| "analyzing"
	| "tool_calling"
	| "generating"
	| "error";

export interface StatusState {
	status: AgentStatus;
	message: string;
	isVisible: boolean; // Controls visibility of the status message
}

interface StatusMessageProps {
	statusState: StatusState;
	className?: string; // Additional class names for styling
}

const getStatusIcon = (status: AgentStatus) => {
	const iconStyle = {
		width: '16px',
		height: '16px',
		borderRadius: '50%'
	};

	switch (status) {
		case "thinking":
		case "generating":
			return (
				<div 
					className="animate-spin"
					style={{
						...iconStyle,
						border: '2px solid var(--color-base-40)', // or use the same CSS variable as your text
						borderTopColor: 'transparent'
					}}
				></div>
			);
		case "retrieving":
			return (
				<div
					className="animate-pulse" 
					style={{
						...iconStyle,
						backgroundColor: 'var(--interactive-accent)'
					}}
				></div>
			);
		case "analyzing":
			return (
				<div 
					className="animate-bounce" 
					style={{
						...iconStyle,
						backgroundColor: 'var(--interactive-accent)'
					}}
				></div>
			);
		case "tool_calling":
			return (
				<div 
					className="animate-ping" 
					style={{
						...iconStyle,
						backgroundColor: 'var(--interactive-accent)'
					}}
				></div>
			);
		case "error":
			return (
				<div 
					style={{
						...iconStyle,
						backgroundColor: 'var(--text-error)'
					}}
				></div>
			);
		default:
			return null;
	}
};

function StatusMessage({ statusState, className }: StatusMessageProps) {
	// Don't render if the status is not visible
	if (!statusState.isVisible) {
		return null;
	}

	return (
		<div
			className={cn(
				"max-w-[85%] md:max-w-[75%] mr-auto w-fit rounded-lg px-3 py-2 message-fade-in",
				"bg-transparent border-none shadow-none p-0 m-0",
				className
			)}
			role="status"
			aria-live="assertive"
		>
			<div className="flex items-center space-x-2">
				{getStatusIcon(statusState.status)}
				<span className="text-xs text-base-40 opacity-80">
					{statusState.message}
				</span>
			</div>
		</div>
	);
}

export default StatusMessage;
