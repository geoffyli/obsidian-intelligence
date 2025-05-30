<script lang="ts">
	import { MarkdownRenderer } from "obsidian";
	import { onMount, tick } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Menubar from "$lib/components/ui/menubar";
	import { Card, CardContent } from "$lib/components/ui/card"; // Import shadcn-svelte Card components
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import type { App, TFile, MarkdownRenderer } from "obsidian";
	import type ObsidianRAGPlugin from "../main";
	import type { UIMessage, LangChainChatMessage } from "../types";
	import { CHATVIEW_WELCOME_MESSAGE } from "../constants";
	import { AVAILABLE_FILTERS } from "../filters";
	import type { FilterSignature } from "../filters";
	import { parseFiltersFromPrompt } from "../parser";

	export let plugin: ObsidianRAGPlugin;
	export let app: App;

	interface SuggestionItem {
		type: "filterType" | "filterValue" | "fileName";
		data: FilterSignature | string | TFile;
		displayText: string;
	}

	// Interface for messages displayed in the UI, extending UIMessage with an id
	interface DisplayMessage extends UIMessage {
		id: string;
	}

	// interface ActiveInputFilterPill {
	//     id: string;
	//     filterSignature: FilterSignature;
	//     value: string;
	//     displayText: string;
	//     element: HTMLElement;
	// }

	let messagesContainer: HTMLDivElement;
	let inputArea: Textarea;
	let suggestionPopover: HTMLDivElement;
	let chatHistory: LangChainChatMessage[] = [];
	let uiMessages: DisplayMessage[] = []; // For displaying messages in the UI
	let inputValue = "";
	let isThinking = false;
	let isSuggesting = false;
	let currSuggestions: SuggestionItem[] = [];
	let activeSuggestionIndex = -1;
	let selectedFilterType: FilterSignature | null = null;
	let suggestionQuery = "";
	let suggestionQueryPos = 0;
	let isFileMode = false;
	let fileTriggerPos = 0;
	// let activeInputPills: ActiveInputFilterPill[] = []; // Unused

	onMount(() => {
		// TODO: Set welcome message in background
		addMessageToDisplay({
			sender: "system",
			text: CHATVIEW_WELCOME_MESSAGE,
		});
		document.addEventListener("click", handleDocumentClick);

		return () => {
			document.removeEventListener("click", handleDocumentClick);
		};
	});

	function handleDocumentClick(evt: MouseEvent) {
		if (
			inputArea &&
			!inputArea.contains(evt.target as Node) &&
			suggestionPopover &&
			!suggestionPopover.contains(evt.target as Node)
		) {
			hideSuggestions();
		}
	}

	function getFileSuggestions(query = ""): TFile[] {
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
				file.basename.toLowerCase().startsWith(query.toLowerCase()),
			)
			.sort((a, b) => b.stat.ctime - a.stat.ctime)
			.slice(0, 7);
	}

	function handleInput() {
		const cursorPos = inputArea.selectionStart;
		const textBeforeCursor = inputValue.substring(0, cursorPos);

		const doubleBracketMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
		if (doubleBracketMatch) {
			const fileQuery = doubleBracketMatch[1];
			isFileMode = true;
			fileTriggerPos = cursorPos - doubleBracketMatch[0].length;
			showFileSuggestions(fileQuery);
			return;
		}

		if (isFileMode) {
			isFileMode = false;
			hideSuggestions();
			// If we were in file mode and now we are not, we might want to re-evaluate for filter suggestions
			// For now, just hiding is fine, but consider if filter suggestions should appear immediately.
			return;
		}

		if (selectedFilterType) {
			showFilterValueSuggestions(selectedFilterType);
		} else {
			const wordMatch = textBeforeCursor.match(/([a-zA-Z0-9_'-]+)$/);
			const query = wordMatch ? wordMatch[1].toLowerCase() : "";

			if (query.length >= 1) {
				suggestionQuery = query;
				suggestionQueryPos = textBeforeCursor.length - query.length;
				showFilterTypeSuggestions(query);
			} else {
				hideSuggestions();
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
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
	}

	function showFilterTypeSuggestions(query: string) {
		currSuggestions = AVAILABLE_FILTERS.filter((sig) =>
			sig.triggerKeywords.some((keyword) =>
				keyword.toLowerCase().startsWith(query),
			),
		)
			.map((sig) => ({
				type: "filterType" as const,
				data: sig,
				displayText: sig.suggestionDisplay,
			}))
			.slice(0, 7);

		if (currSuggestions.length > 0) {
			displaySuggestions();
		} else {
			hideSuggestions();
		}
	}

	function showFileSuggestions(query: string) {
		const files = getFileSuggestions(query);
		currSuggestions = files.map((file) => ({
			type: "fileName" as const,
			data: file,
			displayText: file.basename,
		}));

		displaySuggestions();
	}

	function showFilterValueSuggestions(filterSig: FilterSignature) {
		currSuggestions = Object.entries(filterSig.valueSuggestions).map(
			([displayText, getValue]) => ({
				type: "filterValue",
				displayText,
				data: getValue(), // Assuming getValue returns a string
			}),
		);

		displaySuggestions();
	}

	function displaySuggestions() {
		if (currSuggestions.length > 0) {
			isSuggesting = true;
			activeSuggestionIndex = 0; // Reset to the first suggestion
		} else {
			hideSuggestions();
		}
	}

	function hideSuggestions() {
		isSuggesting = false;
		currSuggestions = [];
		activeSuggestionIndex = -1;
		// Reset file mode related states only if they are exclusively tied to suggestions
		// isFileMode = false; // This might be better handled in handleInput or selectActiveSuggestion
		// fileTriggerPos = 0;
	}

	function navigateSuggestions(direction: number) {
		if (!isSuggesting || currSuggestions.length === 0) return;
		activeSuggestionIndex =
			(activeSuggestionIndex + direction + currSuggestions.length) %
			currSuggestions.length;
	}

	function selectActiveSuggestion() {
		if (
			!isSuggesting ||
			activeSuggestionIndex < 0 ||
			activeSuggestionIndex >= currSuggestions.length
		) {
			hideSuggestions();
			if (inputValue.trim().length > 0 && !isThinking) {
				// Check !isThinking before sending
				handleSendMessage();
			}
			return;
		}

		const selectedSuggestion = currSuggestions[activeSuggestionIndex];

		if (selectedSuggestion.type === "filterType") {
			const queryStartPos = suggestionQueryPos;
			const signature = selectedSuggestion.data as FilterSignature;
			const replacementText = signature.emoji + "{}"; // Emoji and placeholder for value
			const textBeforeReplacement = inputValue.substring(
				0,
				queryStartPos,
			);
			const textAfterQuery = inputValue.substring(
				queryStartPos + suggestionQuery.length,
			);

			inputValue =
				textBeforeReplacement +
				replacementText +
				" " +
				textAfterQuery.trimStart();

			const newCursorPos = queryStartPos + replacementText.length - 1; // Cursor inside {}

			tick().then(() => {
				if (inputArea) {
					inputArea.setSelectionRange(newCursorPos, newCursorPos);
					inputArea.focus();
				}
			});

			selectedFilterType = signature;
			// Trigger input handling again to show value suggestions if any
			// Ensure suggestions are hidden first to avoid race conditions
			hideSuggestions(); // Hide current filter type suggestions
			handleInput(); // This will call showFilterValueSuggestions
		} else if (selectedSuggestion.type === "filterValue") {
			const cursorPos = inputArea.selectionStart; // This should be the position within {}
			const valueToInsert = selectedSuggestion.data as string;

			// Find the placeholder {} relative to the current cursor
			// This logic assumes the cursor is right before the '}' of an empty '{}'
			// or at the start of the value if one was partially typed.
			// A more robust way would be to find the opening '{' of the current filter.
			let startReplacePos =
				inputValue.lastIndexOf("{", cursorPos - 1) + 1;
			let endReplacePos = inputValue.indexOf("}", cursorPos);

			if (
				startReplacePos === 0 ||
				endReplacePos === -1 ||
				startReplacePos > endReplacePos
			) {
				// Fallback or error: couldn't find filter braces, insert at cursor
				startReplacePos = cursorPos;
				endReplacePos = cursorPos;
			}

			const textBefore = inputValue.substring(0, startReplacePos);
			const textAfter = inputValue.substring(endReplacePos);

			inputValue = textBefore + valueToInsert + textAfter;

			const newCursorPos = startReplacePos + valueToInsert.length;

			tick().then(() => {
				if (inputArea) {
					inputArea.setSelectionRange(newCursorPos, newCursorPos);
					inputArea.focus();
				}
			});

			selectedFilterType = null; // Filter value selected, so reset selectedFilterType
			hideSuggestions();
		} else if (selectedSuggestion.type === "fileName") {
			const file = selectedSuggestion.data as TFile;
			// cursorPos is not reliable here if user typed more after [[
			const textBeforeTrigger = inputValue.substring(0, fileTriggerPos);
			const textAfterTriggerAndQuery = inputValue.substring(
				inputArea.selectionStart,
			); // Text after the current cursor

			inputValue =
				textBeforeTrigger +
				`[[${file.basename}]]` +
				textAfterTriggerAndQuery.trimStart();
			const newCursorPos = fileTriggerPos + file.basename.length + 4; // After "[[basename]]"

			tick().then(() => {
				if (inputArea) {
					inputArea.setSelectionRange(newCursorPos, newCursorPos);
					inputArea.focus();
				}
			});

			isFileMode = false;
			hideSuggestions();
		}
	}

	function selectSuggestion(index: number) {
		activeSuggestionIndex = index;
		selectActiveSuggestion();
	}

	/**
	 * Handles activation of internal links (click or keyboard).
	 * This function is attached to individual <a> tags.
	 */
	function handleInternalLinkActivation(event: Event) {
		const targetLink = event.currentTarget as HTMLAnchorElement; // currentTarget is the link

		event.preventDefault(); // Prevent default link navigation
		const href = targetLink.dataset.href || targetLink.getAttribute("href");

		if (href) {
			app.workspace
				.openLinkText(href, "", "tab", { active: true } as any)
				.catch((err: any) => {
					console.error(`Error opening link: ${href}`, err);
					// Optionally, inform the user via a system message in chat
					addMessageToDisplay({
						sender: "system",
						text: `Could not open link: ${href}. See console for details.`,
					});
				});
		}
	}

	/**
	 * Svelte action to render markdown and attach link handlers.
	 */
	async function renderMarkdownAction(
		node: HTMLElement,
		params: { text: string; app: App; plugin: ObsidianRAGPlugin },
	) {
		const { text, app: appInstance, plugin: pluginInstance } = params;
		// Clear previous content
		node.innerHTML = "";

		// Render markdown
		await MarkdownRenderer.render(
			appInstance,
			text,
			node,
			pluginInstance.manifest.dir || "",
			pluginInstance as any,
		);

		// Attach listeners to internal links
		const internalLinks = node.querySelectorAll("a.internal-link");
		internalLinks.forEach((linkElement) => {
			const link = linkElement as HTMLAnchorElement;
			if (!link.hasAttribute("tabindex")) {
				link.setAttribute("tabindex", "0");
			}
			// Basic check to prevent duplicate listeners if action re-runs on same node without full destroy/recreate
			if (!(link as any).__hasRagLinkListeners) {
				link.addEventListener("click", handleInternalLinkActivation);
				link.addEventListener(
					"keydown",
					(keyboardEvent: KeyboardEvent) => {
						if (
							keyboardEvent.key === "Enter" ||
							keyboardEvent.key === "Space"
						) {
							handleInternalLinkActivation(keyboardEvent);
						}
					},
				);
				(link as any).__hasRagLinkListeners = true;
			}
		});

		return {
			async update(newParams: {
				text: string;
				app: App;
				plugin: ObsidianRAGPlugin;
			}) {
				node.innerHTML = ""; // Clear previous content before re-rendering
				await MarkdownRenderer.render(
					newParams.app,
					newParams.text,
					node,
					newParams.plugin.manifest.dir || "",
					newParams.plugin as any,
				);
				const newInternalLinks =
					node.querySelectorAll("a.internal-link");
				newInternalLinks.forEach((linkElement) => {
					const link = linkElement as HTMLAnchorElement;
					if (!link.hasAttribute("tabindex")) {
						link.setAttribute("tabindex", "0");
					}
					if (!(link as any).__hasRagLinkListeners) {
						link.addEventListener(
							"click",
							handleInternalLinkActivation,
						);
						link.addEventListener(
							"keydown",
							(keyboardEvent: KeyboardEvent) => {
								if (
									keyboardEvent.key === "Enter" ||
									keyboardEvent.key === "Space"
								) {
									handleInternalLinkActivation(keyboardEvent);
								}
							},
						);
						(link as any).__hasRagLinkListeners = true;
					}
				});
			},
			destroy() {
				// Svelte typically handles listener removal for simple cases.
				// If complex listeners were added, cleanup here.
				const internalLinks = node.querySelectorAll("a.internal-link");
				internalLinks.forEach((linkElement) => {
					const link = linkElement as HTMLAnchorElement;
					link.removeEventListener(
						"click",
						handleInternalLinkActivation,
					);
					// Note: Removing specific keydown listener is harder without storing the function reference.
					// However, Svelte's DOM node removal should also clean this up.
					delete (link as any).__hasRagLinkListeners;
				});
			},
		};
	}

	/**
	 * Adds a message to the uiMessages array for display.
	 */
	function addMessageToDisplay(message: UIMessage) {
		const newMessage: DisplayMessage = {
			...message,
			id: crypto.randomUUID(), // Generate unique ID for Svelte's keyed #each
		};
		uiMessages = [...uiMessages, newMessage];
		// Scrolling is handled by the afterUpdate lifecycle function
	}

	function handleClearChat() {
		chatHistory = [];
		selectedFilterType = null;
		hideSuggestions();
		if (messagesContainer) {
			messagesContainer.innerHTML = ""; // Clears all messages and their event listeners
		}
		addMessageToDisplay({
			sender: "system",
			text: "Chat cleared. Ask a new question or type filter keywords.",
		});
		if (inputArea) inputArea.focus();
	}

	async function handleSendMessage() {
		const rawInputText = inputValue.trim();
		if (!rawInputText) {
			return;
		}

		hideSuggestions(); // Ensure suggestions are hidden before sending

		// Parse filters and semantic query from the raw input
		const { semanticQuery, metadataFilters } =
			parseFiltersFromPrompt(rawInputText);

		// Display the user's full message, including any filter syntax
		await addMessageToDisplay({ sender: "user", text: rawInputText });

		// Add only the semantic part to chat history for the LLM
		if (semanticQuery) {
			chatHistory.push({ type: "human", content: semanticQuery });
		}

		inputValue = ""; // Clear the input field
		isThinking = true;

		try {
			if (!plugin.settings.openAIApiKey) {
				await addMessageToDisplay({
					sender: "system",
					text: "API Key not set. Please configure it in the plugin settings.",
				});
				return; // Early return
			}

			if (!plugin.ragService || !plugin.ragService.getIsInitialized()) {
				await addMessageToDisplay({
					sender: "system",
					text: "RAG service not initialized. Please wait or try re-initializing from plugin settings.",
				});
				return; // Early return
			}

			// Use chat history for context, excluding the current human message if it's part of semanticQuery
			const historyForChain = semanticQuery
				? chatHistory.slice(0, -1)
				: [...chatHistory];

			const aiResponseText =
				await plugin.ragService.processQueryWithHistory(
					semanticQuery, // This can be an empty string if only filters are used
					historyForChain,
					metadataFilters,
				);

			if (aiResponseText) {
				await addMessageToDisplay({
					sender: "ai",
					text: aiResponseText,
				});
				// Add AI response to chat history if there was a semantic query
				// If only filters were used, AI response might be a summary or confirmation,
				// decide if that should go into history for future semantic queries.
				// For now, only add if there was a semantic query.
				if (semanticQuery) {
					chatHistory.push({
						type: "ai",
						content: aiResponseText,
					});
				}
			} else {
				// Handle cases where no specific text response is generated
				// This might happen if only filters were used and they found results,
				// but the RAG service doesn't generate a textual summary for that.
				// Or if no documents matched the filters.
				await addMessageToDisplay({
					sender: "system",
					text: "No specific answer generated. If you used filters, please check if any notes matched your criteria. The context might have been updated based on your filters.",
				});
			}
		} catch (error: any) {
			console.error("Error processing query in ChatView:", error);
			await addMessageToDisplay({
				sender: "system",
				text: `An error occurred: ${error.message || "Unknown error"}. Check the console for more details.`,
			});
		} finally {
			isThinking = false;
			tick().then(() => {
				if (inputArea) inputArea.focus();
			});
		}
	}

	// Removed handleMessageClick as its logic is now in handleInternalLinkActivation
	// and listeners are attached directly to links.
</script>

<div class="obsidian-rag-plugin my-plugin-root rag-chat-view-container h-full flex flex-col">
	<!-- Header with controls -->
	<div class="rag-chat-header-controls p-4">
		<Button
			variant="outline"
			size="sm"
			on:click={handleClearChat}
			class="rag-chat-clear-button"
			aria-label="Clear all messages from the chat"
		>
			Clear Chat
		</Button>
	</div>

	<!-- Message Container-->
	<div
		class="rag-messages-container flex-1 overflow-y-auto p-4 space-y-4"
		bind:this={messagesContainer}
		role="log"
		aria-label="Chat messages"
		aria-live="polite"
		aria-relevant="additions text"
	>
		{#each uiMessages as message (message.id)}
			<div
				class="flex w-full {message.sender === 'user'
					? 'justify-end'
					: 'justify-start'}"
			>
				<Card
					class="message-card max-w-[85%] md:max-w-[75%] rounded-lg shadow-sm
                    {message.sender === 'user'
						? 'bg-primary text-primary-foreground rounded-br-none'
						: message.sender === 'ai'
							? 'bg-muted text-muted-foreground rounded-bl-none'
							: 'bg-secondary text-secondary-foreground text-center py-2'}"
				>
					<CardContent class="text-sm leading-relaxed">
						<div
							use:renderMarkdownAction={{
								text: message.text,
								app,
								plugin,
							}}
							class="markdown-rendered-content"
						></div>
					</CardContent>
				</Card>
			</div>
		{/each}
	</div>

	<!-- Status indicator -->
	{#if isThinking}
		<div
			class="rag-thinking-indicator p-4 text-center text-muted-foreground"
			role="status"
			aria-live="assertive"
		>
			AI is thinking...
		</div>
	{/if}

	<!-- Text area and send button -->
	<div class="rag-input-wrapper relative pt-2">
		<div class="flex items-stretch gap-2">
			<div class="input-area flex-1 relative">
				<Textarea
					bind:this={inputArea}
					bind:value={inputValue}
					bind:textareaRef={inputArea}
					on:input={handleInput}
					on:keydown={handleKeyDown}
					placeholder="Type message or filter keyword"
					class="w-full p-3 border bg-background text-foreground rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
					disabled={isThinking}
					aria-label="Chat input"
					aria-autocomplete="list"
					aria-haspopup={isSuggesting && currSuggestions.length > 0
						? 'listbox'
						: 'false'}
					aria-controls={isSuggesting && currSuggestions.length > 0
						? 'suggestion-popover-list'
						: undefined}
					aria-activedescendant={isSuggesting &&
					activeSuggestionIndex !== -1
						? `suggestion-item-${activeSuggestionIndex}`
						: undefined}
				></Textarea>

				{#if isSuggesting && currSuggestions.length > 0}
					<div
						bind:this={suggestionPopover}
						id="suggestion-popover-list"
						role="listbox"
						aria-label="Suggestions"
						class="absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto z-50 bg-background border border-border rounded-md shadow-lg p-1"
					>
						{#each currSuggestions as suggestion, index (suggestion.displayText + index)}
							<button
								type="button"
								id={`suggestion-item-${index}`}
								role="option"
								aria-selected={index === activeSuggestionIndex}
								class="rag-suggestion-item w-full text-left p-2 text-sm cursor-pointer rounded-md hover:bg-accent focus:bg-accent focus:outline-none {index ===
								activeSuggestionIndex
									? 'bg-accent'
									: ''}"
								on:click={() => selectSuggestion(index)}
								on:mouseenter={() =>
									(activeSuggestionIndex = index)}
							>
								{suggestion.displayText}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="control-area flex-shrink-0">
				<Button
					variant="outline"
					on:click={handleSendMessage}
					disabled={isThinking || !inputValue.trim()}
					class="rag-chat-send-button self-end w-28"
					aria-label="Send message"
				>
					Send
				</Button>
			</div>
		</div>
	</div>
</div>

<style>
	.rag-chat-view-container {
		height: 100%;
		display: flex;
		flex-direction: column;
		background-color: hsl(var(--background));
	}
	.rag-messages-container {
		/* Apply border settings */
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
	}
	/*
	.rag-chat-header-controls {
		background-color: hsl(var(--card));
	}
*/
	.rag-input-wrapper {
		background-color: hsl(var(--card));
	}

	.rag-suggestion-item {
		transition: background-color 0.1s ease-in-out;
	}
	.rag-suggestion-item:focus {
		outline: none; /* Handled by bg-accent */
	}

	.rag-thinking-indicator {
		color: hsl(var(--muted-foreground));
	}
</style>
