// Core types and interfaces for the Mastra-based multi-agent system
import { App } from "obsidian";
import { MetadataFilter } from "../../types";

// Query Context
export interface QueryContext {
	conversationId: string;
	userId?: string;
	chatHistory: ChatMessage[];
	metadataFilters?: MetadataFilter[];
	sessionState: SessionState;
	app: App;
}

// Agent Response
export interface AgentResponse {
	success: boolean;
	content: string;
	sources?: string[];
	metadata?: Record<string, any>;
	requiresApproval?: boolean;
	previewData?: PreviewData;
	error?: string;
	agentUsed: string;
	confidence: number;
}

// Chat Message
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	agentId?: string;
	sources?: string[];
}

// Session State for safety system
export interface SessionState {
	allowAutoApproval: boolean;
	approvedOperations: Set<string>;
	sessionId: string;
	startTime: Date;
}

// Preview Data for destructive operations
export interface PreviewData {
	operationType: "create" | "modify" | "delete";
	affectedFiles: string[];
	changes: FileChange[];
	riskLevel: "low" | "medium" | "high";
}

// File Change for preview
export interface FileChange {
	filePath: string;
	changeType: "create" | "modify" | "delete";
	oldContent?: string;
	newContent?: string;
	diff?: string;
}

// Mastra agents handle routing internally, these types are no longer needed

// Research specific types
export interface SearchResult {
	id: string;
	content: string;
	metadata: Record<string, any>;
	score: number;
	source?: string;
}

export interface EnhancedResult extends SearchResult {
	hydeEnhanced: boolean;
	semanticallyGrouped: boolean;
	clusters?: string[];
}

// Vector Store types
export interface VectorDocument {
	id: string;
	content: string;
	metadata: Record<string, any>;
	embedding: number[];
}

export interface VectorSearchOptions {
	k?: number;
	limit?: number;
	threshold?: number;
	filter?: Record<string, any>;
	includeEmbeddings?: boolean;
}

// Embedding types
export interface EmbeddingModel {
	name: string;
	dimensions: number;
	initialize(): Promise<void>;
	embed(text: string): Promise<number[]>;
	embedBatch(texts: string[]): Promise<number[][]>;
	cleanup(): Promise<void>;
}

// Memory types are now handled by MastraMemoryManager

// Safety types
export interface RiskAssessment {
	level: "low" | "medium" | "high";
	requiresApproval: boolean;
	previewRequired: boolean;
	rollbackPlan?: string;
	reasoning: string;
}

export interface ApprovalRequest {
	id: string;
	operation: string;
	riskLevel: "low" | "medium" | "high";
	previewData: PreviewData;
	timeout: number;
}

export interface ApprovalResult {
	approved: boolean;
	reason?: string;
	allowFutureAuto?: boolean;
}

// Tool types are now handled by Mastra's native tool system

// Configuration types
export interface MultiAgentConfig {
	app: App;
	dataDir: string;
	openAIApiKey: string; // OpenAI API key for embeddings (required)
	vectorStoreConfig: VectorStoreConfig;
	memoryConfig: MemoryConfig;
	safetyConfig: SafetyConfig;
}

export interface VectorStoreConfig {
	persistenceDir: string;
	indexName: string;
	dimensions: number;
	// Additional properties for MastraVectorStore
	dbPath?: string;
}

export interface MemoryConfig {
	maxConversations: number;
	maxMessagesPerConversation: number;
	compressionThreshold: number;
}

export interface SafetyConfig {
	requireApprovalForDestruction: boolean;
	sessionTimeout: number;
	maxAutoApprovals: number;
}

// Error types
export class AgentError extends Error {
	constructor(
		message: string,
		public agentId: string,
		public code: string,
		public details?: any
	) {
		super(message);
		this.name = "AgentError";
	}
}

export class SafetyError extends Error {
	constructor(
		message: string,
		public operation: string,
		public riskLevel: string
	) {
		super(message);
		this.name = "SafetyError";
	}
}

export type { MetadataFilter } from "../../types";
