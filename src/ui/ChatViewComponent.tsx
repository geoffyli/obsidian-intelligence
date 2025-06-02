import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	KeyboardEvent,
} from "react";
import { MarkdownRenderer, TFile, App } from "obsidian";
import IntelligencePlugin from "../main";
import { UIMessage, LangChainChatMessage } from "../types";
import { CHATVIEW_WELCOME_MESSAGE } from "../constants";
import { AVAILABLE_FILTERS } from "../filters";
import { FilterSignature } from "../filters";
import { parseFiltersFromPrompt } from "../parser";

interface ChatViewComponentProps {
	plugin: IntelligencePlugin;
	app: App;
}

interface DisplayMessage extends UIMessage {
	id: string;
}

interface SuggestionItem {
	type: "filterType" | "filterValue" | "fileName";
	data: FilterSignature | string | TFile;
	displayText: string;
}

// Separate component for rendering messages to avoid hooks in loops
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

const ChatViewComponent: React.FC<ChatViewComponentProps> = ({
	plugin,
	app,
}) => {
	const [chatHistory, setChatHistory] = useState<LangChainChatMessage[]>([]);
	const [uiMessages, setUiMessages] = useState<DisplayMessage[]>([
		{
			id: crypto.randomUUID(),
			sender: "system",
			text: CHATVIEW_WELCOME_MESSAGE,
			timestamp: new Date(),
		},
	]);
	const [inputValue, setInputValue] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const [isSuggesting, setIsSuggesting] = useState(false);
	const [currSuggestions, setCurrSuggestions] = useState<SuggestionItem[]>(
		[]
	);
	const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
	const [selectedFilterType, setSelectedFilterType] =
		useState<FilterSignature | null>(null);
	const [suggestionQuery, setSuggestionQuery] = useState("");
	const [suggestionQueryPos, setSuggestionQueryPos] = useState(0);
	const [isFileMode, setIsFileMode] = useState(false);
	const [fileTriggerPos, setFileTriggerPos] = useState(0);

	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const inputAreaRef = useRef<HTMLTextAreaElement>(null);
	const suggestionPopoverRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when new messages are added
	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, [uiMessages]);

	// Handle document click for closing suggestions
	useEffect(() => {
		const handleDocumentClick = (evt: MouseEvent) => {
			if (
				inputAreaRef.current &&
				!inputAreaRef.current.contains(evt.target as Node) &&
				suggestionPopoverRef.current &&
				!suggestionPopoverRef.current.contains(evt.target as Node)
			) {
				hideSuggestions();
			}
		};

		document.addEventListener("click", handleDocumentClick);
		return () => document.removeEventListener("click", handleDocumentClick);
	}, []);

	const getFileSuggestions = useCallback(
		(query = ""): TFile[] => {
			const allFiles = app.vault
				.getFiles()
				.filter((file) => file.extension === "md");

			if (!query) {
				return allFiles
					.sort((a, b) => b.stat.ctime - a.stat.ctime)
					.slice(0, 7);
			}

			return allFiles
				.filter((file) =>
					file.basename.toLowerCase().startsWith(query.toLowerCase())
				)
				.sort((a, b) => b.stat.ctime - a.stat.ctime)
				.slice(0, 7);
		},
		[app]
	);

	const hideSuggestions = useCallback(() => {
		setIsSuggesting(false);
		setCurrSuggestions([]);
		setActiveSuggestionIndex(-1);
	}, []);

	const showFilterTypeSuggestions = useCallback(
		(query: string) => {
			const suggestions = AVAILABLE_FILTERS.filter((sig) =>
				sig.triggerKeywords.some((keyword) =>
					keyword.toLowerCase().startsWith(query)
				)
			)
				.map((sig) => ({
					type: "filterType" as const,
					data: sig,
					displayText: sig.suggestionDisplay,
				}))
				.slice(0, 7);

			setCurrSuggestions(suggestions);
			if (suggestions.length > 0) {
				setIsSuggesting(true);
				setActiveSuggestionIndex(0);
			} else {
				hideSuggestions();
			}
		},
		[hideSuggestions]
	);

	const showFileSuggestions = useCallback(
		(query: string) => {
			const files = getFileSuggestions(query);
			const suggestions = files.map((file) => ({
				type: "fileName" as const,
				data: file,
				displayText: file.basename,
			}));

			setCurrSuggestions(suggestions);
			setIsSuggesting(true);
			setActiveSuggestionIndex(0);
		},
		[getFileSuggestions]
	);

	const showFilterValueSuggestions = useCallback(
		(filterSig: FilterSignature) => {
			const suggestions = Object.entries(filterSig.valueSuggestions).map(
				([displayText, getValue]) => ({
					type: "filterValue" as const,
					displayText,
					data: getValue(),
				})
			);

			setCurrSuggestions(suggestions);
			setIsSuggesting(true);
			setActiveSuggestionIndex(0);
		},
		[]
	);

	const addMessageToDisplay = useCallback((message: UIMessage) => {
		const newMessage: DisplayMessage = {
			...message,
			id: crypto.randomUUID(),
			timestamp: message.timestamp || new Date(),
		};
		setUiMessages((prev) => [...prev, newMessage]);
	}, []);

	const handleSendMessage = useCallback(async () => {
		const rawInputText = inputValue.trim();
		if (!rawInputText) return;

		hideSuggestions();

		const { semanticQuery, metadataFilters } =
			parseFiltersFromPrompt(rawInputText);

		addMessageToDisplay({ sender: "user", text: rawInputText });

		if (semanticQuery) {
			setChatHistory((prev) => [
				...prev,
				{ type: "human", content: semanticQuery },
			]);
		}

		setInputValue("");
		setIsThinking(true);

		try {
			if (!plugin.settings.openAIApiKey) {
				addMessageToDisplay({
					sender: "system",
					text: "API Key not set. Please configure it in the plugin settings.",
				});
				return;
			}

			if (
				!plugin.intelligenceService ||
				!plugin.intelligenceService.getIsInitialized()
			) {
				addMessageToDisplay({
					sender: "system",
					text: "Intelligence service not initialized. Please wait or try re-initializing from plugin settings.",
				});
				return;
			}

			const historyForChain = semanticQuery
				? chatHistory.slice(0, -1)
				: [...chatHistory];

			const aiResponseText =
				await plugin.intelligenceService.processQueryWithHistory(
					semanticQuery,
					historyForChain,
					metadataFilters
				);

			if (aiResponseText) {
				addMessageToDisplay({
					sender: "ai",
					text: aiResponseText,
				});
				if (semanticQuery) {
					setChatHistory((prev) => [
						...prev,
						{ type: "ai", content: aiResponseText },
					]);
				}
			} else {
				addMessageToDisplay({
					sender: "system",
					text: "No specific answer generated. If you used filters, please check if any notes matched your criteria.",
				});
			}
		} catch (error: any) {
			console.error("Error processing query in ChatView:", error);
			addMessageToDisplay({
				sender: "system",
				text: `An error occurred: ${
					error.message || "Unknown error"
				}. Check the console for more details.`,
			});
		} finally {
			setIsThinking(false);
			inputAreaRef.current?.focus();
		}
	}, [inputValue, chatHistory, plugin, addMessageToDisplay, hideSuggestions]);

	const handleInput = useCallback(() => {
		if (!inputAreaRef.current) return;

		const cursorPos = inputAreaRef.current.selectionStart;
		const textBeforeCursor = inputValue.substring(0, cursorPos);

		const doubleBracketMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
		if (doubleBracketMatch) {
			const fileQuery = doubleBracketMatch[1];
			setIsFileMode(true);
			setFileTriggerPos(cursorPos - doubleBracketMatch[0].length);
			showFileSuggestions(fileQuery);
			return;
		}

		if (isFileMode) {
			setIsFileMode(false);
			hideSuggestions();
			return;
		}

		if (selectedFilterType) {
			showFilterValueSuggestions(selectedFilterType);
		} else {
			const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_'-]+)$/);
			const query = wordMatch ? wordMatch[1].toLowerCase() : "";

			if (query.length >= 1) {
				setSuggestionQuery(query);
				setSuggestionQueryPos(textBeforeCursor.length - query.length);
				showFilterTypeSuggestions(query);
			} else {
				hideSuggestions();
			}
		}
	}, [
		inputValue,
		isFileMode,
		selectedFilterType,
		showFileSuggestions,
		showFilterValueSuggestions,
		showFilterTypeSuggestions,
		hideSuggestions,
	]);

	const navigateSuggestions = useCallback(
		(direction: number) => {
			if (!isSuggesting || currSuggestions.length === 0) return;
			setActiveSuggestionIndex(
				(prevIndex) =>
					(prevIndex + direction + currSuggestions.length) %
					currSuggestions.length
			);
		},
		[isSuggesting, currSuggestions.length]
	);

	const selectActiveSuggestion = useCallback(() => {
		if (
			!isSuggesting ||
			activeSuggestionIndex < 0 ||
			activeSuggestionIndex >= currSuggestions.length
		) {
			hideSuggestions();
			if (inputValue.trim().length > 0 && !isThinking) {
				handleSendMessage();
			}
			return;
		}

		const selectedSuggestion = currSuggestions[activeSuggestionIndex];

		if (selectedSuggestion.type === "filterType") {
			const signature = selectedSuggestion.data as FilterSignature;
			const replacementText = signature.emoji + "{}";
			const textBeforeReplacement = inputValue.substring(
				0,
				suggestionQueryPos
			);
			const textAfterQuery = inputValue.substring(
				suggestionQueryPos + suggestionQuery.length
			);

			setInputValue(
				textBeforeReplacement +
					replacementText +
					" " +
					textAfterQuery.trimStart()
			);

			const newCursorPos =
				suggestionQueryPos + replacementText.length - 1;
			setTimeout(() => {
				if (inputAreaRef.current) {
					inputAreaRef.current.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
					inputAreaRef.current.focus();
				}
			}, 0);

			setSelectedFilterType(signature);
			hideSuggestions();
			setTimeout(handleInput, 0);
		} else if (selectedSuggestion.type === "filterValue") {
			const cursorPos = inputAreaRef.current?.selectionStart || 0;
			const valueToInsert = selectedSuggestion.data as string;

			let startReplacePos =
				inputValue.lastIndexOf("{", cursorPos - 1) + 1;
			let endReplacePos = inputValue.indexOf("}", cursorPos);

			if (
				startReplacePos === 0 ||
				endReplacePos === -1 ||
				startReplacePos > endReplacePos
			) {
				startReplacePos = cursorPos;
				endReplacePos = cursorPos;
			}

			const textBefore = inputValue.substring(0, startReplacePos);
			const textAfter = inputValue.substring(endReplacePos);

			setInputValue(textBefore + valueToInsert + textAfter);

			const newCursorPos = startReplacePos + valueToInsert.length;
			setTimeout(() => {
				if (inputAreaRef.current) {
					inputAreaRef.current.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
					inputAreaRef.current.focus();
				}
			}, 0);

			setSelectedFilterType(null);
			hideSuggestions();
		} else if (selectedSuggestion.type === "fileName") {
			const file = selectedSuggestion.data as TFile;
			const textBeforeTrigger = inputValue.substring(0, fileTriggerPos);
			const textAfterCursor = inputValue.substring(
				inputAreaRef.current?.selectionStart || 0
			);

			setInputValue(
				textBeforeTrigger +
					`[[${file.basename}]]` +
					textAfterCursor.trimStart()
			);

			const newCursorPos = fileTriggerPos + file.basename.length + 4;
			setTimeout(() => {
				if (inputAreaRef.current) {
					inputAreaRef.current.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
					inputAreaRef.current.focus();
				}
			}, 0);

			setIsFileMode(false);
			hideSuggestions();
		}
	}, [
		isSuggesting,
		activeSuggestionIndex,
		currSuggestions,
		inputValue,
		isThinking,
		suggestionQueryPos,
		suggestionQuery,
		fileTriggerPos,
		hideSuggestions,
		handleInput,
		handleSendMessage,
	]);

	const selectSuggestion = useCallback(
		(index: number) => {
			setActiveSuggestionIndex(index);
			selectActiveSuggestion();
		},
		[selectActiveSuggestion]
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (isSuggesting) {
				if (event.key === "ArrowUp") {
					event.preventDefault();
					navigateSuggestions(-1);
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					navigateSuggestions(1);
				} else if (event.key === "Enter" || event.key === "Tab") {
					event.preventDefault();
					selectActiveSuggestion();
				} else if (event.key === "Escape") {
					event.preventDefault();
					hideSuggestions();
				}
			} else {
				if (event.key === "Enter" && !event.shiftKey) {
					event.preventDefault();
					handleSendMessage();
				}
			}
		},
		[
			isSuggesting,
			navigateSuggestions,
			selectActiveSuggestion,
			hideSuggestions,
			handleSendMessage,
		]
	);

	const handleClearChat = useCallback(() => {
		setChatHistory([]);
		setSelectedFilterType(null);
		hideSuggestions();
		setUiMessages([
			{
				id: crypto.randomUUID(),
				sender: "system",
				text: "Chat cleared. Ask a new question or type filter keywords.",
				timestamp: new Date(),
			},
		]);
		inputAreaRef.current?.focus();
	}, [hideSuggestions]);

	return (
		<div className="obsidian-intelligence">
			<div className="intelligence-chat-view-container h-full flex flex-col">
				<div className="intelligence-p-4">
					<button
						onClick={handleClearChat}
						className="intelligence-px-4 intelligence-py-2 intelligence-text-sm intelligence-bg-accent intelligence-text-white intelligence-rounded hover:intelligence-bg-accent-hover intelligence-transition-colors"
						aria-label="Clear all messages from the chat"
					>
						Clear Chat
					</button>
				</div>

				<div
					ref={messagesContainerRef}
					className="intelligence-messages-container"
					role="log"
					aria-label="Chat messages"
					aria-live="polite"
				>
					{uiMessages.map((message) => (
						<div
							key={message.id}
							className={`flex w-full ${
								message.sender === "user"
									? "justify-end"
									: "justify-start"
							}`}
						>
							<div
								className={`max-w-[85%] md:max-w-[75%] rounded-lg p-4 ${
									message.sender === "user"
										? "intelligence-message-user"
										: message.sender === "ai"
										? "intelligence-message-ai"
										: "intelligence-message-system"
								}`}
							>
								<MessageRenderer
									message={message}
									app={app}
									plugin={plugin}
								/>
							</div>
						</div>
					))}
				</div>

				{isThinking && (
					<div
						className="p-4 text-center text-text-muted"
						role="status"
						aria-live="assertive"
					>
						AI is thinking...
					</div>
				)}

				<div className="relative p-4">
					<div className="flex items-stretch gap-2">
						<div className="flex-1 relative">
							<textarea
								ref={inputAreaRef}
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onInput={handleInput}
								onKeyDown={handleKeyDown}
								placeholder="Type message or filter keyword"
								className="intelligence-input-area resize-none"
								disabled={isThinking}
								aria-label="Chat input"
								aria-autocomplete="list"
								aria-haspopup={
									isSuggesting ? "listbox" : "false"
								}
								aria-controls={
									isSuggesting
										? "suggestion-popover-list"
										: undefined
								}
								aria-activedescendant={
									isSuggesting && activeSuggestionIndex !== -1
										? `suggestion-item-${activeSuggestionIndex}`
										: undefined
								}
								rows={3}
							/>

							{isSuggesting && currSuggestions.length > 0 && (
								<div
									ref={suggestionPopoverRef}
									id="suggestion-popover-list"
									role="listbox"
									aria-label="Suggestions"
									className="absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto z-50 bg-background-primary border border-background-modifier-border rounded-md shadow-lg p-1"
								>
									{currSuggestions.map(
										(suggestion, index) => (
											<button
												key={`${suggestion.displayText}-${index}`}
												type="button"
												id={`suggestion-item-${index}`}
												role="option"
												aria-selected={
													index ===
													activeSuggestionIndex
												}
												className={`intelligence-suggestion-item ${
													index ===
													activeSuggestionIndex
														? "active"
														: ""
												}`}
												onClick={() =>
													selectSuggestion(index)
												}
												onMouseEnter={() =>
													setActiveSuggestionIndex(
														index
													)
												}
											>
												{suggestion.displayText}
											</button>
										)
									)}
								</div>
							)}
						</div>
						<div className="flex-shrink-0">
							<button
								onClick={handleSendMessage}
								disabled={isThinking || !inputValue.trim()}
								className="px-6 py-2 border-2 border-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-full"
								aria-label="Send message"
							>
								Send
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatViewComponent;
