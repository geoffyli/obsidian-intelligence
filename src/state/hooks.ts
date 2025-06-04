import { useContext, useEffect, useState, useCallback } from "react";
import { SharedState, ChatConversation, ChatMessage } from "./SharedState";
import { SharedStateContext } from "./contexts";

/**
 * Hook to access and update the shared state
 */
export function useSharedState() {
	const sharedState = useContext(SharedStateContext);
	
	if (!sharedState) {
		throw new Error("useSharedState must be used within a SharedStateProvider");
	}

	return sharedState;
}

/**
 * Hook to access chat history with automatic updates
 */
export function useChatHistory() {
	const sharedState = useSharedState();
	const [chatHistory, setChatHistory] = useState<ChatConversation[]>(
		sharedState.getChatHistory()
	);

	useEffect(() => {
		// Subscribe to changes
		const unsubscribe = sharedState.subscribe(() => {
			setChatHistory(sharedState.getChatHistory());
		});

		// Also listen to specific events
		const handleHistoryChange = (history: ChatConversation[]) => {
			setChatHistory(history);
		};

		sharedState.on("chatHistoryChanged", handleHistoryChange);

		return () => {
			unsubscribe();
			sharedState.off("chatHistoryChanged", handleHistoryChange);
		};
	}, [sharedState]);

	const updateChatHistory = useCallback(
		(newHistory: ChatConversation[]) => {
			sharedState.setChatHistory(newHistory);
		},
		[sharedState]
	);

	return [chatHistory, updateChatHistory] as const;
}

/**
 * Hook to access current conversation with automatic updates
 */
export function useCurrentConversation() {
	const sharedState = useSharedState();
	const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(
		sharedState.getCurrentConversation()
	);

	useEffect(() => {
		// Subscribe to changes
		const unsubscribe = sharedState.subscribe(() => {
			setCurrentConversation(sharedState.getCurrentConversation());
		});

		// Also listen to specific events
		const handleCurrentChange = () => {
			setCurrentConversation(sharedState.getCurrentConversation());
		};

		sharedState.on("currentConversationChanged", handleCurrentChange);
		sharedState.on("conversationUpdated", handleCurrentChange);

		return () => {
			unsubscribe();
			sharedState.off("currentConversationChanged", handleCurrentChange);
			sharedState.off("conversationUpdated", handleCurrentChange);
		};
	}, [sharedState]);

	const setCurrentConversationId = useCallback(
		(id: string | null) => {
			sharedState.setCurrentConversationId(id);
		},
		[sharedState]
	);

	const addMessage = useCallback(
		(message: ChatMessage) => {
			sharedState.addMessageToCurrentConversation(message);
		},
		[sharedState]
	);

	return {
		currentConversation,
		setCurrentConversationId,
		addMessage,
	};
}

/**
 * Hook to access loading state
 */
export function useLoadingState() {
	const sharedState = useSharedState();
	const [isLoading, setIsLoading] = useState<boolean>(
		sharedState.isLoading()
	);

	useEffect(() => {
		// Subscribe to changes
		const unsubscribe = sharedState.subscribe(() => {
			setIsLoading(sharedState.isLoading());
		});

		// Also listen to specific events
		const handleLoadingChange = (loading: boolean) => {
			setIsLoading(loading);
		};

		sharedState.on("loadingStateChanged", handleLoadingChange);

		return () => {
			unsubscribe();
			sharedState.off("loadingStateChanged", handleLoadingChange);
		};
	}, [sharedState]);

	const setLoading = useCallback(
		(loading: boolean) => {
			sharedState.setLoading(loading);
		},
		[sharedState]
	);

	return [isLoading, setLoading] as const;
}

/**
 * Hook to access error state
 */
export function useErrorState() {
	const sharedState = useSharedState();
	const [error, setError] = useState<string | null>(
		sharedState.getError()
	);

	useEffect(() => {
		// Subscribe to changes
		const unsubscribe = sharedState.subscribe(() => {
			setError(sharedState.getError());
		});

		// Also listen to specific events
		const handleErrorChange = (error: string | null) => {
			setError(error);
		};

		sharedState.on("errorStateChanged", handleErrorChange);

		return () => {
			unsubscribe();
			sharedState.off("errorStateChanged", handleErrorChange);
		};
	}, [sharedState]);

	const setErrorMessage = useCallback(
		(error: string | null) => {
			sharedState.setError(error);
		},
		[sharedState]
	);

	return [error, setErrorMessage] as const;
}

/**
 * Hook to manage conversations
 */
export function useConversationManager() {
	const sharedState = useSharedState();

	const createConversation = useCallback(
		(title: string = "New Chat"): ChatConversation => {
			const newConversation: ChatConversation = {
				id: Date.now().toString(),
				title,
				messages: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			sharedState.addConversation(newConversation);
			sharedState.setCurrentConversationId(newConversation.id);
			return newConversation;
		},
		[sharedState]
	);

	const deleteConversation = useCallback(
		(id: string) => {
			sharedState.deleteConversation(id);
		},
		[sharedState]
	);

	const updateConversationTitle = useCallback(
		(id: string, title: string) => {
			sharedState.updateConversation(id, { title });
		},
		[sharedState]
	);

	return {
		createConversation,
		deleteConversation,
		updateConversationTitle,
	};
}