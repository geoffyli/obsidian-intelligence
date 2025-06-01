// src/filters.ts
import type { MetadataField, MetadataCondition } from "./types";

export interface FilterSignature {
	id: string; // Unique key for this filter signature
	triggerKeywords: string[]; // Keywords/prefixes that trigger this filter suggestion
	suggestionDisplay: string; // Text displayed in the suggestion list
	emoji: string; // Emoji for this filter type
	field: MetadataField; // The metadata field this filter
	condition: MetadataCondition; // The condition to apply for this filter
	valueSuggestions: Record<string, () => string>; // The value suggestions for this filter
}

export const AVAILABLE_FILTERS: FilterSignature[] = [
	{
		id: "created_on_date",
		triggerKeywords: ["created on", "cdate", "created date"],
		suggestionDisplay: "➕ Created: On specific date", // Indicates more input needed
		emoji: "➕",
		field: "createdAt",
		condition: "is",
		valueSuggestions: {
			Today: () => new Date().toISOString().split("T")[0], // return the ISO date of today,
			Yesterday: () =>
				new Date(new Date().setDate(new Date().getDate() - 1))
					.toISOString()
					.split("T")[0], // return the ISO date of yesterday
			"Specific Date": () => "",
		},
		// valueType: "specific_date",
	},
	{
		id: "modified_on_date",
		triggerKeywords: ["modified on", "mdate", "modified date"],
		suggestionDisplay: "📝 Modified: On specific date", // Indicates more input needed
		emoji: "📝",
		field: "modifiedAt",
		condition: "is",
		valueSuggestions: {
			Today: () => new Date().toISOString().split("T")[0], // return the ISO date of today,
			Yesterday: () =>
				new Date(new Date().setDate(new Date().getDate() - 1))
					.toISOString()
					.split("T")[0], // return the ISO date of yesterday
			"Specific Date": () => "",
		},
	},
];

// Helper to find a filter by its emoji (for the parser)
export function findFilterByEmoji(emoji: string): FilterSignature | undefined {
	return AVAILABLE_FILTERS.find((f) => f.emoji === emoji);
}
