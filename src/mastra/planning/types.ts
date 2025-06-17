// Task planning system types for enhanced multi-agent orchestration
import { z } from "zod";

// Task execution types
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type ExecutionMode = "sequential" | "parallel";
export type TaskPriority = "low" | "medium" | "high" | "critical";

// Core task interface
export interface Task {
	id: string;
	type: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	agentId?: string;
	dependencies: string[]; // Task IDs this task depends on
	children: string[]; // Subtask IDs
	parentId?: string;
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;
	input: Record<string, any>;
	output?: Record<string, any>;
	metadata: TaskMetadata;
	retryCount: number;
	maxRetries: number;
}

// Task metadata for context and execution details
export interface TaskMetadata {
	conversationId: string;
	userIntent: string;
	estimatedDuration?: number;
	actualDuration?: number;
	confidence: number;
	requiresApproval: boolean;
	riskLevel: "low" | "medium" | "high";
	tags: string[];
	context: Record<string, any>;
}

// Execution plan containing the full task graph
export interface ExecutionPlan {
	id: string;
	name: string;
	description: string;
	mode: ExecutionMode;
	tasks: Task[];
	dependencies: TaskDependency[];
	estimatedDuration: number;
	createdAt: Date;
	status: TaskStatus;
	metadata: {
		conversationId: string;
		userQuery: string;
		complexity: "simple" | "moderate" | "complex";
		requiresUserApproval: boolean;
	};
}

// Task dependency relationship
export interface TaskDependency {
	from: string; // Task ID
	to: string; // Task ID
	type: "hard" | "soft"; // Hard dependencies block execution, soft are preferred order
	condition?: string; // Optional condition for dependency
}

// Agent capability description
export interface AgentCapability {
	agentId: string;
	capabilities: string[];
	specializations: string[];
	averageResponseTime: number;
	successRate: number;
	currentLoad: number;
	maxConcurrentTasks: number;
}

// Task decomposition request
export interface DecompositionRequest {
	userQuery: string;
	context: {
		conversationId: string;
		chatHistory: Array<{
			role: "user" | "assistant" | "system";
			content: string;
			timestamp: Date;
		}>;
		availableAgents: AgentCapability[];
		vaultContext?: {
			documentCount: number;
			lastIndexed: Date;
			tags: string[];
		};
	};
}

// Task decomposition result
export interface DecompositionResult {
	success: boolean;
	plan: ExecutionPlan;
	reasoning: string;
	alternatives?: ExecutionPlan[];
	warnings?: string[];
	error?: string;
}

// Agent assignment for a task
export interface TaskAssignment {
	taskId: string;
	agentId: string;
	confidence: number;
	reasoning: string;
	estimatedDuration: number;
	requiredCapabilities: string[];
}

// Execution context shared across agents
export interface ExecutionContext {
	planId: string;
	conversationId: string;
	currentTask?: string;
	completedTasks: string[];
	failedTasks: string[];
	sharedData: Record<string, any>;
	userPreferences: Record<string, any>;
	sessionStartTime: Date;
	totalTokensUsed: number;
	agentInteractions: AgentInteraction[];
}

// Agent interaction record
export interface AgentInteraction {
	id: string;
	fromAgent: string;
	toAgent?: string; // undefined for user interactions
	type: "request" | "response" | "notification" | "error";
	content: string;
	timestamp: Date;
	taskId: string;
	metadata: Record<string, any>;
}

// Task execution result
export interface TaskResult {
	taskId: string;
	status: TaskStatus;
	output?: Record<string, any>;
	error?: string;
	duration: number;
	agentUsed: string;
	tokensUsed: number;
	quality: {
		score: number;
		factors: Record<string, number>;
		feedback?: string;
	};
	artifacts?: TaskArtifact[];
}

// Artifacts created during task execution
export interface TaskArtifact {
	id: string;
	type: "document" | "code" | "data" | "summary" | "analysis";
	name: string;
	content: string;
	metadata: Record<string, any>;
	createdAt: Date;
	createdBy: string; // Agent ID
}

// Validation schemas using Zod
export const TaskSchema = z.object({
	id: z.string(),
	type: z.string(),
	description: z.string(),
	status: z.enum(["pending", "in_progress", "completed", "failed", "cancelled"]),
	priority: z.enum(["low", "medium", "high", "critical"]),
	agentId: z.string().optional(),
	dependencies: z.array(z.string()),
	children: z.array(z.string()),
	parentId: z.string().optional(),
	createdAt: z.date(),
	startedAt: z.date().optional(),
	completedAt: z.date().optional(),
	input: z.record(z.any()),
	output: z.record(z.any()).optional(),
	metadata: z.object({
		conversationId: z.string(),
		userIntent: z.string(),
		estimatedDuration: z.number().optional(),
		actualDuration: z.number().optional(),
		confidence: z.number(),
		requiresApproval: z.boolean(),
		riskLevel: z.enum(["low", "medium", "high"]),
		tags: z.array(z.string()),
		context: z.record(z.any()),
	}),
	retryCount: z.number(),
	maxRetries: z.number(),
});

export const ExecutionPlanSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	mode: z.enum(["sequential", "parallel"]),
	tasks: z.array(TaskSchema),
	dependencies: z.array(z.object({
		from: z.string(),
		to: z.string(),
		type: z.enum(["hard", "soft"]),
		condition: z.string().optional(),
	})),
	estimatedDuration: z.number(),
	createdAt: z.date(),
	status: z.enum(["pending", "in_progress", "completed", "failed", "cancelled"]),
	metadata: z.object({
		conversationId: z.string(),
		userQuery: z.string(),
		complexity: z.enum(["simple", "moderate", "complex"]),
		requiresUserApproval: z.boolean(),
	}),
});

// Error types
export class TaskPlanningError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: any
	) {
		super(message);
		this.name = "TaskPlanningError";
	}
}

export class TaskExecutionError extends Error {
	constructor(
		message: string,
		public taskId: string,
		public agentId: string,
		public details?: any
	) {
		super(message);
		this.name = "TaskExecutionError";
	}
}