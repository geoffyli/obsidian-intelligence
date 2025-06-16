import { Mastra } from "@mastra/core";
import { ObsidianVectorStore } from "./storage/ObsidianVectorStore";
import { App } from "obsidian";

// --- Mastra Orchestrator Setup ---
// Using simple Mastra setup without complex storage (for now)
export function createMastraInstance(app: App, dataDir: string = ".obsidian/plugins/obsidian-intelligence/data") {
	const vectorStore = new ObsidianVectorStore(app, {
		dataDir,
		fileName: "vectors.json",
		dimensions: 1536, // OpenAI embedding dimensions
	});

	// Create basic Mastra instance without complex storage for now
	const mastra = new Mastra({});

	return { mastra, vectorStore };
}

// Export the factory function instead of instances
export { ObsidianMemoryStore } from "./storage/ObsidianMemoryStore";
export { ObsidianVectorStore } from "./storage/ObsidianVectorStore";

// --- Agent Registration & Memory Integration ---
import { ObsidianToolsImplementation } from "./tools/ObsidianTools";
import { App } from "obsidian";
import { MastraMemoryManager } from "./memory/MastraMemoryManager";
import { SafetyManager } from "./safety/SafetyManager";
import { MastraVectorStore } from "./agents/vectorstore/MastraVectorStore";
import type { SafetyConfig, MemoryConfig } from "./agents/types";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import type { IntelligencePluginSettings } from "../types";

// --- Inlined Agent Factory Functions ---

function createSupervisorAgent(
	toolsImplementation: ObsidianToolsImplementation,
	openAIApiKey: string,
	openaiClient?: any
) {
	if (!openAIApiKey) {
		throw new Error("OpenAI API key is required for Supervisor agent");
	}
	
	return new Agent({
		name: "Supervisor",
		instructions: `You are the supervisor agent for an Obsidian intelligence system.\nYour role is to:\n1. Analyze user queries and determine which specialized agent should handle them\n2. Coordinate multiple agents when complex tasks require multiple steps\n3. Ensure responses are contextually appropriate for Obsidian users\n4. Maintain conversation flow and context\n\nAvailable agents:\n- Research: For finding information in the vault, semantic search, and knowledge retrieval\n- Refactoring: For code analysis, refactoring suggestions, and code improvements\n- Safety: For validating potentially destructive operations and risk assessment\n\nAlways provide clear, helpful responses that are specific to Obsidian workflows.`,
		model: openaiClient || openai("gpt-4o-mini"),
		tools: {
			searchVault: {
				description:
					"Perform semantic search across all notes in the Obsidian vault",
				parameters: z.object({
					query: z.string().describe("The search query"),
					limit: z
						.number()
						.optional()
						.default(5)
						.describe("Maximum number of results"),
					includeContent: z
						.boolean()
						.optional()
						.default(true)
						.describe("Include note content in results"),
				}),
				execute: async ({
					query,
					limit,
					includeContent,
				}: {
					query: string;
					limit?: number;
					includeContent?: boolean;
				}) => {
					return await toolsImplementation.executeSearchVault({
						query,
						limit,
						includeContent,
					});
				},
			},
			memory: {
				description:
					"Store and retrieve information from conversation memory",
				parameters: z.object({
					operation: z.enum(["store", "retrieve", "summarize"]),
					conversationId: z.string(),
					data: z.string().optional(),
					query: z.string().optional(),
				}),
				execute: async ({
					operation,
					conversationId,
					data,
					query,
				}: {
					operation: string;
					conversationId: string;
					data?: string;
					query?: string;
				}) => {
					return await toolsImplementation.executeMemoryTool({
						operation,
						conversationId,
						data,
						query,
					});
				},
			},
		},
	});
}

function createResearchAgent(toolsImplementation: ObsidianToolsImplementation, openAIApiKey: string, openaiClient?: any) {
	if (!openAIApiKey) {
		throw new Error("OpenAI API key is required for Research agent");
	}
	
	return new Agent({
		name: "Research",
		instructions: `You are a research agent specialized in Obsidian vault analysis and knowledge retrieval.\nYour capabilities include:\n1. Semantic search across vault documents\n2. Finding relevant notes based on user queries\n3. Summarizing information from multiple sources\n4. Providing contextual answers with source citations\n5. Understanding Obsidian-specific concepts like backlinks, tags, and note relationships\n\nAlways provide sources for your information and explain how the information relates to the user's query.\nUse markdown formatting appropriate for Obsidian when presenting results.`,
		model: openaiClient || openai("gpt-4o-mini"),
		tools: {
			searchVault: {
				description:
					"Perform semantic search across all notes in the Obsidian vault",
				parameters: z.object({
					query: z.string().describe("The search query"),
					limit: z
						.number()
						.optional()
						.default(5)
						.describe("Maximum number of results"),
					includeContent: z
						.boolean()
						.optional()
						.default(true)
						.describe("Include note content in results"),
				}),
				execute: async ({
					query,
					limit,
					includeContent,
				}: {
					query: string;
					limit?: number;
					includeContent?: boolean;
				}) => {
					return await toolsImplementation.executeSearchVault({
						query,
						limit,
						includeContent,
					});
				},
			},
			getNoteContent: {
				description:
					"Retrieve the full content of a specific note by path",
				parameters: z.object({
					notePath: z.string().describe("Path to the note file"),
				}),
				execute: async ({ notePath }: { notePath: string }) => {
					return await toolsImplementation.executeGetNoteContent({
						notePath,
					});
				},
			},
			analyzeRelationships: {
				description:
					"Analyze relationships between notes (backlinks, outgoing links, tags)",
				parameters: z.object({
					notePath: z
						.string()
						.describe("Path to the note to analyze"),
					includeBacklinks: z.boolean().optional().default(true),
					includeOutgoingLinks: z.boolean().optional().default(true),
					includeTags: z.boolean().optional().default(true),
				}),
				execute: async ({
					notePath,
					includeBacklinks,
					includeOutgoingLinks,
					includeTags,
				}: {
					notePath: string;
					includeBacklinks?: boolean;
					includeOutgoingLinks?: boolean;
					includeTags?: boolean;
				}) => {
					return await toolsImplementation.executeAnalyzeNoteRelationships(
						{
							notePath,
							includeBacklinks,
							includeOutgoingLinks,
							includeTags,
						}
					);
				},
			},
		},
	});
}

function createRefactoringAgent(
	toolsImplementation: ObsidianToolsImplementation,
	openAIApiKey: string,
	openaiClient?: any
) {
	if (!openAIApiKey) {
		throw new Error("OpenAI API key is required for Refactoring agent");
	}
	
	return new Agent({
		name: "Refactoring",
		instructions: `You are a code refactoring specialist focused on improving code quality and structure.\nYour expertise includes:\n1. Analyzing code for improvements and optimizations\n2. Suggesting refactoring patterns and best practices\n3. Identifying code smells and proposing solutions\n4. Ensuring code maintainability and readability\n5. Supporting multiple programming languages\n\nAlways explain your recommendations clearly and provide before/after examples when suggesting changes.\nConsider the broader context of the codebase when making suggestions.`,
		model: openaiClient || openai("gpt-4o-mini"),
		tools: {
			searchVault: {
				description:
					"Perform semantic search across all notes in the Obsidian vault",
				parameters: z.object({
					query: z.string().describe("The search query"),
					limit: z
						.number()
						.optional()
						.default(5)
						.describe("Maximum number of results"),
					includeContent: z
						.boolean()
						.optional()
						.default(true)
						.describe("Include note content in results"),
				}),
				execute: async ({
					query,
					limit,
					includeContent,
				}: {
					query: string;
					limit?: number;
					includeContent?: boolean;
				}) => {
					return await toolsImplementation.executeSearchVault({
						query,
						limit,
						includeContent,
					});
				},
			},
			getNoteContent: {
				description:
					"Retrieve the full content of a specific note by path",
				parameters: z.object({
					notePath: z.string().describe("Path to the note file"),
				}),
				execute: async ({ notePath }: { notePath: string }) => {
					return await toolsImplementation.executeGetNoteContent({
						notePath,
					});
				},
			},
			createNote: {
				description: "Create a new note in the Obsidian vault",
				parameters: z.object({
					path: z
						.string()
						.describe("Path where the note should be created"),
					content: z.string().describe("Content of the new note"),
					overwrite: z
						.boolean()
						.optional()
						.default(false)
						.describe("Whether to overwrite if file exists"),
				}),
				execute: async ({
					path,
					content,
					overwrite,
				}: {
					path: string;
					content: string;
					overwrite?: boolean;
				}) => {
					return await toolsImplementation.executeCreateNote({
						path,
						content,
						overwrite,
					});
				},
			},
		},
	});
}

function createSafetyAgent(toolsImplementation: ObsidianToolsImplementation, openAIApiKey: string, openaiClient?: any) {
	if (!openAIApiKey) {
		throw new Error("OpenAI API key is required for Safety agent");
	}
	
	return new Agent({
		name: "Safety",
		instructions: `You are a safety validation agent responsible for assessing the risk of operations.\nYour responsibilities include:\n1. Evaluating potentially destructive operations\n2. Assessing risk levels (low, medium, high)\n3. Providing safety recommendations\n4. Ensuring user data protection\n5. Validating operation approval requirements\n\nAlways err on the side of caution and clearly communicate any risks to users.\nProvide clear explanations of why certain operations require approval.`,
		model: openaiClient || openai("gpt-4o-mini"),
		tools: {
			safetyValidation: {
				description:
					"Validate operations for safety and risk assessment",
				parameters: z.object({
					operation: z
						.string()
						.describe("Description of the operation to validate"),
					targetFiles: z
						.array(z.string())
						.optional()
						.describe("Files that would be affected"),
					operationType: z.enum([
						"read",
						"create",
						"modify",
						"delete",
					]),
				}),
				execute: async ({
					operation,
					targetFiles,
					operationType,
				}: {
					operation: string;
					targetFiles?: string[];
					operationType: string;
				}) => {
					return await toolsImplementation.executeSafetyValidation({
						operation,
						targetFiles,
						operationType,
					});
				},
			},
			memory: {
				description:
					"Store and retrieve information from conversation memory",
				parameters: z.object({
					operation: z.enum(["store", "retrieve", "summarize"]),
					conversationId: z.string(),
					data: z.string().optional(),
					query: z.string().optional(),
				}),
				execute: async ({
					operation,
					conversationId,
					data,
					query,
				}: {
					operation: string;
					conversationId: string;
					data?: string;
					query?: string;
				}) => {
					return await toolsImplementation.executeMemoryTool({
						operation,
						conversationId,
						data,
						query,
					});
				},
			},
		},
	});
}

// Helper to create a Mastra instance with agents and memory integration
export async function createMastraWithAgents({
	app,
	settings,
	plugin,
	dataDir = ".obsidian/plugins/obsidian-intelligence/data",
}: {
	app: App;
	settings: IntelligencePluginSettings;
	plugin: import("../main").default;
	dataDir?: string;
}) {
	// Import the MastraOrchestrator
	const { MastraOrchestrator } = await import("./MastraOrchestrator");
	const { OpenAIEmbeddingManager } = await import("./embeddings/OpenAIEmbeddingManager");
	
	// Create and initialize vector store
	const vectorStore = new MastraVectorStore(app, {
		dataDir,
		indexName: "obsidian-intelligence",
		dimensions: 1536,
		fileName: "mastra-vectors.json",
	});

	// Validate API key before proceeding
	if (!settings.openAIApiKey || settings.openAIApiKey.trim() === '') {
		throw new Error("OpenAI API key is missing. Please configure your API key in plugin settings.");
	}

	// Set the API key as an environment variable for the AI SDK
	// This is a workaround for the AI SDK not properly receiving the apiKey parameter
	if (typeof process !== 'undefined' && process.env) {
		process.env.OPENAI_API_KEY = settings.openAIApiKey;
		console.log("Set OPENAI_API_KEY environment variable");
	} else {
		// For browser environments, try setting it on window or global
		try {
			if (typeof window !== 'undefined') {
				(window as any).process = (window as any).process || {};
				(window as any).process.env = (window as any).process.env || {};
				(window as any).process.env.OPENAI_API_KEY = settings.openAIApiKey;
				console.log("Set OPENAI_API_KEY on window.process.env");
			} else if (typeof global !== 'undefined') {
				(global as any).process = (global as any).process || {};
				(global as any).process.env = (global as any).process.env || {};
				(global as any).process.env.OPENAI_API_KEY = settings.openAIApiKey;
				console.log("Set OPENAI_API_KEY on global.process.env");
			}
		} catch (error) {
			console.warn("Could not set environment variable:", error);
		}
	}

	// Initialize embedding manager with error handling
	let embeddingManager;
	try {
		embeddingManager = new OpenAIEmbeddingManager(settings.openAIApiKey);
		await vectorStore.initialize(embeddingManager, app);
	} catch (error) {
		console.error("Failed to initialize embedding manager:", error);
		throw new Error(`Vector store initialization failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	const memoryDefaults = { dataDir };
	const safetyDefaults: SafetyConfig = {
		requireApprovalForDestruction: true,
		sessionTimeout: 3600000,
		maxAutoApprovals: 10,
	};
	
	// Create simplified memory manager without complex Mastra storage for now
	const memoryManager = new MastraMemoryManager(app, memoryDefaults);
	const safetyManager = new SafetyManager(safetyDefaults);
	const toolsImplementation = new ObsidianToolsImplementation(
		app,
		vectorStore,
		memoryManager,
		safetyManager
	);
	
	// Create OpenAI client instance to share across agents
	let openaiClient;
	try {
		openaiClient = openai("gpt-4o-mini");
		console.log("Created OpenAI client");
	} catch (error) {
		console.error("Failed to create OpenAI client:", error);
		throw new Error(`OpenAI client creation failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	// Create agents with error handling
	let agents;
	try {
		agents = {
			supervisor: createSupervisorAgent(toolsImplementation, settings.openAIApiKey, openaiClient),
			research: createResearchAgent(toolsImplementation, settings.openAIApiKey, openaiClient),
			refactoring: createRefactoringAgent(toolsImplementation, settings.openAIApiKey, openaiClient),
			safety: createSafetyAgent(toolsImplementation, settings.openAIApiKey, openaiClient),
		};
	} catch (error) {
		console.error("Failed to create agents:", error);
		throw new Error(`Agent creation failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	
	const mastra = new Mastra({
		agents,
	});

	// Return orchestrator wrapper instead of raw Mastra instance
	return new MastraOrchestrator(mastra, {
		app,
		settings,
		plugin,
		dataDir,
	});
}

/**
 * Usage example for full agent/memory integration:
 *
 * import { createMastraInstance, createMastraWithAgents } from "./mastra";
 * import { App } from "obsidian";
 * import { MastraVectorStore } from "./mastra/agents/vectorstore/MastraVectorStore";
 *
 * // Create basic Mastra instance
 * const { mastra, memoryStore, vectorStore } = createMastraInstance(app);
 *
 * // Create your MastraVectorStore wrapper instance as needed
 * const myVectorStore = new MastraVectorStore({ ... });
 *
 * // Create a fully integrated Mastra instance with agents
 * const mastraWithAgents = createMastraWithAgents({
 *   app,
 *   vectorStore: myVectorStore, // Your wrapper for agent/tool wiring
 *   // Optionally pass memoryConfig, safetyConfig, and dataDir
 * });
 */
