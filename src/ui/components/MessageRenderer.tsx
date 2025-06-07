import React, { useEffect, useRef } from "react";
import { MarkdownRenderer, App } from "obsidian";
import IntelligencePlugin from "../../main";
import { UIMessage } from "../../types";

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
		// Return empty cleanup function if messageRef.current is falsy
		return () => {};
	}, [message.text, app, plugin]);

	return <div ref={messageRef} className="markdown-rendered-content" />;
}

export { MessageRenderer, type DisplayMessage };