import React from "react";
import { TFile } from "obsidian";
import { FilterSignature } from "../../filters";
import { cn } from "@/lib/utils";

export interface SuggestionItem {
	type: "filterType" | "filterValue" | "fileName";
	data: FilterSignature | string | TFile;
	displayText: string;
	description?: string;
}

interface SuggestionPopoverProps {
	suggestions: SuggestionItem[];
	activeSuggestionIndex: number;
	onSelect: (index: number) => void;
	onHover: (index: number) => void;
	isVisible: boolean;
	className?: string;
}

const SuggestionPopover: React.FC<SuggestionPopoverProps> = ({
	suggestions,
	activeSuggestionIndex,
	onSelect,
	onHover,
	isVisible,
	className,
}) => {
	if (!isVisible || suggestions.length === 0) {
		return null;
	}

	const getSuggestionIcon = (suggestion: SuggestionItem) => {
		switch (suggestion.type) {
			case "filterType":
				const filterData = suggestion.data as FilterSignature;
				return (
					<span className="text-base mr-2" role="img">
						{filterData.emoji}
					</span>
				);
			case "filterValue":
				return (
					<span className="text-muted-foreground mr-2">
						📅
					</span>
				);
			case "fileName":
				return (
					<span className="text-muted-foreground mr-2">
						📄
					</span>
				);
			default:
				return null;
		}
	};

	const getSuggestionDescription = (suggestion: SuggestionItem) => {
		switch (suggestion.type) {
			case "filterType":
				return "Filter";
			case "filterValue":
				return "Value";
			case "fileName":
				return "File";
			default:
				return "";
		}
	};

	return (
		<div
			className={cn(
				"absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto z-50",
				"bg-popover text-popover-foreground border border-border rounded-md shadow-lg",
				"intelligence-suggestion-popover",
				className
			)}
			role="listbox"
			aria-label="Suggestions"
		>
			{suggestions.map((suggestion, index) => (
				<button
					key={`${suggestion.type}-${suggestion.displayText}-${index}`}
					type="button"
					role="option"
					aria-selected={index === activeSuggestionIndex}
					className={cn(
						"w-full text-left p-3 text-base cursor-pointer transition-colors rounded-md",
						"hover:bg-muted focus:bg-muted",
						"flex items-center justify-between",
						index === activeSuggestionIndex && "bg-primary text-primary-foreground"
					)}
					onClick={() => onSelect(index)}
					onMouseEnter={() => onHover(index)}
				>
					<div className="flex items-center flex-1 min-w-0">
						{getSuggestionIcon(suggestion)}
						<span className="truncate">
							{suggestion.displayText}
						</span>
					</div>
					<span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
						{getSuggestionDescription(suggestion)}
					</span>
				</button>
			))}
		</div>
	);
};

export default SuggestionPopover;