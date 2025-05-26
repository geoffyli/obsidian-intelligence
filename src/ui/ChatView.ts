// src/ui/ChatView.ts
import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	MarkdownRenderer,
	OpenViewState,
	// Editor,
	// EditorPosition,
	TFile,
	// App,
} from "obsidian";
import ObsidianRAGPlugin from "../main";
import { CHATVIEW_WELCOME_MESSAGE, VIEW_TYPE_RAG_CHAT } from "../constants";
import { UIMessage, LangChainChatMessage } from "../types";
import {
	AVAILABLE_FILTERS,
	FilterSignature,
	// findFilterByEmoji,
} from "../filters"; // findFilterByEmoji might be useful later
import { parseFiltersFromPrompt } from "../parser";

// --- Suggestion Types ---
interface SuggestionItem {
	type: "filterType" | "filterValue" | "fileName";
	data: FilterSignature | string | TFile; // FilterSignature, string, or TFile for file suggestions
	displayText: string;
}

export class ChatView extends ItemView {
	plugin: ObsidianRAGPlugin;
	private messagesContainer!: HTMLDivElement;
	public inputArea!: HTMLTextAreaElement;
	private sendButton!: HTMLButtonElement;
	private thinkingIndicator!: HTMLDivElement;
	private clearChatButton!: HTMLButtonElement;
	private chatHistory: LangChainChatMessage[] = [];
	// Custom Suggestion Popover Elements and State ---
	private suggestionPopover!: HTMLDivElement;
	private currSuggestions: SuggestionItem[] = [];
	private activeSuggestionIndex = -1;
	private isSuggesting = false;
	// State for multi-stage suggestions
	private selectedFilterType: FilterSignature | null = null;
	private suggestionQuery = ""; // Store the query that triggered suggestions
	private suggestionQueryPos = 0; // Store start pos of the query
	// File suggestion state
	private isFileMode = false;
	private fileTriggerPos = 0;
	// --- End Custom Suggestion Popover ---

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianRAGPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.icon = "messages-square";
	}

	getViewType(): string {
		return VIEW_TYPE_RAG_CHAT;
	}
	getDisplayText(): string {
		return "RAG Chat";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("rag-chat-view-container");

		// Header part
		const headerControls = container.createDiv({
			cls: "rag-chat-header-controls",
		});
		this.clearChatButton = headerControls.createEl("button", {
			text: "Clear Chat",
			cls: "rag-chat-clear-button",
		});
		this.clearChatButton.addEventListener(
			"click",
			this.handleClearChat.bind(this)
		);
		// Message part
		this.messagesContainer = container.createDiv({
			cls: "rag-messages-container",
		});
		this.thinkingIndicator = container.createDiv({
			cls: "rag-thinking-indicator",
			text: "AI is thinking...",
		});
		this.thinkingIndicator.style.display = "none";
		// Input part
		const inputWrapper = container.createDiv({ cls: "rag-input-wrapper" });
		this.inputArea = inputWrapper.createEl("textarea", {
			cls: "rag-chat-input",
			attr: {
				placeholder:
					"Type message or filter keyword (e.g., 'created today')...",
			},
		});
		// Suggestion popover
		this.suggestionPopover = inputWrapper.createDiv({
			cls: "rag-suggestion-popover",
		});
		this.suggestionPopover.style.display = "none";

		this.sendButton = inputWrapper.createEl("button", {
			text: "Send",
			cls: "rag-chat-send-button",
		});
		this.sendButton.addEventListener(
			"click",
			this.handleSendMessage.bind(this)
		);
		this.inputArea.addEventListener(
			"input",
			this.handleSuggestionDisplay.bind(this)
		);
		this.inputArea.addEventListener(
			"keydown",
			this.handleInputKeyDown.bind(this)
		);

		this.messagesContainer.addEventListener(
			"click",
			this.handleMessageContainerClick.bind(this)
		);

		const welcomeMessage = CHATVIEW_WELCOME_MESSAGE;
		this.addMessageToDisplay({ sender: "system", text: welcomeMessage });

		this.registerDomEvent(document, "click", (evt) => {
			if (
				!this.inputArea.contains(evt.target as Node) &&
				!this.suggestionPopover.contains(evt.target as Node)
			) {
				this.hideSuggestions();
			}
		});
	}

	/**
	 * Get file suggestions based on query string
	 * @param query - The search query for file basenames
	 * @returns Array of TFile objects sorted by creation time
	 */
	private getFileSuggestions(query = ""): TFile[] {
		const allFiles = this.app.vault.getFiles()
			.filter(file => file.extension === "md");
		
		if (!query) {
			// Return recently created files
			return allFiles
				.sort((a, b) => b.stat.ctime - a.stat.ctime)
				.slice(0, 7);
		}
		
		// Return prefix-matched files
		return allFiles
			.filter(file => file.basename.toLowerCase().startsWith(query.toLowerCase()))
			.sort((a, b) => b.stat.ctime - a.stat.ctime)
			.slice(0, 7);
	}

	private handleSuggestionDisplay(event: Event): void {
		const inputText = this.inputArea.value;
		const cursorPos = this.inputArea.selectionStart;
		const textBeforeCursor = inputText.substring(0, cursorPos);

		// Check for [[ trigger for file suggestions
		const doubleBracketMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
		if (doubleBracketMatch) {
			const fileQuery = doubleBracketMatch[1];
			this.isFileMode = true;
			this.fileTriggerPos = cursorPos - doubleBracketMatch[0].length;
			this.showFileSuggestions(fileQuery);
			return;
		}

		// Reset file mode if not in [[ context
		if (this.isFileMode) {
			this.isFileMode = false;
			this.hideSuggestions();
			return;
		}

		/*
		If the user has selected a filter type, we expect them to type a value for that filter.
		Else, we check the last word before the cursor to determine if they are typing a filter keyword.
		*/
		if (this.selectedFilterType) {
			this.showFilterValueSuggestions(this.selectedFilterType);
		} else {
			// Get the last word before the cursor
			const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_'-]+)$/); // Or a more general trigger
			const query = wordMatch ? wordMatch[1].toLowerCase() : "";

			if (query.length >= 1) {
				this.suggestionQuery = query;
				this.suggestionQueryPos =
					textBeforeCursor.length - query.length;
				this.showFilterTypeSuggestions(query);
			} else {
				this.hideSuggestions();
			}
		}
	}

	private handleInputKeyDown(event: KeyboardEvent): void {
		if (this.isSuggesting) {
			if (event.key === "ArrowUp") {
				event.preventDefault();
				this.navigateSuggestions(-1);
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				this.navigateSuggestions(1);
			} else if (event.key === "Enter" || event.key === "Tab") {
				event.preventDefault();
				this.selectActiveSuggestion();
			} else if (event.key === "Escape") {
				event.preventDefault();
				this.hideSuggestions();
			}
		} else {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.handleSendMessage();
			}
		}
	}

	/**
	 * Generating and displaying a list of relevant metadata filter type suggestions
	 * based on user's current typing
	 * @param query last word typed by the user
	 */
	private showFilterTypeSuggestions(query: string): void {
		// Check if the query is a filter emoji
		this.currSuggestions = AVAILABLE_FILTERS.filter((sig) =>
			sig.triggerKeywords.some((keyword) =>
				keyword.toLowerCase().startsWith(query)
			)
		)
			.map((sig) => ({
				type: "filterType" as const, // Added 'as const'
				data: sig,
				displayText: sig.suggestionDisplay,
			}))
			.slice(0, 7); // Limit to 7 suggestions

		// If user is typing a filter keyword, add it as a direct suggestion
		if (this.currSuggestions.length > 0) {
			this.displaySuggestions();
		} else {
			this.hideSuggestions();
		}
	}

	/**
	 * Show file suggestions based on the query
	 * @param query - The search query for file basenames
	 */
	private showFileSuggestions(query: string): void {
		const files = this.getFileSuggestions(query);
		this.currSuggestions = files.map(file => ({
			type: "fileName" as const,
			data: file,
			displayText: file.basename
		}));
		
		this.displaySuggestions();
	}

	private showFilterValueSuggestions(filterSig: FilterSignature): void {
		this.currSuggestions = Object.entries(filterSig.valueSuggestions).map(
			([displayText, getValue]) => ({
				type: "filterValue",
				displayText,
				data: getValue(),
			})
		);

		// If user is typing a date like YYYY-MM-DD, add it as a direct suggestion
		// if (/^\d{4}(-\d{0,2}(-\d{0,2})?)?$/.test(query) && query.length >= 4) {
		// 	// Check if it's already perfectly matched by a placeholder or other suggestions
		// 	const alreadyExists = this.currSuggestions.some(
		// 		(s) => (s.data as DateValueSuggestion).key === query
		// 	);
		// 	if (!alreadyExists) {
		// 		this.currSuggestions.unshift({
		// 			// Add to the top
		// 			type: "filterValue",
		// 			data: {
		// 				key: query,
		// 				displayText: `Use date: ${query}`,
		// 				isPlaceholder: false,
		// 			},
		// 			displayText: `Use date: ${query}`,
		// 		});
		// 	}
		// }

		this.displaySuggestions();
		// if (this.currSuggestions.length > 0) {
		// 	this.displaySuggestions();
		// } else {
		// 	// Even if no direct matches, if expecting date, keep popover for manual YYYY-MM-DD
		// 	this.currSuggestions = [
		// 		{
		// 			type: "filterValue",
		// 			data: {
		// 				key: "yyyy-mm-dd",
		// 				displayText: "Format: YYYY-MM-DD",
		// 				isPlaceholder: true,
		// 			},
		// 			displayText: "Format: YYYY-MM-DD (type specific date)",
		// 		},
		// 	];
		// 	this.displaySuggestions(true); // Pass true if we want to show even if only placeholder
		// }
	}

	private displaySuggestions(): void {
		if (this.currSuggestions.length > 0) {
			this.isSuggesting = true;
			this.activeSuggestionIndex = 0;
			this.renderSuggestionItems();
			this.suggestionPopover.style.display = "block";
			this.suggestionPopover.style.top = `${
				this.inputArea.offsetTop + this.inputArea.offsetHeight
			}px`;
			this.suggestionPopover.style.left = `${this.inputArea.offsetLeft}px`;
			this.suggestionPopover.style.width = `${this.inputArea.offsetWidth}px`;
		} else {
			this.hideSuggestions();
		}
	}

	private hideSuggestions(): void {
		this.isSuggesting = false;
		this.suggestionPopover.style.display = "none";
		this.suggestionPopover.empty();
		this.currSuggestions = [];
		this.activeSuggestionIndex = -1;
		// Reset file mode state
		this.isFileMode = false;
		this.fileTriggerPos = 0;
		if (
			this.selectedFilterType &&
			!this.inputArea.value.includes(this.selectedFilterType.emoji + " ")
		) {
			// If we were expecting a value but user bailed, clear the expectation
			// This might happen if user deletes the emoji after it was inserted
			// this.selectedFilterType = null; // Be careful with this, might clear too early
		}
	}

	private renderSuggestionItems(): void {
		this.suggestionPopover.empty();
		this.currSuggestions.forEach((suggestionItem, index) => {
			const itemEl = this.suggestionPopover.createDiv({
				cls: "rag-suggestion-item",
			});
			itemEl.setText(suggestionItem.displayText);
			if (index === this.activeSuggestionIndex) {
				itemEl.addClass("is-selected");
			}
			itemEl.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.activeSuggestionIndex = index;
				this.selectActiveSuggestion();
			});
		});
	}

	private navigateSuggestions(direction: number): void {
		// ... (unchanged)
		if (!this.isSuggesting || this.currSuggestions.length === 0) return;
		this.activeSuggestionIndex += direction;
		if (this.activeSuggestionIndex < 0) {
			this.activeSuggestionIndex = this.currSuggestions.length - 1;
		} else if (this.activeSuggestionIndex >= this.currSuggestions.length) {
			this.activeSuggestionIndex = 0;
		}
		this.renderSuggestionItems();
	}

	private selectActiveSuggestion(): void {
		// When the suggestion popover not active or no active suggestion
		if (
			!this.isSuggesting ||
			this.activeSuggestionIndex < 0 ||
			this.activeSuggestionIndex >= this.currSuggestions.length
		) {
			this.hideSuggestions();
			// If the input area has text and no active suggestion, send the message
			if (
				this.inputArea.value.trim().length > 0 &&
				!this.currSuggestions[this.activeSuggestionIndex]
			) {
				this.handleSendMessage();
			}
			return;
		}

		const inputAreaText = this.inputArea.value;
		const selectedSuggestion =
			this.currSuggestions[this.activeSuggestionIndex];

		if (selectedSuggestion.type === "filterType") {
			const queryStartPos = this.suggestionQueryPos;
			const signature = selectedSuggestion.data as FilterSignature;
			const replacementText = signature.emoji + "{}"; // The replacement text is the emoji + {}
			const textAfterQuery = inputAreaText.substring(
				queryStartPos + this.suggestionQuery.length
			);

			this.inputArea.value =
				inputAreaText.substring(0, queryStartPos) +
				replacementText +
				" " +
				textAfterQuery;
			// Set the new cursor position
			const newCursorPos = queryStartPos + replacementText.length - 1; // Before the closing }
			this.inputArea.setSelectionRange(newCursorPos, newCursorPos);

			this.selectedFilterType = signature;
			this.inputArea.focus(); // Keep focus to trigger input event for date suggestions
			this.handleSuggestionDisplay(new Event("input")); // Trigger value suggestions
		} else if (selectedSuggestion.type === "filterValue") {
			const cursorPos = this.inputArea.selectionStart;
			const valueToInsert = selectedSuggestion.data as string;

			this.inputArea.value =
				inputAreaText.substring(0, cursorPos) +
				valueToInsert +
				inputAreaText.substring(cursorPos);
			// Set the new cursor position
			const newCursorPos =
				valueToInsert.length == 0
					? cursorPos
					: cursorPos + valueToInsert.length + 2; // After the value and the closing space
			this.inputArea.setSelectionRange(newCursorPos, newCursorPos);

			this.selectedFilterType = null; // Done with this filter
			this.hideSuggestions();
			this.inputArea.focus();
		} else if (selectedSuggestion.type === "fileName") {
			const file = selectedSuggestion.data as TFile;
			const cursorPos = this.inputArea.selectionStart;
			
			// Replace [[ + partial text with [[filename]]
			const beforeTrigger = inputAreaText.substring(0, this.fileTriggerPos);
			const afterCursor = inputAreaText.substring(cursorPos);
			
			this.inputArea.value = beforeTrigger + `[[${file.basename}]]` + afterCursor;
			const newCursorPos = this.fileTriggerPos + file.basename.length + 4; // After ]]
			this.inputArea.setSelectionRange(newCursorPos, newCursorPos);
			
			this.isFileMode = false;
			this.hideSuggestions();
			this.inputArea.focus();
		}
	}

	private handleMessageContainerClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		if (
			target.tagName === "A" &&
			target.classList.contains("internal-link")
		) {
			event.preventDefault();
			const href =
				target.getAttribute("data-href") || target.getAttribute("href");
			if (href) {
				this.app.workspace
					.openLinkText(href, "", "tab", {
						active: true,
					} as OpenViewState)
					.catch((err) => {
						console.error(`Error opening link: ${href}`, err);
						new Notice(`Could not open note: ${href}`);
					});
			}
		}
	}

	private async addMessageToDisplay(message: UIMessage) {
		// ... (unchanged)
		const messageElWrapper = this.messagesContainer.createDiv({
			cls: `rag-message-wrapper rag-message-wrapper-${message.sender}`,
		});
		const messageEl = messageElWrapper.createDiv({
			cls: `rag-message rag-message-${message.sender}`,
		});
		await MarkdownRenderer.render(
			this.app,
			message.text,
			messageEl,
			this.plugin.manifest.dir || "",
			this
		);
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		return messageEl;
	}

	private handleClearChat() {
		this.chatHistory = [];
		this.selectedFilterType = null; // Reset filter expectation
		this.hideSuggestions();
		this.messagesContainer.empty();
		const welcomeMessage =
			"Chat cleared. Ask a new question or type filter keywords.";
		this.addMessageToDisplay({ sender: "system", text: welcomeMessage });
		new Notice("Chat history cleared.");
	}

	private async handleSendMessage() {
		const rawInputText = this.inputArea.value.trim();
		if (!rawInputText) {
			if (!this.isSuggesting) new Notice("Please type a message.");
			return;
		}
		this.hideSuggestions();

		const { semanticQuery, metadataFilters } =
			parseFiltersFromPrompt(rawInputText);

		this.addMessageToDisplay({ sender: "user", text: rawInputText });

		if (semanticQuery) {
			this.chatHistory.push({ type: "human", content: semanticQuery });
		}

		this.inputArea.value = "";
		this.inputArea.focus();

		this.thinkingIndicator.style.display = "flex";
		this.sendButton.disabled = true;
		// this.inputArea.disabled = true;

		try {
			// Check if the API key is set and RAG service is initialized
			if (!this.plugin.settings.openAIApiKey) {
				this.addMessageToDisplay({
					sender: "system",
					text: "API Key not set.",
				});
				this.thinkingIndicator.style.display = "none";
				this.sendButton.disabled = false;
				this.inputArea.disabled = false;
				return;
			}
			if (!this.plugin.ragService.getIsInitialized()) {
				this.addMessageToDisplay({
					sender: "system",
					text: "RAG service not initialized. Please wait or re-initialize.",
				});
				this.thinkingIndicator.style.display = "none";
				this.sendButton.disabled = false;
				this.inputArea.disabled = false;
				return;
			}

			const historyForChain = semanticQuery
				? this.chatHistory.slice(0, -1)
				: [];

			const aiResponseText =
				await this.plugin.ragService.processQueryWithHistory(
					semanticQuery,
					historyForChain,
					metadataFilters
				);

			if (aiResponseText) {
				this.addMessageToDisplay({
					sender: "ai",
					text: aiResponseText,
				});
				if (semanticQuery) {
					this.chatHistory.push({
						type: "ai",
						content: aiResponseText,
					});
				}
			} else {
				this.addMessageToDisplay({
					sender: "system",
					text: "No specific answer generated. If you used filters, check if any notes matched.",
				});
			}
		} catch (error) {
			console.error("Error processing query in ChatView:", error);
			this.addMessageToDisplay({
				sender: "system",
				text: `Error: ${(error as Error).message}`,
			});
		} finally {
			this.thinkingIndicator.style.display = "none";
			this.sendButton.disabled = false;
			this.inputArea.disabled = false;
			this.inputArea.focus();
		}
	}

	async onClose() {
		console.log("RAG ChatView closed");
	}
}
