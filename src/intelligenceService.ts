// src/intelligenceService.ts
import { App, Notice } from "obsidian";
import type {
	IntelligencePluginSettings,
	LangChainChatMessage,
	MetadataFilter,
	MetadataField,
} from "./types"; // Added MetadataFilter, MetadataField
import { loadVaultDocuments } from "./obsidianUtils"; // Added getDateRangeForQuery
import { getDateRangeForQuery } from "./dateUtils";
import {
	getOpenAIEmbeddings,
	getChatOpenAIModel,
	createAndEmbedVectorStore,
	createConversationalRAGChain,
} from "./langchainSetup";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Runnable } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import IntelligencePlugin from "./main";

// Define the structure for persisted data
interface PersistedVectorStoreData {
	documents: Array<Pick<Document, "pageContent" | "metadata">>; // Changed DocumentInterface to Document
	vectors: number[][]; // Embeddings
	// We could also add a version or timestamp for future migration/staleness checks
	persistedAt: number;
}

const VECTOR_STORE_FILE_PATH = "rag_vector_store.json"; // Relative to plugin's data directory

export class IntelligenceService {
	private app: App;
	private settings: IntelligencePluginSettings;
	private allDocumentChunks: Document[] | null = null; // Store all chunks from vault
	private mainVectorStore: MemoryVectorStore | null = null; // Vector store for all chunks
	private chain: Runnable | null = null;
	private embeddingsService: OpenAIEmbeddings | null = null; // Store the service instance
	private llm: ChatOpenAI | null = null;
	private isInitialized = false;
	private isInitializing = false;
	private plugin!: IntelligencePlugin;
	private dataDir!: string; // To store plugin data path

	constructor(app: App, settings: IntelligencePluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	public setPlugin(plugin: IntelligencePlugin) {
		this.plugin = plugin;
		this.dataDir = `${this.plugin.manifest.dir}/.data`; // Store data inside plugin folder in a hidden .data subdir
	}

	private async ensureDataDirExists(): Promise<void> {
		try {
			// Check if directory exists, create if not.
			// Obsidian's adapter doesn't have a direct 'exists' for dirs, or 'mkdir'.
			// A common workaround is to try writing a dummy file or rely on write creating dirs,
			// but for robustness, let's assume `this.plugin.manifest.dir` exists and we just append to it.
			// For more complex scenarios, node.js 'fs' module via a bridge or Obsidian's adapter capabilities would be used.
			// For now, we'll assume saving a file into manifest.dir + "/.data/" will work if .data is created manually or by first save.
			// A more robust way if adapter supports it:
			const adapter = this.app.vault.adapter;
			if (!(await adapter.exists(this.dataDir))) {
				await adapter.mkdir(this.dataDir);
				console.log(`Created data directory: ${this.dataDir}`);
			}
		} catch (e) {
			console.warn(
				`Could not create or verify data directory ${this.dataDir}:`,
				e
			);
			// Continue, saving might fail but loading won't find anything.
		}
	}

	private async saveVectorStoreData(): Promise<void> {
		if (
			!this.mainVectorStore ||
			!this.allDocumentChunks ||
			this.allDocumentChunks.length === 0
		) {
			console.log("No vector store data to save.");
			return;
		}
		await this.ensureDataDirExists();
		const filePath = `${this.dataDir}/${VECTOR_STORE_FILE_PATH}`;

		try {
			// MemoryVectorStore doesn't directly expose vectors aligned perfectly with initial docs without some work.
			// We need to get documents and their corresponding vectors.
			// The store's `memoryVectors` array contains {content, embedding, metadata}
			const storeVectors = this.mainVectorStore.memoryVectors;
			const documentsToSave: Array<
				Pick<Document, "pageContent" | "metadata">
			> = []; // Changed DocumentInterface to Document
			const vectorsToSave: number[][] = [];

			storeVectors.forEach((mv) => {
				documentsToSave.push({
					pageContent: mv.content,
					metadata: mv.metadata,
				});
				vectorsToSave.push(mv.embedding);
			});

			if (documentsToSave.length !== vectorsToSave.length) {
				console.error(
					"Mismatch between saved documents and vectors count. Aborting save."
				);
				new Notice(
					"Error: Could not save vector store due to data mismatch."
				);
				return;
			}

			const data: PersistedVectorStoreData = {
				documents: documentsToSave,
				vectors: vectorsToSave,
				persistedAt: Date.now(),
			};
			await this.app.vault.adapter.write(filePath, JSON.stringify(data));
			new Notice(`Intelligence Vector Store saved to ${filePath}`);
			console.log(
				`Intelligence Vector Store saved with ${data.documents.length} items.`
			);
		} catch (error) {
			console.error("Error saving Intelligence vector store:", error);
			new Notice(
				"Error saving Intelligence vector store. Check console."
			);
		}
	}

	private async loadVectorStoreData(): Promise<boolean> {
		if (!this.embeddingsService) {
			console.error(
				"Embeddings service not initialized before loading vector store."
			);
			return false;
		}
		await this.ensureDataDirExists();
		const filePath = `${this.dataDir}/${VECTOR_STORE_FILE_PATH}`;

		try {
			if (!(await this.app.vault.adapter.exists(filePath))) {
				console.log("No persisted vector store found.");
				return false;
			}

			const fileContent = await this.app.vault.adapter.read(filePath);
			const data = JSON.parse(fileContent) as PersistedVectorStoreData;

			if (
				!data.documents ||
				!data.vectors ||
				data.documents.length !== data.vectors.length
			) {
				console.error("Invalid persisted vector store data format.");
				await this.app.vault.adapter.remove(filePath); // Remove corrupted file
				return false;
			}

			this.allDocumentChunks = data.documents.map(
				(docData) => new Document(docData)
			);

			// Reconstruct MemoryVectorStore
			this.mainVectorStore = new MemoryVectorStore(
				this.embeddingsService
			);
			await this.mainVectorStore.addVectors(
				data.vectors,
				this.allDocumentChunks
			);

			new Notice(
				`Intelligence Vector Store loaded with ${this.allDocumentChunks.length} documents.`
			);
			console.log(
				`Intelligence Vector Store loaded from ${filePath} (Persisted at: ${new Date(
					data.persistedAt
				).toLocaleString()})`
			);
			return true;
		} catch (error) {
			console.error("Error loading Intelligence vector store:", error);
			new Notice(
				"Error loading Intelligence vector store. Will re-index. Check console."
			);
			// Attempt to remove potentially corrupted file
			try {
				await this.app.vault.adapter.remove(filePath);
			} catch (e) {
				/* ignore */
			}
			return false;
		}
	}

	async initialize(): Promise<void> {
		if (this.isInitializing) {
			return;
		}
		if (!this.settings.openAIApiKey) {
			new Notice(
				"OpenAI API Key is not set. Please configure it in plugin settings."
			);
			this.isInitialized = false;
			return;
		}
		if (!this.plugin || !this.dataDir) {
			console.error(
				"IntelligenceService: Plugin reference not set. Call setPlugin() first."
			);
			new Notice("Intelligence Plugin error: internal setup incomplete.");
			return;
		}

		this.isInitializing = true;
		if (this.plugin)
			this.plugin.updateStatusBar("Intelligence: Initializing...");

		this.embeddingsService = getOpenAIEmbeddings(this.settings); // Initialize embeddings service first
		this.llm = getChatOpenAIModel(this.settings); // Initialize LLM

		const loadedFromPersistence = await this.loadVectorStoreData();

		if (!loadedFromPersistence) {
			if (this.plugin)
				this.plugin.updateStatusBar("Intelligence: Indexing vault...");
			new Notice("No valid persisted data. Indexing vault...");
			try {
				this.allDocumentChunks = await loadVaultDocuments(this.app);
				if (
					!this.allDocumentChunks ||
					this.allDocumentChunks.length === 0
				) {
					new Notice(
						"No markdown documents found in the vault to index."
					);
					if (this.plugin)
						this.plugin.updateStatusBar("Intelligence: No docs");
					this.isInitialized = false;
					this.isInitializing = false;
					return;
				}

				if (this.plugin)
					this.plugin.updateStatusBar(
						`Intelligence: Embedding ${this.allDocumentChunks.length} chunks...`
					);
				if (!this.embeddingsService)
					throw new Error(
						"Embeddings service not available for indexing."
					);

				this.mainVectorStore = await createAndEmbedVectorStore(
					this.allDocumentChunks,
					this.embeddingsService
				);
				await this.saveVectorStoreData(); // Save after successful indexing
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(
					"Error during initial vault indexing:",
					errorMessage
				);
				new Notice(`Intelligence Indexing Failed: ${errorMessage}.`);
				if (this.plugin)
					this.plugin.updateStatusBar(
						"Intelligence: Indexing Failed"
					);
				this.isInitialized = false;
				this.isInitializing = false;
				return;
			}
		}

		// Initialize the main conversational chain
		if (this.llm && this.mainVectorStore) {
			this.chain = await createConversationalRAGChain(
				this.llm,
				this.mainVectorStore
			);
			this.isInitialized = true;
			if (this.plugin) this.plugin.updateStatusBar("Intelligence: Ready");
			new Notice("Intelligence Service Initialized Successfully!");
		} else {
			new Notice(
				"Intelligence Service initialization failed: LLM or Vector Store missing."
			);
			if (this.plugin)
				this.plugin.updateStatusBar("Intelligence: Init Failed");
			this.isInitialized = false;
		}

		this.isInitializing = false;
	}

	/**
	 * Formats a list of documents for display, primarily showing unique file names and relevant dates.
	 * @param docs - The documents (chunks) to format.
	 * @param primaryDateField - Optional: The main date field used for filtering (e.g., 'modifiedAt' or 'createdAt').
	 * @returns A string formatted for display in the chat.
	 */
	private formatResultsForDisplay(
		docs: Document[],
		primaryDateField?: MetadataField
	): string {
		if (!docs || docs.length === 0) {
			return "No notes found matching your filter criteria.";
		}
		// Consolidate chunks into unique files, keeping their metadata
		const uniqueFiles: Record<
			string,
			{ path: string; modifiedAt?: number; createdAt?: number }
		> = {};
		docs.forEach((doc) => {
			if (
				doc.metadata.source &&
				!uniqueFiles[doc.metadata.source as string]
			) {
				uniqueFiles[doc.metadata.source as string] = {
					path: doc.metadata.source as string,
					modifiedAt: doc.metadata.modifiedAt as number, // Already a timestamp
					createdAt: doc.metadata.createdAt as number, // Already a timestamp
				};
			}
		});

		let response = `Found ${
			Object.keys(uniqueFiles).length
		} matching note(s):\n`;
		for (const filePath in uniqueFiles) {
			const fileInfo = uniqueFiles[filePath];
			// Extract filename from path and remove .md extension
			const fileName =
				fileInfo.path.split("/").pop()?.replace(/\.md$/, "") ||
				fileInfo.path;
			response += `- [[${fileName}]]`;

			// Determine which date to display based on primaryDateField or availability
			let dateToShow: number | undefined;
			let dateLabel = "";

			if (primaryDateField === "createdAt" && fileInfo.createdAt) {
				dateToShow = fileInfo.createdAt;
				dateLabel = "Created";
			} else if (
				primaryDateField === "modifiedAt" &&
				fileInfo.modifiedAt
			) {
				dateToShow = fileInfo.modifiedAt;
				dateLabel = "Modified";
			} else {
				// Fallback if no primaryDateField or if primary date is not available
				if (fileInfo.modifiedAt) {
					dateToShow = fileInfo.modifiedAt;
					dateLabel = "Modified";
				} else if (fileInfo.createdAt) {
					dateToShow = fileInfo.createdAt;
					dateLabel = "Created";
				}
			}

			if (dateToShow) {
				response += ` (${dateLabel}: ${new Date(
					dateToShow
				).toLocaleDateString()})`;
			}
			response += "\n";
		}
		return response;
	}

	/**
	 * Creates a context summary from filtered documents and their filter conditions for conversation context.
	 * @param docs - The filtered documents to create context from.
	 * @param appliedFilters - The metadata filters that were applied to get these documents.
	 * @returns A string summary of the documents and filter conditions for context.
	 */
	private createContextFromFilteredDocuments(
		docs: Document[],
		appliedFilters?: MetadataFilter[]
	): string | null {
		if (!docs || docs.length === 0) {
			return null;
		}

		// Get unique file names and basic metadata
		const uniqueFiles: Record<
			string,
			{ path: string; modifiedAt?: number; createdAt?: number }
		> = {};
		docs.forEach((doc) => {
			if (
				doc.metadata.source &&
				!uniqueFiles[doc.metadata.source as string]
			) {
				uniqueFiles[doc.metadata.source as string] = {
					path: doc.metadata.source as string,
					modifiedAt: doc.metadata.modifiedAt as number,
					createdAt: doc.metadata.createdAt as number,
				};
			}
		});

		const fileNames = Object.keys(uniqueFiles).map((filePath) => {
			const fileName =
				filePath.split("/").pop()?.replace(/\.md$/, "") || filePath;
			return fileName;
		});

		// Build filter conditions summary
		let filterSummary = "";
		if (appliedFilters && appliedFilters.length > 0) {
			const filterDescriptions = appliedFilters.map((filter) => {
				if (
					filter.field === "modifiedAt" ||
					filter.field === "createdAt"
				) {
					return `${
						filter.field === "modifiedAt" ? "modified" : "created"
					} ${filter.condition} ${filter.value}`;
				} else {
					return `${filter.field} contains "${filter.value}"`;
				}
			});
			filterSummary = `Applied filters: ${filterDescriptions.join(
				", "
			)}. `;
		}

		return `${filterSummary}Filtered documents include: ${fileNames.join(
			", "
		)} (${docs.length} total chunks from ${
			Object.keys(uniqueFiles).length
		} files)`;
	}

	async processQueryWithHistory(
		semanticQuery: string,
		history: LangChainChatMessage[],
		metadataFilters?: MetadataFilter[]
	): Promise<string | null> {
		if (!this.isInitialized || !this.allDocumentChunks) {
			new Notice(
				"Intelligence Service is not initialized. Please try again or re-initialize."
			);
			if (this.plugin)
				this.plugin.updateStatusBar("Intelligence: Not Initialized");
			return null;
		}
		if (
			(!semanticQuery || semanticQuery.trim() === "") &&
			(!metadataFilters || metadataFilters.length === 0)
		) {
			new Notice("Query or filter cannot be empty.");
			return null;
		}

		if (this.plugin)
			this.plugin.updateStatusBar("Intelligence: Processing...");

		// Step 1: Apply metadata filters first
		let filteredDocuments = [...this.allDocumentChunks];
		let primaryDateFilterField: MetadataField | undefined = undefined;

		if (metadataFilters && metadataFilters.length > 0) {
			new Notice(`Applying ${metadataFilters.length} filter(s)...`);
			for (const filter of metadataFilters) {
				if (
					filter.field === "modifiedAt" ||
					filter.field === "createdAt"
				) {
					if (!primaryDateFilterField)
						primaryDateFilterField = filter.field;
					const dateRange = getDateRangeForQuery(
						filter.condition,
						filter.value
					);
					if (dateRange) {
						filteredDocuments = filteredDocuments.filter((doc) => {
							const timestamp = doc.metadata[
								filter.field
							] as number;
							return (
								timestamp >= dateRange.startDate.getTime() &&
								timestamp <= dateRange.endDate.getTime()
							);
						});
					}
				} else {
					// Handle other metadata filters (filename, basename, source, etc.)
					filteredDocuments = filteredDocuments.filter((doc) => {
						const fieldValue = doc.metadata[filter.field];
						if (typeof fieldValue === "string") {
							return fieldValue
								.toLowerCase()
								.includes(filter.value.toLowerCase());
						}
						return false;
					});
				}
			}
			new Notice(
				`Found ${filteredDocuments.length} chunks after filtering.`
			);

			if (filteredDocuments.length === 0) {
				if (this.plugin)
					this.plugin.updateStatusBar("Intelligence: Ready");
				return "No notes found matching your filter criteria.";
			}
		}

		// Step 2: If no semantic query, display filtered results and add to context
		if (!semanticQuery || semanticQuery.trim() === "") {
			if (this.plugin) this.plugin.updateStatusBar("Intelligence: Ready");
			const displayResult = this.formatResultsForDisplay(
				filteredDocuments,
				primaryDateFilterField
			);

			// Add filtered documents to conversation context for future queries
			const contextMessage = this.createContextFromFilteredDocuments(
				filteredDocuments,
				metadataFilters
			);
			if (contextMessage) {
				// Add system message to history for context (this would be handled by the calling function)
				console.log("Context from filtered documents:", contextMessage);
			}

			return displayResult;
		}

		// Step 3: Process semantic query with filtered documents
		let currentChain = this.chain;
		let tempVectorStore: MemoryVectorStore | null = null;

		if (!this.llm || !this.embeddingsService) {
			return "Error: Core components not initialized.";
		}

		// Create a temporary vector store with filtered documents if filters were applied
		if (
			metadataFilters &&
			metadataFilters.length > 0 &&
			filteredDocuments.length < this.allDocumentChunks.length
		) {
			new Notice(
				`Performing semantic search on ${filteredDocuments.length} filtered chunks.`
			);
			tempVectorStore = new MemoryVectorStore(this.embeddingsService);

			const filteredVectors: number[][] = [];
			const filteredDocsForStore: Document[] = [];
			const allStoreVectors = this.mainVectorStore?.memoryVectors || [];

			for (const chunk of filteredDocuments) {
				const foundVector = allStoreVectors.find(
					(sv) =>
						sv.metadata.source === chunk.metadata.source &&
						sv.content === chunk.pageContent
				);
				if (foundVector) {
					filteredDocsForStore.push(chunk);
					filteredVectors.push(foundVector.embedding);
				}
			}

			if (filteredVectors.length > 0) {
				await tempVectorStore.addVectors(
					filteredVectors,
					filteredDocsForStore
				);
				currentChain = await createConversationalRAGChain(
					this.llm,
					tempVectorStore
				);
			} else if (filteredDocuments.length > 0) {
				new Notice(
					"Could not map filtered chunks to existing vectors. Using original vector store."
				);
				currentChain = this.chain;
			}
		}

		if (!currentChain) {
			return "Error: Intelligence chain could not be initialized.";
		}

		try {
			// Step 4: Enhance query with context about [[filename]] syntax and filters
			let enhancedQuery = semanticQuery;
			if (metadataFilters && metadataFilters.length > 0) {
				const contextInfo = this.createContextFromFilteredDocuments(
					filteredDocuments,
					metadataFilters
				);
				let systemContext = "";

				// Check if query contains [[filename]] syntax and add system instructions
				if (
					semanticQuery.includes("[[") &&
					semanticQuery.includes("]]")
				) {
					systemContext +=
						"Note: The user is using [[filename]] syntax to reference specific files. When you see [[filename]], it refers to the content of that specific file. ";
				}

				if (contextInfo) {
					enhancedQuery = `System context: ${systemContext}Based on the following filtered documents:\n${contextInfo}\n\nUser question: ${semanticQuery}`;
				}
			}

			const formattedHistory: BaseMessage[] = history.map((msg) =>
				msg.type === "human"
					? new HumanMessage(msg.content)
					: new AIMessage(msg.content)
			);

			const result = await currentChain.invoke({
				input: enhancedQuery,
				chat_history: formattedHistory,
			});

			if (this.plugin) this.plugin.updateStatusBar("Intelligence: Ready");

			if (typeof result === "string") return result;
			if (
				result &&
				typeof result === "object" &&
				"answer" in result &&
				typeof result.answer === "string"
			) {
				return result.answer;
			}

			console.error(
				"Unexpected Intelligence chain result format:",
				result
			);
			return "Received an unexpected response format.";
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				"Error processing query with Intelligence chain:",
				errorMessage
			);
			new Notice(`Error answering question: ${errorMessage}`);
			if (this.plugin) this.plugin.updateStatusBar("Intelligence: Error");
			return null;
		}
	}

	async reInitialize(): Promise<void> {
		this.isInitialized = false;
		this.allDocumentChunks = null;
		this.mainVectorStore = null;
		this.chain = null;
		this.embeddingsService = null; // Reset embeddingsService too
		this.llm = null;
		if (this.plugin)
			this.plugin.updateStatusBar("Intelligence: Re-initializing...");

		// Attempt to remove the persisted file before re-indexing
		await this.ensureDataDirExists();
		const filePath = `${this.dataDir}/${VECTOR_STORE_FILE_PATH}`;
		try {
			if (await this.app.vault.adapter.exists(filePath)) {
				await this.app.vault.adapter.remove(filePath);
				new Notice("Cleared persisted vector store for re-indexing.");
			}
		} catch (e) {
			console.warn(
				"Could not remove old vector store file during re-initialization:",
				e
			);
		}

		await this.initialize();
	}

	public getIsInitialized(): boolean {
		return this.isInitialized;
	}
}
