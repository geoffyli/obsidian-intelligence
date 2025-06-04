import { useState, useCallback, useEffect } from "react";
import { TFile, App } from "obsidian";
import { AVAILABLE_FILTERS, FilterSignature } from "../../filters";
import { SuggestionItem } from "../components/SuggestionPopover";

interface SuggestionState {
	isVisible: boolean;
	suggestions: SuggestionItem[];
	activeSuggestionIndex: number;
	mode: "filterType" | "filterValue" | "fileName" | null;
	selectedFilterType: FilterSignature | null;
	queryInfo: {
		query: string;
		startPos: number;
		endPos: number;
	} | null;
}

interface UseSuggestionsProps {
	app: App;
	onSuggestionSelect: (suggestion: SuggestionItem, queryInfo: SuggestionState["queryInfo"]) => void;
}

export const useSuggestions = ({ app, onSuggestionSelect }: UseSuggestionsProps) => {
	const [state, setState] = useState<SuggestionState>({
		isVisible: false,
		suggestions: [],
		activeSuggestionIndex: -1,
		mode: null,
		selectedFilterType: null,
		queryInfo: null,
	});

	// Get file suggestions
	const getFileSuggestions = useCallback(
		(query: string = ""): TFile[] => {
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
					file.basename.toLowerCase().includes(query.toLowerCase())
				)
				.sort((a, b) => {
					// Prioritize files that start with the query
					const aStarts = file.basename.toLowerCase().startsWith(query.toLowerCase());
					const bStarts = file.basename.toLowerCase().startsWith(query.toLowerCase());
					if (aStarts && !bStarts) return -1;
					if (!aStarts && bStarts) return 1;
					return b.stat.ctime - a.stat.ctime;
				})
				.slice(0, 7);
		},
		[app]
	);

	// Show filter type suggestions
	const showFilterTypeSuggestions = useCallback(
		(query: string, startPos: number, endPos: number) => {
			const suggestions = AVAILABLE_FILTERS.filter((sig) =>
				sig.triggerKeywords.some((keyword) =>
					keyword.toLowerCase().includes(query.toLowerCase())
				)
			)
				.map((sig) => ({
					type: "filterType" as const,
					data: sig,
					displayText: sig.suggestionDisplay,
				}))
				.slice(0, 7);

			setState({
				isVisible: suggestions.length > 0,
				suggestions,
				activeSuggestionIndex: suggestions.length > 0 ? 0 : -1,
				mode: "filterType",
				selectedFilterType: null,
				queryInfo: { query, startPos, endPos },
			});
		},
		[]
	);

	// Show file suggestions
	const showFileSuggestions = useCallback(
		(query: string, startPos: number, endPos: number) => {
			const files = getFileSuggestions(query);
			const suggestions = files.map((file) => ({
				type: "fileName" as const,
				data: file,
				displayText: file.basename,
			}));

			setState({
				isVisible: suggestions.length > 0,
				suggestions,
				activeSuggestionIndex: suggestions.length > 0 ? 0 : -1,
				mode: "fileName",
				selectedFilterType: null,
				queryInfo: { query, startPos, endPos },
			});
		},
		[getFileSuggestions]
	);

	// Show filter value suggestions
	const showFilterValueSuggestions = useCallback(
		(filterSig: FilterSignature, query: string, startPos: number, endPos: number) => {
			const suggestions = Object.entries(filterSig.valueSuggestions)
				.filter(([displayText]) =>
					displayText.toLowerCase().includes(query.toLowerCase())
				)
				.map(([displayText, getValue]) => ({
					type: "filterValue" as const,
					displayText,
					data: getValue(),
				}));

			setState({
				isVisible: suggestions.length > 0,
				suggestions,
				activeSuggestionIndex: suggestions.length > 0 ? 0 : -1,
				mode: "filterValue",
				selectedFilterType: filterSig,
				queryInfo: { query, startPos, endPos },
			});
		},
		[]
	);

	// Hide suggestions
	const hideSuggestions = useCallback(() => {
		setState({
			isVisible: false,
			suggestions: [],
			activeSuggestionIndex: -1,
			mode: null,
			selectedFilterType: null,
			queryInfo: null,
		});
	}, []);

	// Navigate suggestions
	const navigateSuggestions = useCallback(
		(direction: number) => {
			if (!state.isVisible || state.suggestions.length === 0) return;
			
			setState(prev => ({
				...prev,
				activeSuggestionIndex:
					(prev.activeSuggestionIndex + direction + prev.suggestions.length) %
					prev.suggestions.length,
			}));
		},
		[state.isVisible, state.suggestions.length]
	);

	// Select active suggestion
	const selectActiveSuggestion = useCallback(() => {
		if (
			!state.isVisible ||
			state.activeSuggestionIndex < 0 ||
			state.activeSuggestionIndex >= state.suggestions.length
		) {
			return false;
		}

		const selectedSuggestion = state.suggestions[state.activeSuggestionIndex];
		onSuggestionSelect(selectedSuggestion, state.queryInfo);
		hideSuggestions();
		return true;
	}, [state, onSuggestionSelect, hideSuggestions]);

	// Select suggestion by index
	const selectSuggestion = useCallback(
		(index: number) => {
			if (index >= 0 && index < state.suggestions.length) {
				const selectedSuggestion = state.suggestions[index];
				onSuggestionSelect(selectedSuggestion, state.queryInfo);
				hideSuggestions();
			}
		},
		[state.suggestions, state.queryInfo, onSuggestionSelect, hideSuggestions]
	);

	// Set active suggestion index
	const setActiveSuggestionIndex = useCallback((index: number) => {
		setState(prev => ({
			...prev,
			activeSuggestionIndex: index,
		}));
	}, []);

	// Analyze input and show appropriate suggestions
	const analyzeInput = useCallback(
		(inputValue: string, cursorPos: number) => {
			const textBeforeCursor = inputValue.substring(0, cursorPos);

			// Check for file references [[filename]]
			const doubleBracketMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
			if (doubleBracketMatch) {
				const fileQuery = doubleBracketMatch[1];
				const startPos = cursorPos - doubleBracketMatch[0].length + 2; // After [[
				showFileSuggestions(fileQuery, startPos, cursorPos);
				return;
			}

			// Check for filter value input inside {}
			const braceMatch = textBeforeCursor.match(/(\p{Extended_Pictographic}(?:\uFE0F)?)\{([^}]*)$/u);
			if (braceMatch) {
				const emoji = braceMatch[1];
				const valueQuery = braceMatch[2];
				const filterSig = AVAILABLE_FILTERS.find(f => f.emoji === emoji);
				
				if (filterSig) {
					const startPos = cursorPos - valueQuery.length;
					showFilterValueSuggestions(filterSig, valueQuery, startPos, cursorPos);
					return;
				}
			}

			// Check for filter keyword input
			const wordMatch = textBeforeCursor.match(/(\w+)$/);
			if (wordMatch) {
				const query = wordMatch[1];
				if (query.length >= 2) { // Only show after 2 characters
					const startPos = cursorPos - query.length;
					showFilterTypeSuggestions(query, startPos, cursorPos);
					return;
				}
			}

			// Hide suggestions if no match
			hideSuggestions();
		},
		[showFileSuggestions, showFilterValueSuggestions, showFilterTypeSuggestions, hideSuggestions]
	);

	return {
		// State
		isVisible: state.isVisible,
		suggestions: state.suggestions,
		activeSuggestionIndex: state.activeSuggestionIndex,
		mode: state.mode,
		selectedFilterType: state.selectedFilterType,

		// Actions
		analyzeInput,
		navigateSuggestions,
		selectActiveSuggestion,
		selectSuggestion,
		setActiveSuggestionIndex,
		hideSuggestions,
	};
};