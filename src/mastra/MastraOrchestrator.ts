import { Mastra } from "@mastra/core";
import { App } from "obsidian";
import type { AgentResponse, ChatMessage } from "./agents/types";
import type { IntelligencePluginSettings, MetadataFilter } from "../types";
import { ControllerAgent } from "./agents/ControllerAgent";

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
	private controllerAgent: ControllerAgent | null = null;
	private useAdvancedOrchestration = true;

	constructor(mastra: Mastra, config: MastraOrchestratorConfig) {
		this.mastra = mastra;
		this.config = config;
		this.initializeControllerAgent();
	}

	/**
	 * Main execution method that follows the expected interface
	 * Uses advanced multi-agent orchestration with task planning
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

			// Use advanced orchestration if controller agent is available
			if (this.useAdvancedOrchestration && this.controllerAgent) {
				return await this.runWithController(input, conversationId, chatHistory, metadataFilters);
			}

			// Fallback to original simple agent selection
			console.warn("Advanced orchestration not available, falling back to simple agent selection");
			return await this.runWithSimpleSelection(input, conversationId, chatHistory, metadataFilters);

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
					totalTokens: 0,
					metadataFilters: metadataFilters || []
				}
			};
		}
	}

	/**
	 * Initialize the controller agent for advanced orchestration
	 */
	private initializeControllerAgent(): void {
		try {
			const agents = this.mastra.getAgents();
			const availableAgents = new Map(Object.entries(agents));
			
			// Only initialize if we have agents available
			if (availableAgents.size > 0 && this.config.settings.openAIApiKey) {
				// We'll set this up later after tools are available
				console.log("Controller agent initialization deferred until tools are ready");
			} else {
				console.log("Controller agent not initialized: missing agents or API key");
				this.useAdvancedOrchestration = false;
			}
		} catch (error) {
			console.error("Failed to initialize controller agent:", error);
			this.useAdvancedOrchestration = false;
		}
	}

	/**
	 * Run with advanced controller agent orchestration
	 */
	private async runWithController(
		input: string, 
		conversationId: string, 
		chatHistory: ChatMessage[], 
		metadataFilters?: MetadataFilter[]
	): Promise<AgentResponse> {
		if (!this.controllerAgent) {
			throw new Error("Controller agent not initialized");
		}

		return await this.controllerAgent.executeDirectly(input, conversationId, chatHistory);
	}

	/**
	 * Run with simple agent selection (fallback mode)
	 */
	private async runWithSimpleSelection(
		input: string, 
		conversationId: string, 
		chatHistory: ChatMessage[], 
		metadataFilters?: MetadataFilter[]
	): Promise<AgentResponse> {
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
	}

	/**
	 * Select the appropriate agent based on the input query (legacy method)
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
	 * Set up the controller agent with tools implementation
	 */
	setupControllerAgent(toolsImplementation: import("./tools/ObsidianTools").ObsidianToolsImplementation): void {
		try {
			const agents = this.mastra.getAgents();
			const availableAgents = new Map(Object.entries(agents));
			
			if (availableAgents.size > 0 && this.config.settings.openAIApiKey) {
				this.controllerAgent = new ControllerAgent({
					openAIApiKey: this.config.settings.openAIApiKey,
					toolsImplementation,
					availableAgents,
					maxConcurrentTasks: 3,
					taskTimeout: 300000 // 5 minutes
				});
				
				// Add controller agent to Mastra instance
				const controllerMastraAgent = this.controllerAgent.getAgent();
				const currentAgents = this.mastra.getAgents();
				
				// Create a new Mastra instance with the controller agent
				this.mastra = new Mastra({
					agents: {
						...currentAgents,
						controller: controllerMastraAgent
					}
				});
				
				this.useAdvancedOrchestration = true;
				console.log("Controller agent initialized successfully");
			} else {
				console.warn("Cannot initialize controller agent: missing requirements");
				this.useAdvancedOrchestration = false;
			}
		} catch (error) {
			console.error("Failed to setup controller agent:", error);
			this.useAdvancedOrchestration = false;
		}
	}

	/**
	 * Enable or disable auto-approval for operations
	 */
	setAutoApproval(enabled: boolean): void {
		this.autoApprovalEnabled = enabled;
	}

	/**
	 * Toggle between advanced and simple orchestration modes
	 */
	setOrchestrationMode(useAdvanced: boolean): void {
		this.useAdvancedOrchestration = useAdvanced && this.controllerAgent !== null;
		console.log(`Orchestration mode set to: ${this.useAdvancedOrchestration ? 'advanced' : 'simple'}`);
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
			advancedOrchestration: {
				enabled: this.useAdvancedOrchestration,
				controllerInitialized: this.controllerAgent !== null,
				mode: this.useAdvancedOrchestration ? 'controller-based' : 'simple-selection'
			},
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
			// Perform any necessary cleanup ...
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
