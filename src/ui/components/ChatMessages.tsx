import React, { useEffect, useRef } from "react";
import { App } from "obsidian";
import IntelligencePlugin from "../../main";
import { cn } from "@/lib/utils";
import StatusMessage, { StatusState } from "./StatusMessage";
import MessageOperations from "./MessageOperations";
import { MessageRenderer, type DisplayMessage } from "./MessageRenderer";

interface ChatMessagesProps {
	messages: DisplayMessage[];
	app: App;
	plugin: IntelligencePlugin;
	statusState?: StatusState;
}

function ChatMessages({
	messages,
	app,
	plugin,
	statusState,
}: ChatMessagesProps) {
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when new messages are added or status changes
	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTo({
				top: messagesContainerRef.current.scrollHeight,
				behavior: "smooth"
			});
		}
	}, [messages, statusState?.isVisible]);

	const getMessageStyles = (sender: string) => {
		switch (sender) {
			case "user":
				return "max-w-[85%] md:max-w-[75%] ml-auto w-fit bg-primary text-primary-foreground rounded-lg shadow-none";
			case "ai":
				return "max-w-[85%] md:max-w-[75%] mr-auto w-fit bg-base-20 text-secondary-foreground border border-border rounded-lg shadow-none";
			case "system":
				return "mx-auto max-w-[90%] w-fit bg-muted text-muted-foreground border border-border text-center rounded-md";
			default:
				return "mx-auto max-w-[90%] w-fit bg-muted text-muted-foreground border border-border text-center rounded-md";
		}
	};

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div
				ref={messagesContainerRef}
				className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-20 rounded-lg"
				// style={{backgroundColor: 'var(--background-secondary)'}}
				role="log"
				aria-label="Chat messages"
				aria-live="polite"
			>
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"group", // Add group class for hover effects
							getMessageStyles(message.sender)
						)}
					>
						<div
							className={cn(
								"rounded-lg px-3 py-2 message-fade-in"
							)}
							style={{
								backgroundColor: message.sender === 'user' 
									? 'var(--interactive-accent)' 
									: 'var(--background-modifier-hover)',
								borderColor: message.sender !== 'user' ? 'var(--background-modifier-border)' : undefined
							}}
						>
							<MessageRenderer
								message={message}
								app={app}
								plugin={plugin}
							/>
						</div>
						{/* Only render Message Operations under the AI message */}
						{message.sender === "ai" && (
							<MessageOperations message={message} />
						)}
						{/* Render operations for user messages */}
						{/* <MessageOperations message={message} /> */}
					</div>
				))}
				{/* Render the status message if statusState is truthy */}
				{statusState && (
					<StatusMessage statusState={statusState} />
				)}
			</div>
		</div>
	);
}

export { ChatMessages, type DisplayMessage };
