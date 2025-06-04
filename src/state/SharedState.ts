import { EventEmitter } from "events";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	sources?: string[];
}

export interface ChatConversation {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: Date;
	updatedAt: Date;
}

export interface SharedStateData {
	chatHistory: ChatConversation[];
	currentConversationId: string | null;
	isLoading: boolean;
	error: string | null;
}

/**
 * SharedState class for managing global application state
 * following the Obsidian Copilot pattern
 */
export class SharedState extends EventEmitter {
	private state: SharedStateData = {
		chatHistory: [],
		currentConversationId: null,
		isLoading: false,
		error: null,
	};

	private listeners: Set<() => void> = new Set();

	// Chat History methods
	getChatHistory(): ChatConversation[] {
		return this.state.chatHistory;
	}

	setChatHistory(history: ChatConversation[]) {
		this.state.chatHistory = history;
		this.notifyListeners();
		this.emit("chatHistoryChanged", history);
	}

	addConversation(conversation: ChatConversation) {
		this.state.chatHistory = [...this.state.chatHistory, conversation];
		this.notifyListeners();
		this.emit("conversationAdded", conversation);
	}

	updateConversation(id: string, updates: Partial<ChatConversation>) {
		this.state.chatHistory = this.state.chatHistory.map(conv =>
			conv.id === id ? { ...conv, ...updates } : conv
		);
		this.notifyListeners();
		this.emit("conversationUpdated", id, updates);
	}

	deleteConversation(id: string) {
		this.state.chatHistory = this.state.chatHistory.filter(conv => conv.id !== id);
		if (this.state.currentConversationId === id) {
			this.state.currentConversationId = null;
		}
		this.notifyListeners();
		this.emit("conversationDeleted", id);
	}

	// Current Conversation methods
	getCurrentConversationId(): string | null {
		return this.state.currentConversationId;
	}

	setCurrentConversationId(id: string | null) {
		this.state.currentConversationId = id;
		this.notifyListeners();
		this.emit("currentConversationChanged", id);
	}

	getCurrentConversation(): ChatConversation | null {
		if (!this.state.currentConversationId) return null;
		return this.state.chatHistory.find(conv => conv.id === this.state.currentConversationId) || null;
	}

	// Loading state methods
	isLoading(): boolean {
		return this.state.isLoading;
	}

	setLoading(loading: boolean) {
		this.state.isLoading = loading;
		this.notifyListeners();
		this.emit("loadingStateChanged", loading);
	}

	// Error state methods
	getError(): string | null {
		return this.state.error;
	}

	setError(error: string | null) {
		this.state.error = error;
		this.notifyListeners();
		this.emit("errorStateChanged", error);
	}

	// Message methods
	addMessageToCurrentConversation(message: ChatMessage) {
		const currentConv = this.getCurrentConversation();
		if (!currentConv) return;

		this.updateConversation(currentConv.id, {
			messages: [...currentConv.messages, message],
			updatedAt: new Date()
		});
	}

	// Subscription methods
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners() {
		this.listeners.forEach(listener => listener());
	}

	// Persistence methods
	saveState(): string {
		return JSON.stringify(this.state);
	}

	loadState(serializedState: string) {
		try {
			const loadedState = JSON.parse(serializedState);
			// Convert date strings back to Date objects
			if (loadedState.chatHistory) {
				loadedState.chatHistory = loadedState.chatHistory.map((conv: any) => ({
					...conv,
					createdAt: new Date(conv.createdAt),
					updatedAt: new Date(conv.updatedAt),
					messages: conv.messages.map((msg: any) => ({
						...msg,
						timestamp: new Date(msg.timestamp)
					}))
				}));
			}
			this.state = { ...this.state, ...loadedState };
			this.notifyListeners();
		} catch (error) {
			console.error("Failed to load state:", error);
		}
	}

	// Clear all state
	clearAll() {
		this.state = {
			chatHistory: [],
			currentConversationId: null,
			isLoading: false,
			error: null,
		};
		this.notifyListeners();
		this.emit("stateCleared");
	}
}