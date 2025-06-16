// Simplified memory manager for Obsidian Intelligence
import { ObsidianMemoryStore } from "../storage/ObsidianMemoryStore";
import { ChatMessage } from "../types";
import { App } from "obsidian";

export interface MastraMemoryConfig {
	dataDir: string;
	fileName?: string;
}

/**
 * Simplified memory manager using direct Obsidian storage
 */
export class MastraMemoryManager {
	private storage: ObsidianMemoryStore;
	private isInitialized = false;
	private config: MastraMemoryConfig;
	private app: App;

	constructor(app: App, config: MastraMemoryConfig) {
		this.app = app;
		this.config = config;
		
		// Use direct Obsidian storage
		this.storage = new ObsidianMemoryStore(app, {
			dataDir: config.dataDir,
			fileName: config.fileName || "memory.json",
		});
	}

	/**
	 * Initialize the memory system
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Initialize the storage backend
			await this.storage.initialize();
			this.isInitialized = true;
			console.log("MastraMemoryManager initialized successfully");
		} catch (error) {
			console.error("Failed to initialize MastraMemoryManager:", error);
			throw error;
		}
	}

	/**
	 * Add a message to a conversation thread
	 */
	async addMessage(message: ChatMessage, conversationId: string, userId: string = "default"): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			// Store message in storage
			const key = `conversation:${conversationId}`;
			const existingMessages = await this.storage.get(key) || [];
			const updatedMessages = [...existingMessages, {
				id: message.id,
				role: message.role,
				content: message.content,
				timestamp: message.timestamp.toISOString(),
				agentId: message.agentId,
				sources: message.sources,
			}];
			await this.storage.set(key, updatedMessages);
		} catch (error) {
			console.error("Failed to add message to memory:", error);
			throw error;
		}
	}

	/**
	 * Get conversation history from memory
	 */
	async getConversationHistory(conversationId: string, userId: string = "default"): Promise<ChatMessage[]> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			// Retrieve messages from storage
			const key = `conversation:${conversationId}`;
			const storedMessages = await this.storage.get(key) || [];
			
			// Convert stored format back to ChatMessage format
			const messages: ChatMessage[] = storedMessages.map((msg: any) => ({
				id: msg.id || `msg_${Date.now()}`,
				role: msg.role as "user" | "assistant" | "system",
				content: msg.content,
				timestamp: new Date(msg.timestamp || Date.now()),
				agentId: msg.agentId,
				sources: msg.sources,
			}));

			return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		} catch (error) {
			console.error("Failed to get conversation history:", error);
			return [];
		}
	}

	/**
	 * Clear conversation history for a specific thread
	 */
	async clearConversation(conversationId: string, userId: string = "default"): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			// Clear specific thread memory
			await this.memory.clearMemory({
				resourceId: userId,
				threadId: conversationId,
			});
		} catch (error) {
			console.error("Failed to clear conversation:", error);
			throw error;
		}
	}

	/**
	 * Get all conversation IDs for a user
	 */
	async getConversationIds(userId: string = "default"): Promise<string[]> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			// Get all threads for user
			const threads = await this.memory.getThreads(userId);
			return threads.map(thread => thread.threadId);
		} catch (error) {
			console.error("Failed to get conversation IDs:", error);
			return [];
		}
	}

	/**
	 * Get conversation count
	 */
	async getConversationCount(userId: string = "default"): Promise<number> {
		try {
			const conversationIds = await this.getConversationIds(userId);
			return conversationIds.length;
		} catch (error) {
			console.error("Failed to get conversation count:", error);
			return 0;
		}
	}

	/**
	 * Search through conversation history
	 */
	async searchConversations(query: string, userId: string = "default", limit: number = 10): Promise<ChatMessage[]> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			// Get all conversations and search through them
			const conversationIds = await this.getConversationIds(userId);
			const allMessages: ChatMessage[] = [];

			for (const conversationId of conversationIds) {
				const messages = await this.getConversationHistory(conversationId, userId);
				allMessages.push(...messages);
			}

			// Simple text search - could be enhanced with semantic search
			const searchResults = allMessages
				.filter(message => 
					message.content.toLowerCase().includes(query.toLowerCase())
				)
				.slice(0, limit);

			return searchResults;
		} catch (error) {
			console.error("Failed to search conversations:", error);
			return [];
		}
	}

	/**
	 * Add context or facts to memory for long-term retention
	 */
	async addContext(context: string, userId: string = "default", threadId?: string): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			await this.memory.addToMemory({
				resourceId: userId,
				threadId: threadId || "global_context",
				context: [context],
			});
		} catch (error) {
			console.error("Failed to add context to memory:", error);
			throw error;
		}
	}

	/**
	 * Get stored context for a user
	 */
	async getContext(userId: string = "default", threadId?: string): Promise<string[]> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const memoryData = await this.memory.getMemory({
				resourceId: userId,
				threadId: threadId || "global_context",
			});

			return memoryData.context || [];
		} catch (error) {
			console.error("Failed to get context from memory:", error);
			return [];
		}
	}

	/**
	 * Check if memory system is ready
	 */
	isReady(): boolean {
		return this.isInitialized;
	}

	/**
	 * Get memory statistics
	 */
	async getStats(userId: string = "default"): Promise<{
		totalConversations: number;
		totalMessages: number;
		contextItems: number;
	}> {
		try {
			const conversationIds = await this.getConversationIds(userId);
			let totalMessages = 0;

			for (const conversationId of conversationIds) {
				const messages = await this.getConversationHistory(conversationId, userId);
				totalMessages += messages.length;
			}

			const contextItems = await this.getContext(userId);

			return {
				totalConversations: conversationIds.length,
				totalMessages,
				contextItems: contextItems.length,
			};
		} catch (error) {
			console.error("Failed to get memory stats:", error);
			return {
				totalConversations: 0,
				totalMessages: 0,
				contextItems: 0,
			};
		}
	}

	/**
	 * Cleanup the memory system
	 */
	async cleanup(): Promise<void> {
		if (this.isInitialized) {
			try {
				// Close any connections
				await this.memory.storage.close?.();
				this.isInitialized = false;
				console.log("MastraMemoryManager cleaned up successfully");
			} catch (error) {
				console.error("Failed to cleanup MastraMemoryManager:", error);
			}
		}
	}

	/**
	 * Get the underlying Mastra Memory instance for advanced usage
	 */
	getMastraMemory(): Memory {
		return this.memory;
	}
}