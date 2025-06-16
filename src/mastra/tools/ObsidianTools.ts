// Obsidian tool implementations for Mastra agents
import { App, TFile } from "obsidian";
import { MastraVectorStore } from "../agents/vectorstore/MastraVectorStore";
import { MastraMemoryManager } from "../memory/MastraMemoryManager";
import { SafetyManager } from "../safety/SafetyManager";

/**
 * Implementation class for Obsidian tools
 */
export class ObsidianToolsImplementation {
	constructor(
		private app: App,
		private vectorStore: MastraVectorStore,
		private memoryManager: MastraMemoryManager,
		private safetyManager: SafetyManager
	) {}

	/**
	 * Execute search vault tool
	 */
	async executeSearchVault(params: any) {
		try {
			const results = await this.vectorStore.searchVectorStore(
				params.query,
				{
					k: params.limit,
				}
			);

			return {
				results: results.map((result) => ({
					title: result.metadata.title || result.id,
					path: result.metadata.path || result.id,
					content: params.includeContent ? result.content : "",
					score: result.score || 0,
					metadata: result.metadata,
				})),
				totalResults: results.length,
			};
		} catch (error) {
			throw new Error(`Search failed: ${error}`);
		}
	}

	/**
	 * Execute get note content tool
	 */
	async executeGetNoteContent(params: any) {
		try {
			const file = this.app.vault.getAbstractFileByPath(params.notePath);

			if (!file || !(file instanceof TFile)) {
				return {
					content: "",
					metadata: {},
					exists: false,
				};
			}

			const content = await this.app.vault.read(file);
			const metadata = this.app.metadataCache.getFileCache(file);

			return {
				content,
				metadata: metadata || {},
				exists: true,
			};
		} catch (error) {
			throw new Error(`Failed to get note content: ${error}`);
		}
	}

	/**
	 * Execute create note tool
	 */
	async executeCreateNote(params: any) {
		try {
			// Simple safety validation for create operation
			// In a real implementation, you would use the SafetyManager here

			const existingFile = this.app.vault.getAbstractFileByPath(
				params.path
			);

			if (existingFile && !params.overwrite) {
				return {
					success: false,
					path: params.path,
					message: "File already exists and overwrite is disabled",
				};
			}

			if (existingFile && params.overwrite) {
				await this.app.vault.modify(
					existingFile as TFile,
					params.content
				);
			} else {
				await this.app.vault.create(params.path, params.content);
			}

			return {
				success: true,
				path: params.path,
				message: "Note created successfully",
			};
		} catch (error) {
			return {
				success: false,
				path: params.path,
				message: `Failed to create note: ${error}`,
			};
		}
	}

	/**
	 * Execute update note tool
	 */
	async executeUpdateNote(params: any) {
		try {
			const file = this.app.vault.getAbstractFileByPath(params.path);

			if (!file || !(file instanceof TFile)) {
				return {
					success: false,
					message: "Note not found",
				};
			}

			const oldContent = await this.app.vault.read(file);
			let newContent: string;

			switch (params.mode) {
				case "replace":
					newContent = params.content;
					break;
				case "append":
					newContent = oldContent + "\n" + params.content;
					break;
				case "prepend":
					newContent = params.content + "\n" + oldContent;
					break;
			}

			// Simple safety validation for modify operation
			// In a real implementation, you would use the SafetyManager here

			await this.app.vault.modify(file, newContent);

			return {
				success: true,
				message: "Note updated successfully",
				oldContent,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to update note: ${error}`,
			};
		}
	}

	/**
	 * Execute analyze note relationships tool
	 */
	async executeAnalyzeNoteRelationships(params: any) {
		try {
			const file = this.app.vault.getAbstractFileByPath(params.notePath);

			if (!file || !(file instanceof TFile)) {
				throw new Error("Note not found");
			}

			const metadata = this.app.metadataCache.getFileCache(file);
			const backlinks: string[] = [];
			const outgoingLinks: string[] = [];
			const tags: string[] = [];

			// Get backlinks
			if (params.includeBacklinks) {
				const backlinkData =
					this.app.metadataCache.getBacklinksForFile(file);
				if (backlinkData) {
					Object.keys(backlinkData.data).forEach((path) => {
						backlinks.push(path);
					});
				}
			}

			// Get outgoing links
			if (params.includeOutgoingLinks && metadata?.links) {
				metadata.links.forEach((link) => {
					outgoingLinks.push(link.link);
				});
			}

			// Get tags
			if (params.includeTags && metadata?.tags) {
				metadata.tags.forEach((tag) => {
					tags.push(tag.tag);
				});
			}

			// Calculate related notes (simplified implementation)
			const relatedNotes = [
				...backlinks.map((path) => ({
					path,
					relationship: "backlink",
					strength: 0.8,
				})),
				...outgoingLinks.map((path) => ({
					path,
					relationship: "outgoing_link",
					strength: 0.7,
				})),
			];

			return {
				backlinks,
				outgoingLinks,
				tags,
				relatedNotes,
			};
		} catch (error) {
			throw new Error(`Failed to analyze relationships: ${error}`);
		}
	}

	/**
	 * Execute get vault stats tool
	 */
	async executeGetVaultStats(params: any) {
		try {
			const allFiles = this.app.vault.getMarkdownFiles();
			let totalWords = 0;
			let totalCharacters = 0;
			const fileTypes: Record<string, number> = {};
			const tagCounts: Record<string, number> = {};
			const linkCounts: Record<string, number> = {};

			for (const file of allFiles) {
				const content = await this.app.vault.read(file);
				const words = content.split(/\s+/).length;
				totalWords += words;
				totalCharacters += content.length;

				// File types
				if (params.includeFileTypes) {
					const extension = file.extension;
					fileTypes[extension] = (fileTypes[extension] || 0) + 1;
				}

				// Tags
				if (params.includeTagStats) {
					const metadata = this.app.metadataCache.getFileCache(file);
					if (metadata?.tags) {
						metadata.tags.forEach((tag) => {
							tagCounts[tag.tag] = (tagCounts[tag.tag] || 0) + 1;
						});
					}
				}

				// Links
				if (params.includeLinkStats) {
					const backlinks =
						this.app.metadataCache.getBacklinksForFile(file);
					if (backlinks) {
						linkCounts[file.path] = Object.keys(
							backlinks.data
						).length;
					}
				}
			}

			const result: any = {
				totalNotes: allFiles.length,
				totalWords,
				totalCharacters,
			};

			if (params.includeFileTypes) {
				result.fileTypes = fileTypes;
			}

			if (params.includeTagStats) {
				result.mostUsedTags = Object.entries(tagCounts)
					.sort(([, a], [, b]) => b - a)
					.slice(0, 10)
					.map(([tag, count]) => ({ tag, count }));
			}

			if (params.includeLinkStats) {
				result.linkStatistics = {
					totalLinks: Object.values(linkCounts).reduce(
						(sum, count) => sum + count,
						0
					),
					mostLinkedNotes: Object.entries(linkCounts)
						.sort(([, a], [, b]) => b - a)
						.slice(0, 10)
						.map(([path, linkCount]) => ({ path, linkCount })),
				};
			}

			return result;
		} catch (error) {
			throw new Error(`Failed to get vault stats: ${error}`);
		}
	}

	/**
	 * Execute memory tool
	 */
	async executeMemoryTool(params: any) {
		try {
			switch (params.operation) {
				case "store":
					if (!params.data) {
						throw new Error("Data is required for store operation");
					}
					await this.memoryManager.addMessage(
						{
							id: `memory_${Date.now()}`,
							role: "system",
							content: params.data,
							timestamp: new Date(),
						},
						params.conversationId
					);
					return {
						success: true,
						result: "Data stored successfully",
					};

				case "retrieve":
					const history =
						await this.memoryManager.getConversationHistory(
							params.conversationId
						);
					return {
						success: true,
						result: JSON.stringify(history),
						metadata: { messageCount: history.length },
					};

				case "summarize":
					const conversation =
						await this.memoryManager.getConversationHistory(
							params.conversationId
						);
					const summary = conversation
						.map((msg) => `${msg.role}: ${msg.content}`)
						.join("\n");
					return {
						success: true,
						result: summary,
						metadata: { messageCount: conversation.length },
					};

				default:
					throw new Error(
						`Unknown memory operation: ${params.operation}`
					);
			}
		} catch (error) {
			return {
				success: false,
				result: `Memory operation failed: ${error}`,
			};
		}
	}

	/**
	 * Execute safety validation tool
	 */
	async executeSafetyValidation(params: any) {
		try {
			// Simple safety validation - can be enhanced with actual SafetyManager integration
			const isDestructive =
				params.operationType === "delete" ||
				params.operationType === "modify";
			const hasMultipleFiles =
				params.targetFiles && params.targetFiles.length > 1;

			let riskLevel: "low" | "medium" | "high" = "low";
			let approved = true;
			let requiresConfirmation = false;

			if (isDestructive && hasMultipleFiles) {
				riskLevel = "high";
				approved = false;
				requiresConfirmation = true;
			} else if (isDestructive) {
				riskLevel = "medium";
				requiresConfirmation = true;
			}

			return {
				approved,
				riskLevel,
				requiresConfirmation,
				message: approved
					? "Operation validated"
					: "Operation requires manual approval",
				recommendations: isDestructive
					? ["Create backup before proceeding"]
					: [],
			};
		} catch (error) {
			return {
				approved: false,
				riskLevel: "high" as const,
				requiresConfirmation: true,
				message: `Safety validation failed: ${error}`,
			};
		}
	}
}
