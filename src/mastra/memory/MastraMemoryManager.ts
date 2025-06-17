// Enhanced memory manager for Obsidian Intelligence with execution context support
import { ObsidianMemoryStore } from "../storage/ObsidianMemoryStore";
import { ChatMessage } from "../agents/types";
import { ExecutionContext, AgentInteraction, TaskArtifact } from "../planning/types";
import { App } from "obsidian";

export interface MastraMemoryConfig {
	dataDir: string;
	fileName?: string;
	maxConversations?: number;
	maxMessagesPerConversation?: number;
	compressionThreshold?: number;
}

export interface ExecutionContextData {
	planId: string;
	conversationId: string;
	currentTask?: string;
	completedTasks: string[];
	failedTasks: string[];
	sharedData: Record<string, any>;
	userPreferences: Record<string, any>;
	sessionStartTime: string;
	totalTokensUsed: number;
	agentInteractions: AgentInteraction[];
	artifacts: TaskArtifact[];
	status: 'active' | 'completed' | 'failed' | 'cancelled';
	createdAt: string;
	updatedAt: string;
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
			// Clear specific conversation from storage
			const key = `conversation:${conversationId}`;
			await this.storage.set(key, null);
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
			// For now, return empty array - would need to implement key enumeration
			// This would require extending ObsidianMemoryStore with getAllKeys method
			console.warn("Getting conversation IDs not fully implemented - returning empty array");
			return [];
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
			const key = `context:${userId}:${threadId || 'global'}`;
			const existingContext = await this.storage.get(key) || [];
			const updatedContext = [...existingContext, {
				content: context,
				timestamp: new Date().toISOString(),
				threadId: threadId || 'global'
			}];
			await this.storage.set(key, updatedContext);
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
			const key = `context:${userId}:${threadId || 'global'}`;
			const contextData = await this.storage.get(key) || [];
			return contextData.map((item: any) => item.content);
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
	 * Store execution context for a plan
	 */
	async storeExecutionContext(context: ExecutionContext): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `execution:${context.planId}`;
			const contextData: ExecutionContextData = {
				planId: context.planId,
				conversationId: context.conversationId,
				currentTask: context.currentTask,
				completedTasks: context.completedTasks,
				failedTasks: context.failedTasks,
				sharedData: context.sharedData,
				userPreferences: context.userPreferences,
				sessionStartTime: context.sessionStartTime.toISOString(),
				totalTokensUsed: context.totalTokensUsed,
				agentInteractions: context.agentInteractions,
				artifacts: [],
				status: context.failedTasks.length > 0 ? 'failed' : 
						 context.completedTasks.length > 0 ? 'completed' : 'active',
				createdAt: context.sessionStartTime.toISOString(),
				updatedAt: new Date().toISOString()
			};
			await this.storage.set(key, contextData);
		} catch (error) {
			console.error("Failed to store execution context:", error);
			throw error;
		}
	}

	/**
	 * Retrieve execution context for a plan
	 */
	async getExecutionContext(planId: string): Promise<ExecutionContext | null> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `execution:${planId}`;
			const contextData = await this.storage.get(key) as ExecutionContextData;
			if (!contextData) {
				return null;
			}

			return {
				planId: contextData.planId,
				conversationId: contextData.conversationId,
				currentTask: contextData.currentTask,
				completedTasks: contextData.completedTasks,
				failedTasks: contextData.failedTasks,
				sharedData: contextData.sharedData,
				userPreferences: contextData.userPreferences,
				sessionStartTime: new Date(contextData.sessionStartTime),
				totalTokensUsed: contextData.totalTokensUsed,
				agentInteractions: contextData.agentInteractions
			};
		} catch (error) {
			console.error("Failed to get execution context:", error);
			return null;
		}
	}

	/**
	 * Store agent interaction
	 */
	async storeAgentInteraction(interaction: AgentInteraction): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `interactions:${interaction.taskId}`;
			const existingInteractions = await this.storage.get(key) || [];
			const updatedInteractions = [...existingInteractions, interaction];
			await this.storage.set(key, updatedInteractions);
		} catch (error) {
			console.error("Failed to store agent interaction:", error);
			throw error;
		}
	}

	/**
	 * Get agent interactions for a task
	 */
	async getAgentInteractions(taskId: string): Promise<AgentInteraction[]> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `interactions:${taskId}`;
			return await this.storage.get(key) || [];
		} catch (error) {
			console.error("Failed to get agent interactions:", error);
			return [];
		}
	}

	/**
	 * Store task artifact
	 */
	async storeArtifact(artifact: TaskArtifact): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `artifact:${artifact.id}`;
			await this.storage.set(key, artifact);
		} catch (error) {
			console.error("Failed to store artifact:", error);
			throw error;
		}
	}

	/**
	 * Get task artifact
	 */
	async getArtifact(artifactId: string): Promise<TaskArtifact | null> {
		if (!this.isInitialized) {
			throw new Error("Memory manager not initialized");
		}

		try {
			const key = `artifact:${artifactId}`;
			return await this.storage.get(key);
		} catch (error) {
			console.error("Failed to get artifact:", error);
			return null;
		}
	}

	/**
	 * Cleanup the memory system
	 */
	async cleanup(): Promise<void> {
		if (this.isInitialized) {
			try {
				// Close any connections
				this.isInitialized = false;
				console.log("MastraMemoryManager cleaned up successfully");
			} catch (error) {
				console.error("Failed to cleanup MastraMemoryManager:", error);
			}
		}
	}

	/**
	 * Get the underlying storage for advanced usage
	 */
	getStorage(): ObsidianMemoryStore {
		return this.storage;
	}
}