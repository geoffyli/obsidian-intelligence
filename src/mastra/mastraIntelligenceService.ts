// src/mastra/mastraIntelligenceService.ts
// Mastra-native Intelligence Service wrapper
import { App, Notice } from "obsidian";
import type {
	IntelligencePluginSettings,
	LangChainChatMessage,
	MetadataFilter,
} from "../types";
import IntelligencePlugin from "../main";
import { createMastraWithAgents } from "./index";
import type { AgentResponse, ChatMessage } from "./agents/types";

export class MastraIntelligenceService {
	private app: App;
	private settings: IntelligencePluginSettings;
	private plugin: IntelligencePlugin;
	private mastraOrchestrator: import("./MastraOrchestrator").MastraOrchestrator | null = null;
	private isInitialized = false;
	private isInitializing = false;

	constructor(
		app: App,
		settings: IntelligencePluginSettings,
		plugin: IntelligencePlugin
	) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
	}

	async initialize(): Promise<void> {
		if (this.isInitializing || this.isInitialized) return;
		this.isInitializing = true;
		this.plugin.updateStatusBar("Intelligence: Initializing...");
		try {
			if (!this.settings.openAIApiKey) {
				throw new Error(
					"OpenAI API key is required. Please set your API key in plugin settings."
				);
			}
			this.mastraOrchestrator = await createMastraWithAgents({
				app: this.app,
				settings: this.settings,
				plugin: this.plugin,
			});
			this.isInitialized = true;
			this.plugin.updateStatusBar("Intelligence: Ready");
			new Notice("Mastra Intelligence System Ready!");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			new Notice(`Intelligence Initialization Failed: ${errorMessage}.`);
			this.plugin.updateStatusBar("Intelligence: Init Failed");
			this.isInitialized = false;
		} finally {
			this.isInitializing = false;
		}
	}

	async reInitialize(): Promise<void> {
		this.isInitialized = false;
		this.plugin.updateStatusBar("Intelligence: Re-initializing...");
		await this.initialize();
	}

	getIsInitialized(): boolean {
		return this.isInitialized;
	}

	async processQueryWithHistory(
		semanticQuery: string,
		history: LangChainChatMessage[],
		metadataFilters?: MetadataFilter[]
	): Promise<string | null> {
		if (!this.isInitialized || !this.mastraOrchestrator) {
			new Notice(
				"Intelligence Service is not initialized. Please try again or re-initialize."
			);
			this.plugin.updateStatusBar("Intelligence: Not Initialized");
			return null;
		}
		if (
			(!semanticQuery || semanticQuery.trim() === "") &&
			(!metadataFilters || metadataFilters.length === 0)
		) {
			new Notice("Query or filter cannot be empty.");
			return null;
		}
		this.plugin.updateStatusBar("Intelligence: Processing...");
		try {
			const chatHistory: ChatMessage[] = history.map((msg, index) => ({
				id: `msg_${Date.now()}_${index}`,
				role: msg.type === "human" ? "user" : "assistant",
				content: msg.content,
				timestamp: new Date(),
			}));
			const response: AgentResponse = await this.mastraOrchestrator.run({
				input: semanticQuery,
				conversationId: "default", // TODO: Use real conversationId if available
				chatHistory,
				metadataFilters,
			});
			this.plugin.updateStatusBar("Intelligence: Ready");
			
			// Check if the response was successful
			if (!response.success) {
				console.error("Agent response failed:", response.error);
				return response.content; // Still return the error message to user
			}
			
			return response.content;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			new Notice(`Error answering question: ${errorMessage}`);
			console.error(errorMessage);
			this.plugin.updateStatusBar("Intelligence: Error");
			return null;
		}
	}

	setAutoApproval(enabled: boolean): void {
		if (
			this.mastraOrchestrator &&
			this.mastraOrchestrator.setAutoApproval
		) {
			this.mastraOrchestrator.setAutoApproval(enabled);
		}
	}

	getSystemStatus(): Record<string, unknown> {
		if (this.mastraOrchestrator && this.mastraOrchestrator.getStatus) {
			return this.mastraOrchestrator.getStatus();
		}
		return { initialized: this.isInitialized };
	}

	async cleanup(): Promise<void> {
		if (this.mastraOrchestrator && this.mastraOrchestrator.cleanup) {
			await this.mastraOrchestrator.cleanup();
		}
		this.isInitialized = false;
	}
}
