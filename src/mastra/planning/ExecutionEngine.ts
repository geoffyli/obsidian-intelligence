// Execution engine for managing task execution with parallel/sequential support
import { 
	ExecutionPlan, 
	Task, 
	TaskResult, 
	TaskStatus, 
	ExecutionContext,
	TaskExecutionError,
	AgentInteraction,
	TaskArtifact
} from "./types";
import type { AgentResponse } from "../agents/types";

export interface ExecutionEngineConfig {
	maxConcurrentTasks: number;
	taskTimeout: number; // in milliseconds
	enableRetries: boolean;
	maxRetryDelay: number; // in milliseconds
}

export interface TaskExecutor {
	executeTask(task: Task, context: ExecutionContext): Promise<TaskResult>;
	getAgentId(): string;
	isAvailable(): boolean;
}

export class ExecutionEngine {
	private config: ExecutionEngineConfig;
	private executors: Map<string, TaskExecutor> = new Map();
	private runningTasks: Map<string, Promise<TaskResult>> = new Map();
	private executionContext: ExecutionContext | null = null;

	constructor(config: ExecutionEngineConfig) {
		this.config = config;
	}

	/**
	 * Register a task executor (agent wrapper)
	 */
	registerExecutor(agentId: string, executor: TaskExecutor): void {
		this.executors.set(agentId, executor);
	}

	/**
	 * Execute a complete execution plan
	 */
	async executePlan(plan: ExecutionPlan, context: ExecutionContext): Promise<{
		success: boolean;
		results: TaskResult[];
		errors: string[];
		duration: number;
	}> {
		const startTime = Date.now();
		this.executionContext = context;
		
		try {
			// Update plan status
			plan.status = "in_progress";
			
			// Initialize execution tracking
			const results: TaskResult[] = [];
			const errors: string[] = [];
			
			// Execute based on execution mode
			if (plan.mode === "parallel") {
				const parallelResults = await this.executeParallel(plan, context);
				results.push(...parallelResults.results);
				errors.push(...parallelResults.errors);
			} else {
				const sequentialResults = await this.executeSequential(plan, context);
				results.push(...sequentialResults.results);
				errors.push(...sequentialResults.errors);
			}
			
			// Update plan status based on results
			const failedTasks = results.filter(r => r.status === "failed");
			plan.status = failedTasks.length > 0 ? "failed" : "completed";
			
			// Update execution context
			context.completedTasks = results.filter(r => r.status === "completed").map(r => r.taskId);
			context.failedTasks = failedTasks.map(r => r.taskId);
			context.totalTokensUsed = results.reduce((sum, r) => sum + r.tokensUsed, context.totalTokensUsed);
			
			const duration = Date.now() - startTime;
			
			return {
				success: failedTasks.length === 0,
				results,
				errors,
				duration
			};
			
		} catch (error) {
			plan.status = "failed";
			const duration = Date.now() - startTime;
			
			return {
				success: false,
				results: [],
				errors: [error instanceof Error ? error.message : String(error)],
				duration
			};
		}
	}

	/**
	 * Execute tasks in parallel with dependency management
	 */
	private async executeParallel(plan: ExecutionPlan, context: ExecutionContext): Promise<{
		results: TaskResult[];
		errors: string[];
	}> {
		const results: TaskResult[] = [];
		const errors: string[] = [];
		const completed = new Set<string>();
		const running = new Map<string, Promise<TaskResult>>();
		
		// Build dependency map
		const dependencyMap = this.buildDependencyMap(plan);
		
		// Continue until all tasks are processed
		while (completed.size < plan.tasks.length) {
			// Find tasks ready to execute
			const readyTasks = plan.tasks.filter(task => 
				!completed.has(task.id) && 
				!running.has(task.id) &&
				this.areDependenciesMet(task, completed, dependencyMap)
			);
			
			// Start execution of ready tasks (up to concurrency limit)
			const availableSlots = this.config.maxConcurrentTasks - running.size;
			const tasksToStart = readyTasks.slice(0, availableSlots);
			
			for (const task of tasksToStart) {
				const executionPromise = this.executeTask(task, context);
				running.set(task.id, executionPromise);
				
				// Handle completion
				executionPromise.then(result => {
					running.delete(task.id);
					completed.add(task.id);
					results.push(result);
					
					if (result.status === "failed") {
						errors.push(`Task ${task.id} failed: ${result.error}`);
					}
				}).catch(error => {
					running.delete(task.id);
					completed.add(task.id);
					errors.push(`Task ${task.id} error: ${error.message}`);
				});
			}
			
			// Wait for at least one task to complete if we have running tasks
			if (running.size > 0) {
				await Promise.race(Array.from(running.values()));
			} else if (readyTasks.length === 0) {
				// No tasks ready and none running - check for deadlock
				const remainingTasks = plan.tasks.filter(task => !completed.has(task.id));
				if (remainingTasks.length > 0) {
					errors.push(`Execution deadlock: remaining tasks have unmet dependencies`);
					break;
				}
			}
		}
		
		// Wait for all remaining tasks to complete
		if (running.size > 0) {
			await Promise.all(Array.from(running.values()));
		}
		
		return { results, errors };
	}

	/**
	 * Execute tasks sequentially
	 */
	private async executeSequential(plan: ExecutionPlan, context: ExecutionContext): Promise<{
		results: TaskResult[];
		errors: string[];
	}> {
		const results: TaskResult[] = [];
		const errors: string[] = [];
		
		// Sort tasks by dependencies (topological sort)
		const sortedTasks = this.topologicalSort(plan.tasks, plan.dependencies);
		
		for (const task of sortedTasks) {
			try {
				const result = await this.executeTask(task, context);
				results.push(result);
				
				if (result.status === "failed") {
					errors.push(`Task ${task.id} failed: ${result.error}`);
					
					// Decide whether to continue or stop
					if (task.priority === "critical") {
						break; // Stop execution on critical task failure
					}
				}
				
				// Update context with intermediate results
				if (result.output) {
					context.sharedData[task.id] = result.output;
				}
				
			} catch (error) {
				const errorMsg = `Task ${task.id} execution error: ${error instanceof Error ? error.message : String(error)}`;
				errors.push(errorMsg);
				
				// Create failed result
				results.push({
					taskId: task.id,
					status: "failed",
					error: errorMsg,
					duration: 0,
					agentUsed: task.agentId || "unknown",
					tokensUsed: 0,
					quality: { score: 0, factors: {} }
				});
				
				if (task.priority === "critical") {
					break;
				}
			}
		}
		
		return { results, errors };
	}

	/**
	 * Execute a single task
	 */
	private async executeTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
		const startTime = Date.now();
		
		try {
			// Update task status
			task.status = "in_progress";
			task.startedAt = new Date();
			
			// Get appropriate executor
			const executor = this.executors.get(task.agentId || "supervisor");
			if (!executor) {
				throw new TaskExecutionError(
					`No executor found for agent: ${task.agentId}`,
					task.id,
					task.agentId || "unknown"
				);
			}
			
			// Check executor availability
			if (!executor.isAvailable()) {
				throw new TaskExecutionError(
					`Executor for agent ${task.agentId} is not available`,
					task.id,
					task.agentId || "unknown"
				);
			}
			
			// Execute with timeout
			const executionPromise = executor.executeTask(task, context);
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error("Task execution timeout")), this.config.taskTimeout);
			});
			
			const result = await Promise.race([executionPromise, timeoutPromise]);
			
			// Update task status
			task.status = result.status;
			task.completedAt = new Date();
			task.output = result.output;
			
			// Record interaction
			const interaction: AgentInteraction = {
				id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				fromAgent: result.agentUsed,
				type: "response",
				content: `Task completed: ${task.description}`,
				timestamp: new Date(),
				taskId: task.id,
				metadata: {
					duration: result.duration,
					tokensUsed: result.tokensUsed,
					quality: result.quality
				}
			};
			context.agentInteractions.push(interaction);
			
			return result;
			
		} catch (error) {
			// Handle retry logic
			if (this.config.enableRetries && task.retryCount < task.maxRetries) {
				task.retryCount++;
				
				// Exponential backoff
				const delay = Math.min(
					1000 * Math.pow(2, task.retryCount - 1),
					this.config.maxRetryDelay
				);
				
				await new Promise(resolve => setTimeout(resolve, delay));
				return this.executeTask(task, context); // Recursive retry
			}
			
			// Task failed permanently
			task.status = "failed";
			task.completedAt = new Date();
			
			const duration = Date.now() - startTime;
			const errorMsg = error instanceof Error ? error.message : String(error);
			
			// Record failure interaction
			const interaction: AgentInteraction = {
				id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				fromAgent: task.agentId || "unknown",
				type: "error",
				content: `Task failed: ${errorMsg}`,
				timestamp: new Date(),
				taskId: task.id,
				metadata: { error: errorMsg, duration }
			};
			context.agentInteractions.push(interaction);
			
			return {
				taskId: task.id,
				status: "failed",
				error: errorMsg,
				duration,
				agentUsed: task.agentId || "unknown",
				tokensUsed: 0,
				quality: { score: 0, factors: { error: 1 } }
			};
		}
	}

	/**
	 * Build dependency map for parallel execution
	 */
	private buildDependencyMap(plan: ExecutionPlan): Map<string, string[]> {
		const dependencyMap = new Map<string, string[]>();
		
		// Initialize with task dependencies
		plan.tasks.forEach(task => {
			dependencyMap.set(task.id, [...task.dependencies]);
		});
		
		// Add explicit dependencies from plan
		plan.dependencies.forEach(dep => {
			const dependencies = dependencyMap.get(dep.to) || [];
			if (!dependencies.includes(dep.from)) {
				dependencies.push(dep.from);
			}
			dependencyMap.set(dep.to, dependencies);
		});
		
		return dependencyMap;
	}

	/**
	 * Check if task dependencies are met
	 */
	private areDependenciesMet(task: Task, completed: Set<string>, dependencyMap: Map<string, string[]>): boolean {
		const dependencies = dependencyMap.get(task.id) || [];
		return dependencies.every(depId => completed.has(depId));
	}

	/**
	 * Topological sort for sequential execution
	 */
	private topologicalSort(tasks: Task[], dependencies: any[]): Task[] {
		const inDegree = new Map<string, number>();
		const graph = new Map<string, string[]>();
		const taskMap = new Map(tasks.map(task => [task.id, task]));
		
		// Initialize
		tasks.forEach(task => {
			inDegree.set(task.id, 0);
			graph.set(task.id, []);
		});
		
		// Build graph and calculate in-degrees
		dependencies.forEach(dep => {
			const from = dep.from;
			const to = dep.to;
			
			if (graph.has(from) && inDegree.has(to)) {
				graph.get(from)!.push(to);
				inDegree.set(to, inDegree.get(to)! + 1);
			}
		});
		
		// Add task-level dependencies
		tasks.forEach(task => {
			task.dependencies.forEach(depId => {
				if (graph.has(depId) && inDegree.has(task.id)) {
					graph.get(depId)!.push(task.id);
					inDegree.set(task.id, inDegree.get(task.id)! + 1);
				}
			});
		});
		
		// Kahn's algorithm
		const queue: string[] = [];
		const result: Task[] = [];
		
		// Find nodes with no incoming edges
		inDegree.forEach((degree, taskId) => {
			if (degree === 0) {
				queue.push(taskId);
			}
		});
		
		while (queue.length > 0) {
			const current = queue.shift()!;
			const task = taskMap.get(current);
			if (task) {
				result.push(task);
			}
			
			// Process neighbors
			const neighbors = graph.get(current) || [];
			neighbors.forEach(neighbor => {
				const newDegree = inDegree.get(neighbor)! - 1;
				inDegree.set(neighbor, newDegree);
				
				if (newDegree === 0) {
					queue.push(neighbor);
				}
			});
		}
		
		// If result doesn't contain all tasks, there's a cycle
		if (result.length !== tasks.length) {
			console.warn("Circular dependency detected, returning original order");
			return tasks;
		}
		
		return result;
	}

	/**
	 * Cancel running execution
	 */
	async cancelExecution(planId: string): Promise<void> {
		// In a real implementation, you'd need to track running plans
		// and provide cancellation mechanism
		console.log(`Execution cancellation requested for plan: ${planId}`);
		this.runningTasks.clear();
	}

	/**
	 * Get execution statistics
	 */
	getExecutionStats(): {
		runningTasks: number;
		registeredExecutors: number;
		totalExecutions: number;
	} {
		return {
			runningTasks: this.runningTasks.size,
			registeredExecutors: this.executors.size,
			totalExecutions: 0 // Would track this in real implementation
		};
	}
}