// Example workflow demonstrating multi-agent collaboration
import { ControllerAgent } from "../agents/ControllerAgent";
import { TaskDecomposer } from "../planning/TaskDecomposer";
import { ExecutionEngine } from "../planning/ExecutionEngine";
import { AgentCommunicationProtocol } from "../communication/AgentCommunicationProtocol";
import { MastraMemoryManager } from "../memory/MastraMemoryManager";
import { DecompositionRequest, ExecutionContext, AgentCapability } from "../planning/types";
import { AgentCapabilityInfo } from "../communication/AgentCommunicationProtocol";

/**
 * Example demonstrating how the enhanced multi-agent system works
 * 
 * Scenario: User asks "Find all my research notes about machine learning, 
 * summarize the key concepts, and create a structured overview document"
 * 
 * This requires:
 * 1. Research Agent: Search for ML-related notes
 * 2. Research Agent: Extract and analyze key concepts
 * 3. Refactoring Agent: Create structured overview document
 * 4. Safety Agent: Validate the document creation operation
 */

export interface ExampleConfig {
	openAIApiKey: string;
	dataDir: string;
	enableCommunication: boolean;
	enableParallelExecution: boolean;
}

export class MultiAgentWorkflowExample {
	private config: ExampleConfig;
	private memoryManager: MastraMemoryManager;
	private communicationProtocol: AgentCommunicationProtocol;
	private taskDecomposer: TaskDecomposer;
	private executionEngine: ExecutionEngine;
	private controllerAgent: ControllerAgent | null = null;

	constructor(config: ExampleConfig, app: any) {
		this.config = config;
		
		// Initialize memory manager
		this.memoryManager = new MastraMemoryManager(app, {
			dataDir: config.dataDir,
			fileName: "workflow_example_memory.json"
		});

		// Initialize communication protocol
		this.communicationProtocol = new AgentCommunicationProtocol(this.memoryManager);

		// Initialize task decomposer
		this.taskDecomposer = new TaskDecomposer(config.openAIApiKey);

		// Initialize execution engine
		this.executionEngine = new ExecutionEngine({
			maxConcurrentTasks: config.enableParallelExecution ? 3 : 1,
			taskTimeout: 300000, // 5 minutes
			enableRetries: true,
			maxRetryDelay: 10000
		});
	}

	/**
	 * Initialize the example workflow system
	 */
	async initialize(): Promise<void> {
		console.log("Initializing Multi-Agent Workflow Example...");

		try {
			// Initialize memory manager
			await this.memoryManager.initialize();
			console.log("✓ Memory manager initialized");

			// Initialize communication protocol if enabled
			if (this.config.enableCommunication) {
				await this.communicationProtocol.initialize();
				console.log("✓ Communication protocol initialized");
			}

			// Setup mock agent capabilities for demonstration
			const mockAgentCapabilities = this.createMockAgentCapabilities();
			this.taskDecomposer.updateAgentCapabilities(mockAgentCapabilities);

			// Register agents with communication protocol
			if (this.config.enableCommunication) {
				mockAgentCapabilities.forEach(capability => {
					const capabilityInfo: AgentCapabilityInfo = {
						...capability,
						isAvailable: true,
						lastSeen: new Date()
					};
					this.communicationProtocol.registerAgent(capability.agentId, capabilityInfo);
				});
			}

			console.log("✓ Multi-Agent Workflow Example initialized successfully");
		} catch (error) {
			console.error("Failed to initialize workflow example:", error);
			throw error;
		}
	}

	/**
	 * Run the example workflow
	 */
	async runExample(): Promise<void> {
		console.log("\n🚀 Starting Multi-Agent Workflow Example");
		console.log("=====================================");

		const userQuery = "Find all my research notes about machine learning, summarize the key concepts, and create a structured overview document";
		const conversationId = `example_${Date.now()}`;

		try {
			// Step 1: Demonstrate Task Decomposition
			console.log("\n1️⃣  Task Decomposition Phase");
			console.log("-".repeat(40));
			
			const decompositionRequest: DecompositionRequest = {
				userQuery,
				context: {
					conversationId,
					chatHistory: [
						{
							role: "user",
							content: userQuery,
							timestamp: new Date()
						}
					],
					availableAgents: this.createMockAgentCapabilities()
				}
			};

			const decompositionResult = await this.taskDecomposer.decompose(decompositionRequest);
			
			if (!decompositionResult.success) {
				throw new Error(`Task decomposition failed: ${decompositionResult.error}`);
			}

			console.log(`✓ Query decomposed into ${decompositionResult.plan.tasks.length} tasks`);
			console.log(`✓ Execution mode: ${decompositionResult.plan.mode}`);
			console.log(`✓ Estimated duration: ${decompositionResult.plan.estimatedDuration} minutes`);
			
			// Display the generated tasks
			decompositionResult.plan.tasks.forEach((task, index) => {
				console.log(`   Task ${index + 1}: ${task.description} (${task.agentId})`);
			});

			// Step 2: Demonstrate Agent Communication (if enabled)
			if (this.config.enableCommunication) {
				console.log("\n2️⃣  Agent Communication Phase");
				console.log("-".repeat(40));
				await this.demonstrateAgentCommunication(conversationId);
			}

			// Step 3: Demonstrate Execution Planning
			console.log("\n3️⃣  Execution Planning Phase");
			console.log("-".repeat(40));
			
			const executionContext: ExecutionContext = {
				planId: decompositionResult.plan.id,
				conversationId,
				completedTasks: [],
				failedTasks: [],
				sharedData: {
					userQuery,
					searchResults: [],
					keyConceptsExtracted: false
				},
				userPreferences: {
					preferredFormat: "markdown",
					includeReferences: true
				},
				sessionStartTime: new Date(),
				totalTokensUsed: 0,
				agentInteractions: []
			};

			// Store execution context
			await this.memoryManager.storeExecutionContext(executionContext);
			console.log("✓ Execution context created and stored");

			// Step 4: Simulate Task Execution
			console.log("\n4️⃣  Task Execution Simulation");
			console.log("-".repeat(40));
			await this.simulateTaskExecution(decompositionResult.plan, executionContext);

			// Step 5: Demonstrate Result Aggregation
			console.log("\n5️⃣  Result Aggregation");
			console.log("-".repeat(40));
			await this.demonstrateResultAggregation(executionContext);

			console.log("\n🎉 Multi-Agent Workflow Example completed successfully!");

		} catch (error) {
			console.error("\n❌ Workflow example failed:", error);
			throw error;
		}
	}

	/**
	 * Demonstrate agent communication capabilities
	 */
	private async demonstrateAgentCommunication(conversationId: string): Promise<void> {
		try {
			// Simulate research agent requesting assistance from refactoring agent
			const assistanceRequest = await this.communicationProtocol.requestAssistance({
				fromAgent: "research",
				toAgent: "broadcast",
				subject: "Need help with document structuring",
				content: "I have extracted key ML concepts. Need assistance with creating a structured overview document.",
				priority: "medium",
				conversationId,
				requiresResponse: true,
				requestedCapabilities: ["document_creation", "content_structuring"],
				context: {
					extractedConcepts: ["supervised learning", "neural networks", "deep learning"],
					preferredFormat: "markdown"
				},
				urgency: "medium",
				timeoutMs: 30000,
				metadata: {}
			});

			console.log(`✓ Assistance request sent, received ${assistanceRequest.length} responses`);

			// Simulate capability query
			const capableAgents = this.communicationProtocol.findCapableAgents(["document_creation"]);
			console.log(`✓ Found ${capableAgents.length} agents capable of document creation: ${capableAgents.join(", ")}`);

		} catch (error) {
			console.warn("Communication demonstration failed:", error);
		}
	}

	/**
	 * Simulate task execution
	 */
	private async simulateTaskExecution(plan: any, context: ExecutionContext): Promise<void> {
		console.log(`Simulating execution of ${plan.tasks.length} tasks...`);

		for (const task of plan.tasks) {
			try {
				console.log(`  Executing: ${task.description}`);
				
				// Simulate task execution time
				await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
				
				// Simulate successful completion
				context.completedTasks.push(task.id);
				context.totalTokensUsed += Math.floor(Math.random() * 1000) + 500;
				
				// Add simulated results to shared data
				if (task.type === "search") {
					context.sharedData.searchResults = [
						"Machine Learning Fundamentals.md",
						"Neural Networks Deep Dive.md",
						"ML Research Notes 2024.md"
					];
				} else if (task.type === "analyze") {
					context.sharedData.extractedConcepts = [
						"Supervised Learning", "Unsupervised Learning", "Reinforcement Learning",
						"Neural Networks", "Deep Learning", "Feature Engineering"
					];
				} else if (task.type === "create") {
					context.sharedData.createdDocument = "ML Overview.md";
				}

				console.log(`    ✓ Task completed (${context.totalTokensUsed} tokens used so far)`);
				
			} catch (error) {
				console.error(`    ❌ Task failed: ${task.description}`, error);
				context.failedTasks.push(task.id);
			}
		}

		// Update stored execution context
		await this.memoryManager.storeExecutionContext(context);
	}

	/**
	 * Demonstrate result aggregation
	 */
	private async demonstrateResultAggregation(context: ExecutionContext): Promise<void> {
		const results = {
			searchResults: context.sharedData.searchResults || [],
			extractedConcepts: context.sharedData.extractedConcepts || [],
			createdDocument: context.sharedData.createdDocument || null,
			tokensUsed: context.totalTokensUsed,
			completedTasks: context.completedTasks.length,
			failedTasks: context.failedTasks.length
		};

		console.log("Final Results Summary:");
		console.log(`  Found ${results.searchResults.length} relevant documents`);
		console.log(`  Extracted ${results.extractedConcepts.length} key concepts`);
		console.log(`  Created document: ${results.createdDocument || "None"}`);
		console.log(`  Tasks completed: ${results.completedTasks}/${results.completedTasks + results.failedTasks}`);
		console.log(`  Total tokens used: ${results.tokensUsed}`);

		if (results.extractedConcepts.length > 0) {
			console.log(`  Key concepts: ${results.extractedConcepts.join(", ")}`);
		}
	}

	/**
	 * Create mock agent capabilities for demonstration
	 */
	private createMockAgentCapabilities(): AgentCapability[] {
		return [
			{
				agentId: "research",
				capabilities: ["search", "analyze", "retrieve", "summarize"],
				specializations: ["semantic_search", "knowledge_retrieval", "document_analysis"],
				averageResponseTime: 3000,
				successRate: 0.95,
				currentLoad: 0,
				maxConcurrentTasks: 2
			},
			{
				agentId: "refactoring",
				capabilities: ["create", "modify", "structure", "optimize"],
				specializations: ["document_creation", "content_structuring", "code_analysis"],
				averageResponseTime: 4000,
				successRate: 0.90,
				currentLoad: 1,
				maxConcurrentTasks: 2
			},
			{
				agentId: "safety",
				capabilities: ["validate", "assess", "approve", "risk_analysis"],
				specializations: ["risk_assessment", "operation_validation", "data_protection"],
				averageResponseTime: 2000,
				successRate: 0.98,
				currentLoad: 0,
				maxConcurrentTasks: 3
			},
			{
				agentId: "supervisor",
				capabilities: ["coordinate", "plan", "synthesize", "monitor"],
				specializations: ["multi_agent_coordination", "task_planning", "result_synthesis"],
				averageResponseTime: 2500,
				successRate: 0.92,
				currentLoad: 0,
				maxConcurrentTasks: 1
			}
		];
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		try {
			if (this.config.enableCommunication) {
				await this.communicationProtocol.cleanup();
			}
			await this.memoryManager.cleanup();
			console.log("✓ Workflow example cleaned up successfully");
		} catch (error) {
			console.error("Failed to cleanup workflow example:", error);
		}
	}
}

/**
 * Helper function to run the example
 */
export async function runMultiAgentWorkflowExample(config: ExampleConfig, app: any): Promise<void> {
	const example = new MultiAgentWorkflowExample(config, app);
	
	try {
		await example.initialize();
		await example.runExample();
	} finally {
		await example.cleanup();
	}
}

/**
 * Usage example:
 * 
 * import { runMultiAgentWorkflowExample } from "./MultiAgentWorkflowExample";
 * 
 * await runMultiAgentWorkflowExample({
 *   openAIApiKey: "your-api-key",
 *   dataDir: "./data",
 *   enableCommunication: true,
 *   enableParallelExecution: true
 * }, app);
 */
