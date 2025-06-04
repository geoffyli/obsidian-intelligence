import React, { useEffect, useRef } from "react";
import { MarkdownRenderer, App } from "obsidian";
import IntelligencePlugin from "../../main";
import { UIMessage } from "../../types";
import { cn } from "@/lib/utils";

interface DisplayMessage extends UIMessage {
	id: string;
}

interface MessageRendererProps {
	message: DisplayMessage;
	app: App;
	plugin: IntelligencePlugin;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({
	message,
	app,
	plugin,
}) => {
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
};

interface ChatMessagesProps {
	messages: DisplayMessage[];
	app: App;
	plugin: IntelligencePlugin;
	isThinking?: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
	messages,
	app,
	plugin,
	isThinking = false,
}) => {
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when new messages are added
	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, [messages]);

	const getMessageStyles = (sender: string) => {
		switch (sender) {
			case "user":
				return "max-w-[85%] md:max-w-[75%] ml-auto bg-primary text-primary-foreground rounded-lg shadow-sm";
			case "ai":
				return "max-w-[85%] md:max-w-[75%] mr-auto bg-secondary text-secondary-foreground border border-border rounded-lg shadow-sm";
			case "system":
				return "mx-auto max-w-[90%] bg-muted text-muted-foreground border border-border text-center rounded-md";
			default:
				return "mx-auto max-w-[90%] bg-muted text-muted-foreground border border-border text-center rounded-md";
		}
	};

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div
				ref={messagesContainerRef}
				className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary rounded-lg"
				role="log"
				aria-label="Chat messages"
				aria-live="polite"
			>
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"rounded-lg p-4",
							getMessageStyles(message.sender)
						)}
					>
						<MessageRenderer
							message={message}
							app={app}
							plugin={plugin}
						/>
					</div>
				))}

				{isThinking && (
					<div
						className="p-4 text-center text-muted-foreground"
						role="status"
						aria-live="assertive"
					>
						<div className="flex items-center justify-center space-x-2">
							<div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
							<span>AI is thinking...</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export { ChatMessages, type DisplayMessage };
