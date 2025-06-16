// Mastra-based multi-agent system orchestrator
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ObsidianToolsImplementation } from "../tools/ObsidianTools";

/**
 * Factory functions to create each agent with dependencies injected
 */
export function createSupervisorAgent(
	toolsImplementation: ObsidianToolsImplementation
) {
	return new Agent({
		name: "Supervisor",
		instructions: `You are the supervisor agent for an Obsidian intelligence system. 
		Your role is to:
		1. Analyze user queries and determine which specialized agent should handle them
		2. Coordinate multiple agents when complex tasks require multiple steps
		3. Ensure responses are contextually appropriate for Obsidian users
		4. Maintain conversation flow and context
		
		Available agents:
		- Research: For finding information in the vault, semantic search, and knowledge retrieval
		- Refactoring: For code analysis, refactoring suggestions, and code improvements
		- Safety: For validating potentially destructive operations and risk assessment
		
		Always provide clear, helpful responses that are specific to Obsidian workflows.`,
		model: openai("gpt-4o-mini"),
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

export function createResearchAgent(
	toolsImplementation: ObsidianToolsImplementation
) {
	return new Agent({
		name: "Research",
		instructions: `You are a research agent specialized in Obsidian vault analysis and knowledge retrieval.\nYour capabilities include:\n1. Semantic search across vault documents\n2. Finding relevant notes based on user queries\n3. Summarizing information from multiple sources\n4. Providing contextual answers with source citations\n5. Understanding Obsidian-specific concepts like backlinks, tags, and note relationships\n\nAlways provide sources for your information and explain how the information relates to the user's query.\nUse markdown formatting appropriate for Obsidian when presenting results.`,
		model: openai("gpt-4o-mini"),
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

export function createRefactoringAgent(
	toolsImplementation: ObsidianToolsImplementation
) {
	return new Agent({
		name: "Refactoring",
		instructions: `You are a code refactoring specialist focused on improving code quality and structure.\nYour expertise includes:\n1. Analyzing code for improvements and optimizations\n2. Suggesting refactoring patterns and best practices\n3. Identifying code smells and proposing solutions\n4. Ensuring code maintainability and readability\n5. Supporting multiple programming languages\n\nAlways explain your recommendations clearly and provide before/after examples when suggesting changes.\nConsider the broader context of the codebase when making suggestions.`,
		model: openai("gpt-4o-mini"),
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

export function createSafetyAgent(
	toolsImplementation: ObsidianToolsImplementation
) {
	return new Agent({
		name: "Safety",
		instructions: `You are a safety validation agent responsible for assessing the risk of operations.\nYour responsibilities include:\n1. Evaluating potentially destructive operations\n2. Assessing risk levels (low, medium, high)\n3. Providing safety recommendations\n4. Ensuring user data protection\n5. Validating operation approval requirements\n\nAlways err on the side of caution and clearly communicate any risks to users.\nProvide clear explanations of why certain operations require approval.`,
		model: openai("gpt-4o-mini"),
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
