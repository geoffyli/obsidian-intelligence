import { Mastra } from "@mastra/core";
import { App } from "obsidian";
import type { AgentResponse, ChatMessage } from "./agents/types";
import type { IntelligencePluginSettings, MetadataFilter } from "../types";

export interface MastraOrchestratorConfig {
	app: App;
	settings: IntelligencePluginSettings;
	plugin: import("../main").default;
	dataDir?: string;
}

export interface RunOptions {
	input: string;
	conversationId: string;
	chatHistory: ChatMessage[];
	metadataFilters?: MetadataFilter[];
}

/**
 * Wrapper class that provides a standardized interface for running Mastra agents
 * This class encapsulates the Mastra instance and provides the expected run() method
 */
export class MastraOrchestrator {
	private mastra: Mastra;
	private autoApprovalEnabled = false;
	private config: MastraOrchestratorConfig;

	constructor(mastra: Mastra, config: MastraOrchestratorConfig) {
		this.mastra = mastra;
		this.config = config;
	}

	/**
	 * Main execution method that follows the expected interface
	 * Routes queries to appropriate agents and returns structured responses
	 */
	async run(options: RunOptions): Promise<AgentResponse> {
		const { input, conversationId, chatHistory, metadataFilters } = options;

		try {
			// Validate input
			if (!input || input.trim().length === 0) {
				throw new Error("Input query cannot be empty");
			}

			// Validate API key is configured
			if (!this.config.settings.openAIApiKey) {
				throw new Error("OpenAI API key is not configured. Please set your API key in plugin settings.");
			}

			// Debug: Log API key status (without revealing the key)
			console.log("MastraOrchestrator: API key configured:", !!this.config.settings.openAIApiKey);
			console.log("MastraOrchestrator: API key length:", this.config.settings.openAIApiKey?.length || 0);
			console.log("MastraOrchestrator: API key starts with 'sk-':", this.config.settings.openAIApiKey?.startsWith('sk-') || false);

			// Determine which agent to use based on the query
			const agentName = this.selectAgent(input);
			
			// Validate agent exists
			const agent = this.mastra.getAgent(agentName);
			if (!agent) {
				console.error(`Agent '${agentName}' not found. Available agents:`, Object.keys(this.mastra.getAgents()));
				throw new Error(`Agent '${agentName}' not found. Please check system configuration.`);
			}

			// Convert chat history to Mastra format
			const messages = chatHistory.map(msg => ({
				role: msg.role as "user" | "assistant",
				content: msg.content
			}));

			// Add the current user input
			messages.push({
				role: "user" as const,
				content: input
			});

			// Generate response using the selected agent
			const response = await agent.generate(messages, {
				maxSteps: 5, // Allow multi-step reasoning with tools
			});

			return {
				success: true,
				content: response.text || "No response generated",
				agentUsed: agentName,
				confidence: 0.8, // Default confidence score
				sources: response.toolResults?.map(tr => tr.toolName) || [],
				metadata: {
					conversationId,
					inputTokens: response.usage?.promptTokens || 0,
					outputTokens: response.usage?.completionTokens || 0,
					totalTokens: response.usage?.totalTokens || 0,
					finishReason: response.finishReason || "stop",
					toolsUsed: response.toolResults?.map(tr => tr.toolName) || [],
					metadataFilters: metadataFilters || []
				}
			};

		} catch (error) {
			console.error("MastraOrchestrator run error:", error);
			
			// Return error response in expected format
			return {
				success: false,
				content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}`,
				agentUsed: "error",
				confidence: 0.0,
				error: error instanceof Error ? error.message : String(error),
				metadata: {
					conversationId,
					error: error instanceof Error ? error.message : String(error),
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0
				}
			};
		}
	}

	/**
	 * Select the appropriate agent based on the input query
	 */
	private selectAgent(input: string): string {
		const lowerInput = input.toLowerCase();

		// Research agent for search and knowledge queries
		if (
			lowerInput.includes("search") ||
			lowerInput.includes("find") ||
			lowerInput.includes("what") ||
			lowerInput.includes("who") ||
			lowerInput.includes("when") ||
			lowerInput.includes("where") ||
			lowerInput.includes("how") ||
			lowerInput.includes("tell me about") ||
			lowerInput.includes("explain") ||
			lowerInput.includes("summarize")
		) {
			return "research";
		}

		// Refactoring agent for code-related queries
		if (
			lowerInput.includes("refactor") ||
			lowerInput.includes("code") ||
			lowerInput.includes("function") ||
			lowerInput.includes("class") ||
			lowerInput.includes("improve") ||
			lowerInput.includes("optimize") ||
			lowerInput.includes("clean up") ||
			lowerInput.includes("restructure")
		) {
			return "refactoring";
		}

		// Safety agent for potentially destructive operations
		if (
			lowerInput.includes("delete") ||
			lowerInput.includes("remove") ||
			lowerInput.includes("destroy") ||
			lowerInput.includes("clear") ||
			lowerInput.includes("reset") ||
			lowerInput.includes("wipe")
		) {
			return "safety";
		}

		// Default to supervisor agent for general queries and coordination
		return "supervisor";
	}

	/**
	 * Enable or disable auto-approval for operations
	 */
	setAutoApproval(enabled: boolean): void {
		this.autoApprovalEnabled = enabled;
	}

	/**
	 * Get the current status of the orchestrator
	 */
	getStatus(): Record<string, unknown> {
		const agents = this.mastra.getAgents();
		
		return {
			initialized: true,
			autoApprovalEnabled: this.autoApprovalEnabled,
			availableAgents: Object.keys(agents),
			agentCount: Object.keys(agents).length,
			config: {
				dataDir: this.config.dataDir,
				hasOpenAIKey: !!this.config.settings.openAIApiKey
			}
		};
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		try {
			// Perform any necessary cleanup
			console.log("MastraOrchestrator cleanup completed");
		} catch (error) {
			console.error("Error during MastraOrchestrator cleanup:", error);
		}
	}

	/**
	 * Get the underlying Mastra instance (for advanced usage)
	 */
	getMastraInstance(): Mastra {
		return this.mastra;
	}
}
