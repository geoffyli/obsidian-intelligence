// src/parser.ts
import { MetadataFilter } from "./types";
import { findFilterByEmoji } from "./filters"; // Assuming filters.ts


/**
 * Parses metadata filter emojis and [[filename]] syntax from the prompt text.
 *
 * @param promptText The raw text from the input area.
 * @returns An object containing the semanticQuery (text without emoji filters removed, but keeping [[filename]])
 * and an array of MetadataFilters.
 */
export function parseFiltersFromPrompt(promptText: string): {
    semanticQuery: string;
    metadataFilters: MetadataFilter[];
} {
    const metadataFilterMap: Record<string, MetadataFilter> = {};

    // Step 1: Parse emoji filters (existing functionality - remove from text)
	const emojiRegex = /(\p{Extended_Pictographic}(?:\uFE0F)?)\{([^}]+)\}/gu;
    let match;
    while ((match = emojiRegex.exec(promptText)) !== null) {
        const emoji = match[1]; // The captured emoji
        const value = match[2]; // The captured content within {}

		// Find the filter signature that matches this emoji
		const filterSignature = findFilterByEmoji(emoji);
		if (filterSignature) {
			// Create a unique key for the filter (emoji + field)
			const filterKey = `${emoji}_${filterSignature.field}`;
			
			// Create a new metadata filter based on the filter signature
			const metadataFilter: MetadataFilter = {
				field: filterSignature.field,
				condition: filterSignature.condition,
				value: value.trim(),
			};
			metadataFilterMap[filterKey] = metadataFilter;
		} else {
			console.warn(`Parser: No filter signature found for emoji "${emoji}" with value "${value}".`);
		}
	}

    // Step 2: Parse [[filename]] syntax (new functionality - keep in text but create filters)
    const filenameRegex = /\[\[([^\]]+)\]\]/g;
    let filenameMatch;
    while ((filenameMatch = filenameRegex.exec(promptText)) !== null) {
        const filename = filenameMatch[1].trim();
        
        if (filename) {
            // Create a filename filter that searches for files containing the specified name
            const filenameFilter: MetadataFilter = {
                field: "basename", // Search in the basename field (filename without extension)
                condition: "contains",
                value: filename,
            };
            
            // Use a unique key for filename filters
            const filterKey = `filename_${filename}`;
            metadataFilterMap[filterKey] = filenameFilter;
        }
    }

    // Step 3: Remove only emoji filters from the text, keep [[filename]] syntax
    const semanticQuery = promptText.replace(emojiRegex, '').trim();

    return { 
        semanticQuery, 
        metadataFilters: Object.values(metadataFilterMap) 
    };
}
