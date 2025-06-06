import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	KeyboardEvent,
} from "react";
import { App, TFile } from "obsidian";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SendHorizontal, Settings2, FileText, Link } from "lucide-react";
import { useSuggestions } from "../hooks/useSuggestions";
import SuggestionPopover, { SuggestionItem } from "./SuggestionPopover";
import { FilterSignature } from "../../filters";

interface ChatControlProps {
	onSendMessage: (
		message: string,
		mode: "agent" | "chat",
		ragEnabled: boolean
	) => void;
	isSending: boolean;
	onOpenTools?: () => void;
	app: App;
}

type RagMode = "vault" | "web" | "none";

const MAX_TEXTAREA_HEIGHT_LINES = 7;
const LINE_HEIGHT = 1.2 * 16;
const MIN_TEXTAREA_HEIGHT = 35; // px - single line: 14px text + 8px top padding + 8px line spacing

function ChatControl({
	onSendMessage,
	isSending,
	onOpenTools,
	app,
}: ChatControlProps) {
	const [inputValue, setInputValue] = useState("");
	const [chatMode] = useState<"agent" | "chat">("chat");
	const [ragMode, setRagMode] = useState<RagMode>("vault");

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Handle suggestion selection
	const handleSuggestionSelect = useCallback(
		(
			suggestion: SuggestionItem,
			queryInfo: {
				query: string;
				startPos: number;
				endPos: number;
			} | null
		) => {
			if (!textareaRef.current || !queryInfo) return;

			const { startPos, endPos } = queryInfo;
			const beforeText = inputValue.substring(0, startPos);
			const afterText = inputValue.substring(endPos);

			let replacementText = "";
			let newCursorPos = startPos;

			switch (suggestion.type) {
				case "filterType": {
					const filterData = suggestion.data as FilterSignature;
					replacementText = `${filterData.emoji}{}`;
					newCursorPos = startPos + replacementText.length - 1; // Position cursor inside {}
					break;
				}

				case "filterValue": {
					const valueData = suggestion.data as string;
					replacementText = valueData;
					newCursorPos = startPos + replacementText.length;
					break;
				}

				case "fileName": {
					const fileData = suggestion.data as TFile;
					replacementText = `[[${fileData.basename}]]`;
					newCursorPos = startPos + replacementText.length;
					break;
				}
			}

			const newInputValue = beforeText + replacementText + afterText;
			setInputValue(newInputValue);

			// Set cursor position after React updates
			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
					textareaRef.current.focus();
				}
			}, 0);
		},
		[inputValue]
	);

	// Initialize suggestions hook
	const suggestions = useSuggestions({
		app,
		onSuggestionSelect: handleSuggestionSelect,
	});

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			let newHeight = textareaRef.current.scrollHeight;

			const maxHeightPx =
				MAX_TEXTAREA_HEIGHT_LINES * LINE_HEIGHT +
				(textareaRef.current.offsetHeight -
					textareaRef.current.clientHeight);

			if (newHeight > maxHeightPx) {
				newHeight = maxHeightPx;
				textareaRef.current.style.overflowY = "auto";
			} else {
				textareaRef.current.style.overflowY = "hidden";
			}

			if (newHeight < MIN_TEXTAREA_HEIGHT) {
				newHeight = MIN_TEXTAREA_HEIGHT;
			}

			textareaRef.current.style.height = `${newHeight}px`;
		}
	}, [inputValue]);

	// Set proper initial height on mount
	useEffect(() => {
		if (textareaRef.current) {
			// Force the minimum height initially instead of reading scrollHeight
			const initialHeight = MIN_TEXTAREA_HEIGHT;
			textareaRef.current.style.height = `${initialHeight}px`;
			textareaRef.current.style.overflowY = "hidden";
		}
	}, []);

	// Handle input changes and analyze for suggestions
	const handleInputChange = (
		event: React.ChangeEvent<HTMLTextAreaElement>
	) => {
		const newValue = event.target.value;
		setInputValue(newValue);

		// Analyze input for suggestions
		const cursorPos = event.target.selectionStart;
		suggestions.analyzeInput(newValue, cursorPos);
	};

	// Handle cursor position changes (for click or arrow key movement)
	const handleCursorPositionChange = useCallback(() => {
		if (textareaRef.current) {
			const cursorPos = textareaRef.current.selectionStart;
			suggestions.analyzeInput(inputValue, cursorPos);
		}
	}, [inputValue, suggestions]);

	// Handle document click to hide suggestions
	useEffect(() => {
		const handleDocumentClick = (evt: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(evt.target as Node)
			) {
				suggestions.hideSuggestions();
			}
		};

		document.addEventListener("click", handleDocumentClick);
		return () => document.removeEventListener("click", handleDocumentClick);
	}, [suggestions]);

	const handleSend = () => {
		if (inputValue.trim()) {
			onSendMessage(inputValue.trim(), chatMode, ragMode !== "none");
			setInputValue("");
			suggestions.hideSuggestions();
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (suggestions.isVisible) {
			// Handle suggestion navigation
			if (event.key === "ArrowUp") {
				event.preventDefault();
				suggestions.navigateSuggestions(-1);
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				suggestions.navigateSuggestions(1);
			} else if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				if (!suggestions.selectActiveSuggestion()) {
					// If no suggestion was selected, send the message
					handleSend();
				}
			} else if (event.key === "Tab") {
				event.preventDefault();
				suggestions.selectActiveSuggestion();
			} else if (event.key === "Escape") {
				event.preventDefault();
				suggestions.hideSuggestions();
			}
		} else {
			// Normal input handling
			if (event.key === "Enter") {
				if (event.shiftKey) {
					// Allow Shift+Enter for new lines
				} else {
					event.preventDefault();
					handleSend();
				}
			}
		}
	};

	const handleRagModeChange = (value: string) => {
		setRagMode(value as RagMode);
	};

	const ragModeOptions = [
		{
			value: "vault",
			label: "Agent",
			icon: <FileText className="mr-2 h-4 w-4" />,
		},
		{
			value: "none",
			label: "Ask",
			icon: <Link className="mr-2 h-4 w-4" />,
		},
	];

	return (
		<div
			ref={containerRef}
			className="bg-base-20 text-secondary-foreground p-3 border border-border rounded-lg shadow-sm"
			style={{ borderColor: "var(--background-modifier-border)" }}
		>
			{/* Text area with suggestions */}
			<div className="mb-1 relative">
				<Textarea
					className="w-full resize-none overflow-hidden shadow-none bg-transparent text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 border-0 py-0 text-sm"
					ref={textareaRef}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onSelect={handleCursorPositionChange}
					onClick={handleCursorPositionChange}
					placeholder={
						chatMode === "agent"
							? "Describe task for agent..."
							: "Start chatting... Try typing 'created' or '[['..."
					}
					rows={1}
					disabled={isSending}
				/>

				{/* Suggestion Popover */}
				<SuggestionPopover
					suggestions={suggestions.suggestions}
					activeSuggestionIndex={suggestions.activeSuggestionIndex}
					onSelect={suggestions.selectSuggestion}
					onHover={suggestions.setActiveSuggestionIndex}
					isVisible={suggestions.isVisible}
				/>
			</div>

			{/* Control panel */}
			<div className="flex items-center justify-between">
				{/* Left side: tools */}
				<div className="left-panel flex justify-start items-center space-x-2">
					<Select
						value={ragMode}
						onValueChange={handleRagModeChange}
						disabled={isSending}
					>
						<SelectTrigger className="h-8 w-auto !shadow-none border-none bg-transparent text-foreground hover:bg-base-40 dark:hover:bg-base-40 hover:text-accent-foreground focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none !text-sm leading-tight py-0">
							<SelectValue
								placeholder="Mode"
								className="!text-sm "
							/>
						</SelectTrigger>
						<SelectContent className="bg-popover text-popover-foreground border border-border">
							{ragModeOptions.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
									className="text-sm hover:bg-muted"
								>
									<div className="flex items-center">
										{option.icon}
										{option.label}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{onOpenTools && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onOpenTools}
							className="h-8 w-8 !shadow-none bg-transparent hover:bg-base-40 dark:hover:bg-base-40"
							title="Open settings"
						>
							<Settings2 className="h-4 w-4" />
							<span className="sr-only">Tools / Options</span>
						</Button>
					)}
				</div>
				{/* Right side: send button */}
				<div className="right-panel">
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className="text-muted-foreground disabled:opacity-50 h-8 w-8 bg-transparent hover:bg-base-40 dark:hover:bg-base-40 !shadow-none"
						onClick={handleSend}
						disabled={isSending || !inputValue.trim()}
						aria-label="Send message"
						title="Send message"
					>
						<SendHorizontal className="h-5 w-5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

export default ChatControl;
