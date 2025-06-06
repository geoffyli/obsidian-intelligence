import React, { useEffect, useRef } from "react";
import { MarkdownRenderer, App } from "obsidian";
import IntelligencePlugin from "../../main";
import { UIMessage } from "../../types";
import { cn } from "@/lib/utils";
import StatusMessage, { StatusState } from "./StatusMessage";

interface DisplayMessage extends UIMessage {
	id: string;
}

interface MessageRendererProps {
	message: DisplayMessage;
	app: App;
	plugin: IntelligencePlugin;
}

function MessageRenderer({
	message,
	app,
	plugin,
}: MessageRendererProps) {
	const messageRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (messageRef.current) {
			messageRef.current.innerHTML = "";
			MarkdownRenderer.render(
				app,
				message.text,
				messageRef.current,
				plugin.manifest.dir || "",
				plugin as any
			);

			// Attach link handlers
			const internalLinks =
				messageRef.current.querySelectorAll("a.internal-link");
			const clickHandlers: Array<{
				element: HTMLAnchorElement;
				handler: (e: Event) => void;
			}> = [];

			internalLinks.forEach((link) => {
				const anchor = link as HTMLAnchorElement;
				if (!anchor.hasAttribute("tabindex")) {
					anchor.setAttribute("tabindex", "0");
				}

				const clickHandler = (e: Event) => {
					e.preventDefault();
					const href =
						anchor.dataset.href || anchor.getAttribute("href");
					if (href) {
						app.workspace
							.openLinkText(href, "", "tab", {
								active: true,
							} as any)
							.catch((err: any) => {
								console.error(
									`Error opening link: ${href}`,
									err
								);
							});
					}
				};

				anchor.addEventListener("click", clickHandler);
				clickHandlers.push({ element: anchor, handler: clickHandler });
			});

			// Cleanup function
			return () => {
				clickHandlers.forEach(({ element, handler }) => {
					element.removeEventListener("click", handler);
				});
			};
		}
	}, [message.text, app, plugin]);

	return <div ref={messageRef} className="markdown-rendered-content" />;
}

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
				return "max-w-[85%] md:max-w-[75%] ml-auto w-fit bg-primary text-primary-foreground rounded-lg shadow-sm";
			case "ai":
				return "max-w-[85%] md:max-w-[75%] mr-auto w-fit bg-base-30 text-secondary-foreground border border-border rounded-lg shadow-sm";
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
							"rounded-lg px-3 py-2 message-fade-in",
							getMessageStyles(message.sender)
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
