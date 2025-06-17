// Controller Agent - Advanced orchestrator with task planning and multi-agent coordination
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { TaskDecomposer } from "../planning/TaskDecomposer";
import { ExecutionEngine, TaskExecutor } from "../planning/ExecutionEngine";
import { 
	ExecutionPlan, 
	Task, 
	TaskResult, 
	ExecutionContext, 
	AgentCapability,
	DecompositionRequest,
	AgentInteraction
} from "../planning/types";
import type { AgentResponse, ChatMessage } from "./types";
import { ObsidianToolsImplementation } from "../tools/ObsidianTools";

export interface ControllerAgentConfig {
	openAIApiKey: string;
	toolsImplementation: ObsidianToolsImplementation;
	availableAgents: Map<string, Agent>;
	maxConcurrentTasks?: number;
	taskTimeout?: number;
}

/**
 * Wrapper to make Mastra agents compatible with our task execution system
 */
class MastraTaskExecutor implements TaskExecutor {
	constructor(
		private agent: Agent,
		private agentId: string
	) {}

	async executeTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
		const startTime = Date.now();
		
		try {
			// Prepare messages for the agent
			const messages = [
				{
					role: "system" as const,
					content: `You are executing a specific task as part of a larger plan. 
					Task: ${task.description}
					Priority: ${task.priority}
					Context: ${JSON.stringify(context.sharedData, null, 2)}
					
					Please focus on completing this specific task efficiently and provide clear output.`
				},
				{
					role: "user" as const,
					content: this.formatTaskInput(task)
				}
			];

			// Generate response using the agent
			const response = await this.agent.generate(messages, {
				maxSteps: 3
			});

			const duration = Date.now() - startTime;
			const tokensUsed = response.usage?.totalTokens || 0;

			// Extract artifacts if any tool results contain file operations
			const artifacts = this.extractArtifacts(response, task);

			return {
				taskId: task.id,
				status: "completed",
				output: {
					content: response.text,
					toolResults: response.toolResults,
					artifacts: artifacts.map(a => a.id)
				},
				duration,
				agentUsed: this.agentId,
				tokensUsed,
				quality: this.assessQuality(response, task),
				artifacts
			};

		} catch (error) {
			const duration = Date.now() - startTime;
			return {
				taskId: task.id,
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				duration,
				agentUsed: this.agentId,
				tokensUsed: 0,
				quality: { score: 0, factors: { error: 1 } }
			};
		}
	}

	getAgentId(): string {
		return this.agentId;
	}

	isAvailable(): boolean {
		return true; // For now, assume agents are always available
	}

	private formatTaskInput(task: Task): string {
		const inputStr = Object.entries(task.input)
			.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
			.join("\n");
		
		return `Task Input:\n${inputStr}\n\nPlease complete this task and provide a clear response.`;
	}

	private extractArtifacts(response: any, task: Task): Array<any> {
		const artifacts: Array<any> = [];
		
		// Check tool results for file operations
		if (response.toolResults) {
			response.toolResults.forEach((result: any, index: number) => {
				if (result.toolName === "createNote" || result.toolName === "modifyNote") {
					artifacts.push({
						id: `artifact_${task.id}_${index}`,
						type: "document",
						name: result.args?.path || `Task ${task.id} Output`,
						content: result.args?.content || result.result,
						metadata: {
							taskId: task.id,
							toolUsed: result.toolName
						},
						createdAt: new Date(),
						createdBy: this.agentId
					});
				}
			});
		}
		
		return artifacts;
	}

	private assessQuality(response: any, task: Task): { score: number; factors: Record<string, number> } {
		const factors: Record<string, number> = {};
		
		// Basic quality factors
		factors.completeness = response.text && response.text.length > 50 ? 1 : 0.5;
		factors.toolUsage = response.toolResults && response.toolResults.length > 0 ? 1 : 0.7;
		factors.relevance = 0.8; // Would need semantic analysis for proper relevance scoring
		
		// Priority-based adjustments
		if (task.priority === "critical") {
			factors.completeness *= 1.2;
		}
		
		// Calculate overall score
		const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
		
		return {
			score: Math.min(score, 1.0),
			factors
		};
	}
}

export class ControllerAgent {
	private agent: Agent;
	private taskDecomposer: TaskDecomposer;
	private executionEngine: ExecutionEngine;
	private availableAgents: Map<string, Agent>;
	private agentCapabilities: AgentCapability[] = [];

	constructor(config: ControllerAgentConfig) {
		this.availableAgents = config.availableAgents;
		this.initializeAgentCapabilities();
		
		// Initialize task decomposer
		this.taskDecomposer = new TaskDecomposer(config.openAIApiKey);
		this.taskDecomposer.updateAgentCapabilities(this.agentCapabilities);
		
		// Initialize execution engine
		this.executionEngine = new ExecutionEngine({
			maxConcurrentTasks: config.maxConcurrentTasks || 3,
			taskTimeout: config.taskTimeout || 300000, // 5 minutes
			enableRetries: true,
			maxRetryDelay: 10000
		});
		
		// Register task executors for each agent
		this.registerTaskExecutors();
		
		// Create the controller agent
		this.agent = new Agent({
			name: "Controller",
			instructions: `You are the Controller Agent, an advanced orchestrator for a multi-agent Obsidian intelligence system.

Your primary responsibilities:
1. Analyze complex user queries and break them into executable tasks
2. Coordinate multiple specialized agents to work together
3. Manage both sequential and parallel execution workflows
4. Monitor task progress and handle failures gracefully
5. Synthesize results from multiple agents into coherent responses
6. Ensure efficient resource utilization and task prioritization

Available specialized agents and their capabilities:
${this.formatAgentCapabilities()}

You have access to advanced planning tools that can:
- Decompose complex queries into executable task graphs
- Execute plans with proper dependency management
- Coordinate parallel and sequential workflows
- Handle retries and error recovery
- Aggregate results from multiple agents

Always aim to provide comprehensive, accurate responses by leveraging the full multi-agent system effectively.`,
			model: openai("gpt-4o"),
			tools: {
				planAndExecute: {
					description: "Decompose a complex query into tasks and execute them using multiple agents",
					parameters: z.object({
						userQuery: z.string().describe("The user's query to process"),
						conversationId: z.string().describe("Current conversation ID"),
						chatHistory: z.array(z.object({
							role: z.enum(["user", "assistant", "system"]),
							content: z.string(),
							timestamp: z.string()
						})).describe("Recent chat history for context"),
						executionMode: z.enum(["sequential", "parallel", "auto"]).default("auto").describe("Execution mode preference"),
						requireApproval: z.boolean().default(false).describe("Whether to require user approval before execution")
					}),
					execute: async ({ userQuery, conversationId, chatHistory, executionMode, requireApproval }) => {
						return await this.planAndExecute({
							userQuery,
							conversationId,
							chatHistory: chatHistory.map(msg => ({
								...msg,
								timestamp: new Date(msg.timestamp)
							})),
							executionMode: executionMode === "auto" ? "parallel" : executionMode,
							requireApproval
						});
					}
				},
				getExecutionStatus: {
					description: "Get the current status of task execution",
					parameters: z.object({
						planId: z.string().optional().describe("Specific plan ID to check")
					}),
					execute: async ({ planId }) => {
						return this.getExecutionStatus(planId);
					}
				},
				coordinateAgents: {
					description: "Coordinate specific agents for a collaborative task",
					parameters: z.object({
						task: z.string().describe("The collaborative task to perform"),
						agentIds: z.array(z.string()).describe("Specific agents to coordinate"),
						context: z.record(z.any()).describe("Additional context for the task")
					}),
					execute: async ({ task, agentIds, context }) => {
						return await this.coordinateAgents(task, agentIds, context);
					}
				}
			}
		});
	}

	/**
	 * Main method to plan and execute complex queries
	 */
	private async planAndExecute(params: {
		userQuery: string;
		conversationId: string;
		chatHistory: ChatMessage[];
		executionMode: "sequential" | "parallel";
		requireApproval: boolean;
	}): Promise<any> {
		try {
			// Create decomposition request
			const decompositionRequest: DecompositionRequest = {
				userQuery: params.userQuery,
				context: {
					conversationId: params.conversationId,
					chatHistory: params.chatHistory,
					availableAgents: this.agentCapabilities
				}
			};

			// Decompose the query into tasks
			const decompositionResult = await this.taskDecomposer.decompose(decompositionRequest);
			
			if (!decompositionResult.success) {
				return {
					success: false,
					error: decompositionResult.error,
					fallbackPlan: decompositionResult.plan
				};
			}

			const plan = decompositionResult.plan;
			plan.mode = params.executionMode;

			// Check if approval is required
			if (params.requireApproval || plan.metadata.requiresUserApproval) {
				return {
					success: true,
					requiresApproval: true,
					plan: {
						id: plan.id,
						name: plan.name,
						description: plan.description,
						tasks: plan.tasks.map(t => ({
							id: t.id,
							description: t.description,
							agentId: t.agentId,
							priority: t.priority,
							riskLevel: t.metadata.riskLevel
						})),
						estimatedDuration: plan.estimatedDuration,
						mode: plan.mode
					},
					reasoning: decompositionResult.reasoning
				};
			}

			// Create execution context
			const executionContext: ExecutionContext = {
				planId: plan.id,
				conversationId: params.conversationId,
				completedTasks: [],
				failedTasks: [],
				sharedData: {},
				userPreferences: {},
				sessionStartTime: new Date(),
				totalTokensUsed: 0,
				agentInteractions: []
			};

			// Execute the plan
			const executionResult = await this.executionEngine.executePlan(plan, executionContext);

			// Synthesize results
			const synthesizedResponse = await this.synthesizeResults(
				executionResult.results,
				params.userQuery,
				executionContext
			);

			return {
				success: executionResult.success,
				response: synthesizedResponse,
				executionSummary: {
					tasksCompleted: executionResult.results.filter(r => r.status === "completed").length,
					tasksFailed: executionResult.results.filter(r => r.status === "failed").length,
					totalDuration: executionResult.duration,
					tokensUsed: executionContext.totalTokensUsed
				},
				plan: {
					id: plan.id,
					name: plan.name,
					mode: plan.mode
				},
				errors: executionResult.errors
			};

		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Coordinate specific agents for collaborative tasks
	 */
	private async coordinateAgents(task: string, agentIds: string[], context: Record<string, any>): Promise<any> {
		const results: any[] = [];
		
		for (const agentId of agentIds) {
			const agent = this.availableAgents.get(agentId);
			if (!agent) {
				results.push({
					agentId,
					success: false,
					error: `Agent ${agentId} not found`
				});
				continue;
			}

			try {
				const messages = [
					{
						role: "system" as const,
						content: `You are collaborating with other agents on this task: ${task}`
					},
					{
						role: "user" as const,
						content: `Context: ${JSON.stringify(context)}\n\nPlease complete your part of this collaborative task: ${task}`
					}
				];

				const response = await agent.generate(messages, { maxSteps: 2 });
				
				results.push({
					agentId,
					success: true,
					response: response.text,
					toolResults: response.toolResults
				});

			} catch (error) {
				results.push({
					agentId,
					success: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		return {
			task,
			results,
			summary: `Coordinated ${agentIds.length} agents for collaborative task`
		};
	}

	/**
	 * Get execution status information
	 */
	private getExecutionStatus(planId?: string): any {
		const stats = this.executionEngine.getExecutionStats();
		
		return {
			currentStatus: {
				runningTasks: stats.runningTasks,
				availableAgents: this.availableAgents.size,
				registeredExecutors: stats.registeredExecutors
			},
			agentCapabilities: this.agentCapabilities.map(cap => ({
				agentId: cap.agentId,
				currentLoad: cap.currentLoad,
				successRate: cap.successRate
			}))
		};
	}

	/**
	 * Synthesize results from multiple task executions
	 */
	private async synthesizeResults(
		results: TaskResult[], 
		originalQuery: string, 
		context: ExecutionContext
	): Promise<string> {
		const completedResults = results.filter(r => r.status === "completed");
		const failedResults = results.filter(r => r.status === "failed");

		if (completedResults.length === 0) {
			return `I apologize, but I wasn't able to complete your request successfully. ${failedResults.length} tasks failed during execution.`;
		}

		// Combine all successful outputs
		const combinedOutput = completedResults.map(result => {
			const output = result.output;
			if (typeof output?.content === "string") {
				return output.content;
			}
			return JSON.stringify(output);
		}).join("\n\n");

		// Use LLM to synthesize a coherent response
		try {
			const synthesisMessages = [
				{
					role: "system" as const,
					content: "You are synthesizing results from multiple specialized agents. Create a coherent, comprehensive response that addresses the user's original query."
				},
				{
					role: "user" as const,
					content: `Original Query: "${originalQuery}"

Agent Results:
${combinedOutput}

${failedResults.length > 0 ? `\nNote: ${failedResults.length} tasks failed during execution.` : ""}

Please synthesize these results into a comprehensive response that directly addresses the user's query.`
				}
			];

			const synthesisResponse = await this.agent.generate(synthesisMessages, { maxSteps: 1 });
			return synthesisResponse.text || combinedOutput;

		} catch (error) {
			console.error("Result synthesis failed:", error);
			return combinedOutput; // Fallback to raw output
		}
	}

	/**
	 * Initialize agent capabilities registry
	 */
	private initializeAgentCapabilities(): void {
		this.agentCapabilities = Array.from(this.availableAgents.entries()).map(([agentId, agent]) => ({
			agentId,
			capabilities: this.getAgentCapabilities(agentId),
			specializations: this.getAgentSpecializations(agentId),
			averageResponseTime: 5000, // Default 5 seconds
			successRate: 0.9, // Default 90% success rate
			currentLoad: 0,
			maxConcurrentTasks: 2
		}));
	}

	/**
	 * Register task executors for each available agent
	 */
	private registerTaskExecutors(): void {
		this.availableAgents.forEach((agent, agentId) => {
			const executor = new MastraTaskExecutor(agent, agentId);
			this.executionEngine.registerExecutor(agentId, executor);
		});
	}

	/**
	 * Get capabilities for a specific agent
	 */
	private getAgentCapabilities(agentId: string): string[] {
		const capabilityMap: Record<string, string[]> = {
			research: ["search", "analyze", "retrieve", "summarize"],
			refactoring: ["code_analysis", "create", "modify", "optimize"],
			safety: ["validate", "assess_risk", "approve"],
			supervisor: ["coordinate", "plan", "synthesize"]
		};
		
		return capabilityMap[agentId] || ["general"];
	}

	/**
	 * Get specializations for a specific agent
	 */
	private getAgentSpecializations(agentId: string): string[] {
		const specializationMap: Record<string, string[]> = {
			research: ["semantic_search", "knowledge_retrieval", "document_analysis"],
			refactoring: ["code_improvement", "document_creation", "content_structuring"],
			safety: ["risk_assessment", "operation_validation", "data_protection"],
			supervisor: ["multi_agent_coordination", "task_planning", "result_synthesis"]
		};
		
		return specializationMap[agentId] || ["general_purpose"];
	}

	/**
	 * Format agent capabilities for system prompt
	 */
	private formatAgentCapabilities(): string {
		return this.agentCapabilities.map(cap => 
			`- ${cap.agentId}: ${cap.capabilities.join(", ")} (specializes in: ${cap.specializations.join(", ")})`
		).join("\n");
	}

	/**
	 * Get the underlying Mastra agent for external use
	 */
	getAgent(): Agent {
		return this.agent;
	}

	/**
	 * Handle direct execution requests (for backward compatibility)
	 */
	async executeDirectly(userQuery: string, conversationId: string, chatHistory: ChatMessage[]): Promise<AgentResponse> {
		try {
			const result = await this.planAndExecute({
				userQuery,
				conversationId,
				chatHistory,
				executionMode: "parallel",
				requireApproval: false
			});

			return {
				success: result.success,
				content: result.response || result.error || "No response generated",
				agentUsed: "controller",
				confidence: result.success ? 0.9 : 0.1,
				sources: result.executionSummary ? [`Executed ${result.executionSummary.tasksCompleted} tasks`] : [],
				metadata: {
					conversationId,
					...result.executionSummary,
					planId: result.plan?.id
				}
			};

		} catch (error) {
			return {
				success: false,
				content: `Controller agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
				agentUsed: "controller",
				confidence: 0.0,
				error: error instanceof Error ? error.message : String(error),
				metadata: { conversationId }
			};
		}
	}
}