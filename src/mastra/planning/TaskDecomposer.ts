// Task decomposition engine for breaking complex queries into executable tasks
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { 
	DecompositionRequest, 
	DecompositionResult, 
	ExecutionPlan, 
	Task, 
	TaskDependency,
	TaskPlanningError,
	AgentCapability 
} from "./types";

// Schema for LLM-generated task decomposition
const TaskDecompositionSchema = z.object({
	planName: z.string().describe("A concise name for the execution plan"),
	planDescription: z.string().describe("Brief description of what the plan accomplishes"),
	complexity: z.enum(["simple", "moderate", "complex"]).describe("Overall complexity level"),
	executionMode: z.enum(["sequential", "parallel"]).describe("Whether tasks can run in parallel"),
	requiresApproval: z.boolean().describe("Whether the plan requires user approval before execution"),
	estimatedDuration: z.number().describe("Estimated duration in minutes"),
	tasks: z.array(z.object({
		id: z.string().describe("Unique identifier for the task"),
		type: z.string().describe("Type of task (search, analyze, create, etc.)"),
		description: z.string().describe("Clear description of what the task does"),
		priority: z.enum(["low", "medium", "high", "critical"]).describe("Task priority level"),
		agentType: z.string().describe("Type of agent best suited for this task"),
		dependencies: z.array(z.string()).describe("IDs of tasks this task depends on"),
		input: z.record(z.any()).optional().default({}).describe("Input parameters for the task"),
		estimatedDuration: z.number().describe("Estimated duration in minutes"),
		requiresApproval: z.boolean().describe("Whether this specific task needs approval"),
		riskLevel: z.enum(["low", "medium", "high"]).describe("Risk level of the task"),
		tags: z.array(z.string()).describe("Tags for categorizing the task")
	})).describe("List of tasks to execute"),
	dependencies: z.array(z.object({
		from: z.string().describe("Source task ID"),
		to: z.string().describe("Target task ID"),
		type: z.enum(["hard", "soft"]).describe("Hard dependencies block execution, soft are preferred order"),
		condition: z.string().optional().describe("Optional condition for the dependency")
	})).describe("Task dependencies"),
	reasoning: z.string().describe("Explanation of the decomposition strategy")
});

export class TaskDecomposer {
	private model: any;
	private availableAgents: Map<string, AgentCapability> = new Map();

	constructor(apiKey: string) {
		this.model = openai("gpt-4o");
	}

	/**
	 * Update the registry of available agents and their capabilities
	 */
	updateAgentCapabilities(agents: AgentCapability[]): void {
		this.availableAgents.clear();
		agents.forEach(agent => {
			this.availableAgents.set(agent.agentId, agent);
		});
	}

	/**
	 * Decompose a user query into an executable plan
	 */
	async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
		try {
			// Prepare context for the LLM
			const agentCapabilities = Array.from(this.availableAgents.values());
			const systemPrompt = this.buildSystemPrompt(agentCapabilities);
			const userPrompt = this.buildUserPrompt(request);

			// Generate the task decomposition using structured output
			const result = await generateObject({
				model: this.model,
				system: systemPrompt,
				prompt: userPrompt,
				schema: TaskDecompositionSchema,
				temperature: 0.3, // Lower temperature for more consistent planning
			});

			// Convert the LLM output to our internal format
			const plan = this.convertToExecutionPlan(result.object, request);
			
			// Validate the plan
			const validation = this.validatePlan(plan);
			if (!validation.isValid) {
				throw new TaskPlanningError(
					`Plan validation failed: ${validation.errors.join(", ")}`,
					"VALIDATION_ERROR",
					{ errors: validation.errors }
				);
			}

			return {
				success: true,
				plan,
				reasoning: result.object.reasoning,
				warnings: validation.warnings
			};

		} catch (error) {
			console.error("Task decomposition failed:", error);
			return {
				success: false,
				plan: this.createFallbackPlan(request),
				reasoning: "Decomposition failed, using fallback plan",
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Build the system prompt for task decomposition
	 */
	private buildSystemPrompt(agentCapabilities: AgentCapability[]): string {
		const agentDescriptions = agentCapabilities.map(agent => 
			`- ${agent.agentId}: ${agent.capabilities.join(", ")} (specializes in: ${agent.specializations.join(", ")})`
		).join("\n");

		return `You are an expert task planner for an Obsidian intelligence system. Your role is to analyze user queries and decompose them into executable tasks that can be assigned to specialized agents.

Available Agents:
${agentDescriptions}

Guidelines for task decomposition:
1. Break complex queries into atomic, executable tasks
2. Identify dependencies between tasks (what must complete before what)
3. Choose the most appropriate agent type for each task
4. Consider parallel execution when tasks are independent
5. Assess risk levels and approval requirements
6. Provide clear, actionable task descriptions
7. Estimate realistic durations based on task complexity
8. Always include an "input" property for each task (can be empty object {} if no specific input needed)

Task Types:
- search: Find information in the vault
- analyze: Analyze content or relationships
- create: Create new content or documents
- modify: Edit existing content
- summarize: Summarize information
- validate: Check safety or correctness
- coordinate: Manage multi-step processes

Agent Types:
- research: Best for search, analysis, and information retrieval
- refactoring: Best for code analysis and content creation
- safety: Best for validation and risk assessment
- supervisor: Best for coordination and complex planning

Focus on creating efficient, safe, and user-friendly execution plans.`;
	}

	/**
	 * Build the user prompt with query and context
	 */
	private buildUserPrompt(request: DecompositionRequest): string {
		const { userQuery, context } = request;
		const recentHistory = context.chatHistory.slice(-3).map(msg => 
			`${msg.role}: ${msg.content}`
		).join("\n");

		return `Please decompose this user query into an executable plan:

User Query: "${userQuery}"

Context:
- Conversation ID: ${context.conversationId}
- Available agents: ${context.availableAgents.map(a => a.agentId).join(", ")}
- Recent conversation:
${recentHistory}

${context.vaultContext ? `
Vault Context:
- Document count: ${context.vaultContext.documentCount}
- Last indexed: ${context.vaultContext.lastIndexed.toISOString()}
- Available tags: ${context.vaultContext.tags.join(", ")}
` : ""}

Create a comprehensive execution plan that breaks down the query into specific, actionable tasks.`;
	}

	/**
	 * Convert LLM output to internal ExecutionPlan format
	 */
	private convertToExecutionPlan(llmOutput: any, request: DecompositionRequest): ExecutionPlan {
		const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const tasks: Task[] = llmOutput.tasks.map((taskData: any) => ({
			id: taskData.id,
			type: taskData.type,
			description: taskData.description,
			status: "pending" as const,
			priority: taskData.priority,
			agentId: this.selectBestAgent(taskData.agentType, taskData.type),
			dependencies: taskData.dependencies,
			children: [],
			createdAt: new Date(),
			input: taskData.input !== undefined ? taskData.input : {},
			metadata: {
				conversationId: request.context.conversationId,
				userIntent: request.userQuery,
				estimatedDuration: taskData.estimatedDuration,
				confidence: 0.8,
				requiresApproval: taskData.requiresApproval,
				riskLevel: taskData.riskLevel,
				tags: taskData.tags,
				context: {}
			},
			retryCount: 0,
			maxRetries: 3
		}));

		const dependencies: TaskDependency[] = llmOutput.dependencies.map((dep: any) => ({
			from: dep.from,
			to: dep.to,
			type: dep.type,
			condition: dep.condition
		}));

		return {
			id: planId,
			name: llmOutput.planName,
			description: llmOutput.planDescription,
			mode: llmOutput.executionMode,
			tasks,
			dependencies,
			estimatedDuration: llmOutput.estimatedDuration,
			createdAt: new Date(),
			status: "pending",
			metadata: {
				conversationId: request.context.conversationId,
				userQuery: request.userQuery,
				complexity: llmOutput.complexity,
				requiresUserApproval: llmOutput.requiresApproval
			}
		};
	}

	/**
	 * Select the best available agent for a task
	 */
	private selectBestAgent(agentType: string, taskType: string): string {
		// Try to find an agent that matches the suggested type
		const preferredAgent = Array.from(this.availableAgents.values())
			.find(agent => agent.agentId.toLowerCase().includes(agentType.toLowerCase()));
		
		if (preferredAgent && preferredAgent.currentLoad < preferredAgent.maxConcurrentTasks) {
			return preferredAgent.agentId;
		}

		// Fallback to capability-based matching
		const matchingAgents = Array.from(this.availableAgents.values())
			.filter(agent => 
				agent.capabilities.some(cap => cap.toLowerCase().includes(taskType.toLowerCase())) ||
				agent.specializations.some(spec => spec.toLowerCase().includes(taskType.toLowerCase()))
			)
			.sort((a, b) => a.currentLoad - b.currentLoad);

		return matchingAgents.length > 0 ? matchingAgents[0].agentId : "supervisor";
	}

	/**
	 * Validate the generated execution plan
	 */
	private validatePlan(plan: ExecutionPlan): { isValid: boolean; errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for circular dependencies
		if (this.hasCircularDependencies(plan.tasks, plan.dependencies)) {
			errors.push("Circular dependencies detected in task graph");
		}

		// Check for orphaned tasks
		const orphanedTasks = plan.tasks.filter(task => 
			task.dependencies.some(depId => !plan.tasks.find(t => t.id === depId))
		);
		if (orphanedTasks.length > 0) {
			errors.push(`Tasks with invalid dependencies: ${orphanedTasks.map(t => t.id).join(", ")}`);
		}

		// Check for unassigned tasks
		const unassignedTasks = plan.tasks.filter(task => !task.agentId);
		if (unassignedTasks.length > 0) {
			warnings.push(`Tasks without assigned agents: ${unassignedTasks.map(t => t.id).join(", ")}`);
		}

		// Check for high-risk tasks without approval
		const riskyTasks = plan.tasks.filter(task => 
			task.metadata.riskLevel === "high" && !task.metadata.requiresApproval
		);
		if (riskyTasks.length > 0) {
			warnings.push(`High-risk tasks without approval requirement: ${riskyTasks.map(t => t.id).join(", ")}`);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Check for circular dependencies in the task graph
	 */
	private hasCircularDependencies(tasks: Task[], dependencies: TaskDependency[]): boolean {
		const graph = new Map<string, string[]>();
		
		// Build adjacency list
		tasks.forEach(task => graph.set(task.id, []));
		dependencies.forEach(dep => {
			const deps = graph.get(dep.from) || [];
			deps.push(dep.to);
			graph.set(dep.from, deps);
		});

		// DFS to detect cycles
		const visited = new Set<string>();
		const recursionStack = new Set<string>();

		const hasCycle = (node: string): boolean => {
			if (recursionStack.has(node)) return true;
			if (visited.has(node)) return false;

			visited.add(node);
			recursionStack.add(node);

			const neighbors = graph.get(node) || [];
			for (const neighbor of neighbors) {
				if (hasCycle(neighbor)) return true;
			}

			recursionStack.delete(node);
			return false;
		};

		return Array.from(graph.keys()).some(hasCycle);
	}

	/**
	 * Create a simple fallback plan when decomposition fails
	 */
	private createFallbackPlan(request: DecompositionRequest): ExecutionPlan {
		const planId = `fallback_${Date.now()}`;
		const taskId = `task_${Date.now()}`;

		const fallbackTask: Task = {
			id: taskId,
			type: "search",
			description: `Process user query: ${request.userQuery}`,
			status: "pending",
			priority: "medium",
			agentId: "supervisor",
			dependencies: [],
			children: [],
			createdAt: new Date(),
			input: { query: request.userQuery },
			metadata: {
				conversationId: request.context.conversationId,
				userIntent: request.userQuery,
				confidence: 0.5,
				requiresApproval: false,
				riskLevel: "low",
				tags: ["fallback"],
				context: { fallback: true }
			},
			retryCount: 0,
			maxRetries: 1
		};

		return {
			id: planId,
			name: "Fallback Plan",
			description: "Simple fallback execution plan",
			mode: "sequential",
			tasks: [fallbackTask],
			dependencies: [],
			estimatedDuration: 5,
			createdAt: new Date(),
			status: "pending",
			metadata: {
				conversationId: request.context.conversationId,
				userQuery: request.userQuery,
				complexity: "simple",
				requiresUserApproval: false
			}
		};
	}
}