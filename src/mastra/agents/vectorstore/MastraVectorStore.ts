// Mastra-native vector store for Obsidian Intelligence
import { ObsidianVectorStore } from "../../storage/ObsidianVectorStore";
import { App, TFile } from "obsidian";
import { OpenAIEmbeddingManager } from "../../../embeddings/OpenAIEmbeddingManager";
import { VectorSearchOptions } from "../types";

export interface MastraVectorStoreConfig {
	dataDir: string;
	indexName: string;
	dimensions: number;
	fileName?: string;
}

export interface VectorSearchResult {
	id: string;
	content: string;
	metadata: Record<string, any>;
	score: number;
	source?: string;
}

/**
 * Vector store using Obsidian-compatible storage
 */
export class MastraVectorStore {
	private vectorStore: ObsidianVectorStore;
	private embeddingManager: OpenAIEmbeddingManager | null = null;
	private isInitialized = false;
	private config: MastraVectorStoreConfig;
	private app: App | null = null;

	constructor(app: App, config: MastraVectorStoreConfig) {
		this.app = app;
		this.config = config;

		// Initialize Obsidian vector store
		this.vectorStore = new ObsidianVectorStore(app, {
			dataDir: config.dataDir,
			fileName: config.fileName || `${config.indexName}-vectors.json`,
			dimensions: config.dimensions,
		});
	}

	/**
	 * Initialize the vector store
	 */
	async initialize(
		embeddingManager: OpenAIEmbeddingManager,
		app: App
	): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		this.embeddingManager = embeddingManager;
		this.app = app;

		try {
			// Initialize the vector store
			await this.vectorStore.initialize();

			this.isInitialized = true;
			console.log("MastraVectorStore initialized successfully");
		} catch (error) {
			console.error("Failed to initialize MastraVectorStore:", error);
			throw error;
		}
	}


	/**
	 * Index all vault documents
	 */
	async indexVaultDocuments(app: App): Promise<void> {
		if (!this.isInitialized || !this.embeddingManager) {
			throw new Error("Vector store not initialized");
		}

		try {
			console.log("Starting vault document indexing...");

			const markdownFiles = app.vault.getMarkdownFiles();
			const chunks: Array<{
				id: string;
				content: string;
				metadata: Record<string, any>;
			}> = [];

			// Process files in batches
			const batchSize = 10;
			for (let i = 0; i < markdownFiles.length; i += batchSize) {
				const batch = markdownFiles.slice(i, i + batchSize);

				for (const file of batch) {
					try {
						const content = await app.vault.read(file);
						const metadata = app.metadataCache.getFileCache(file);

						// Split content into chunks for better retrieval
						const fileChunks = this.splitIntoChunks(content, 1000);

						for (
							let chunkIndex = 0;
							chunkIndex < fileChunks.length;
							chunkIndex++
						) {
							const chunk = fileChunks[chunkIndex];
							if (chunk.trim().length === 0) continue;

							chunks.push({
								id: `${file.path}_chunk_${chunkIndex}`,
								content: chunk,
								metadata: {
									filePath: file.path,
									fileName: file.name,
									chunkIndex,
									totalChunks: fileChunks.length,
									fileSize: content.length,
									tags:
										metadata?.tags?.map((tag) => tag.tag) ||
										[],
									createdTime: file.stat.ctime,
									modifiedTime: file.stat.mtime,
									...(metadata?.frontmatter || {}),
								},
							});
						}
					} catch (error) {
						console.warn(
							`Failed to process file ${file.path}:`,
							error
						);
					}
				}
			}

			if (chunks.length === 0) {
				console.log("No content to index");
				return;
			}

			// Generate embeddings for all chunks
			console.log(`Generating embeddings for ${chunks.length} chunks...`);
			const texts = chunks.map((chunk) => chunk.content);
			const embeddings = await this.embeddingManager.embedBatch(texts);

			// Prepare vectors for storage
			const vectors = chunks.map((chunk, index) => ({
				id: chunk.id,
				vector: embeddings[index],
				metadata: chunk.metadata,
			}));

			// Store in vector database
			await this.vectorStore.upsert(vectors);

			console.log(
				`Successfully indexed ${chunks.length} document chunks`
			);
		} catch (error) {
			console.error("Failed to index vault documents:", error);
			throw error;
		}
	}

	/**
	 * Search the vector store
	 */
	async searchVectorStore(
		query: string,
		options: VectorSearchOptions = {}
	): Promise<VectorSearchResult[]> {
		if (!this.isInitialized || !this.embeddingManager) {
			throw new Error("Vector store not initialized");
		}

		try {
			// Generate embedding for the query
			const queryEmbedding = await this.embeddingManager.embed(query);

			// Search the vector store
			const results = await this.vectorStore.query(queryEmbedding, {
				topK: options.k || options.limit || 5,
				filter: options.filter,
				includeMetadata: true,
			});

			// Convert to our result format
			return results.map((result) => ({
				id: result.id,
				content: result.metadata?.content || "",
				metadata: result.metadata || {},
				score: result.score || 0,
				source: result.metadata?.filePath || result.id,
			}));
		} catch (error) {
			console.error("Failed to search vector store:", error);
			throw error;
		}
	}

	/**
	 * Add or update documents in the vector store
	 */
	async upsertDocument(
		id: string,
		content: string,
		metadata: Record<string, any> = {}
	): Promise<void> {
		if (!this.isInitialized || !this.embeddingManager) {
			throw new Error("Vector store not initialized");
		}

		try {
			// Generate embedding
			const embedding = await this.embeddingManager.embed(content);

			// Upsert to vector store
			await this.vectorStore.upsert([
				{
					id,
					vector: embedding,
					metadata: {
						...metadata,
						content,
						updatedAt: new Date().toISOString(),
					},
				},
			]);
		} catch (error) {
			console.error("Failed to upsert document:", error);
			throw error;
		}
	}

	/**
	 * Delete documents from the vector store
	 */
	async deleteDocument(id: string): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Vector store not initialized");
		}

		try {
			await this.vectorStore.delete([id]);
		} catch (error) {
			console.error("Failed to delete document:", error);
			throw error;
		}
	}

	/**
	 * Delete documents by filter
	 */
	async deleteByFilter(filter: Record<string, any>): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Vector store not initialized");
		}

		try {
			await this.vectorStore.deleteByFilter(filter);
		} catch (error) {
			console.error("Failed to delete documents by filter:", error);
			throw error;
		}
	}

	/**
	 * Update a specific file in the vector store
	 */
	async updateFile(file: TFile): Promise<void> {
		if (!this.app) {
			throw new Error("App not initialized");
		}

		try {
			// Delete existing chunks for this file
			await this.deleteByFilter({ filePath: file.path });

			// Re-index the file
			const content = await this.app.read(file);
			const metadata = this.app.metadataCache.getFileCache(file);

			const chunks = this.splitIntoChunks(content, 1000);

			for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
				const chunk = chunks[chunkIndex];
				if (chunk.trim().length === 0) continue;

				await this.upsertDocument(
					`${file.path}_chunk_${chunkIndex}`,
					chunk,
					{
						filePath: file.path,
						fileName: file.name,
						chunkIndex,
						totalChunks: chunks.length,
						fileSize: content.length,
						tags: metadata?.tags?.map((tag) => tag.tag) || [],
						createdTime: file.stat.ctime,
						modifiedTime: file.stat.mtime,
						...(metadata?.frontmatter || {}),
					}
				);
			}
		} catch (error) {
			console.error(`Failed to update file ${file.path}:`, error);
			throw error;
		}
	}

	/**
	 * Split text into chunks
	 */
	private splitIntoChunks(text: string, chunkSize: number): string[] {
		const chunks: string[] = [];
		const sentences = text
			.split(/[.!?]+/)
			.filter((s) => s.trim().length > 0);

		let currentChunk = "";

		for (const sentence of sentences) {
			if (
				currentChunk.length + sentence.length > chunkSize &&
				currentChunk.length > 0
			) {
				chunks.push(currentChunk.trim());
				currentChunk = sentence;
			} else {
				currentChunk +=
					(currentChunk.length > 0 ? ". " : "") + sentence;
			}
		}

		if (currentChunk.trim().length > 0) {
			chunks.push(currentChunk.trim());
		}

		return chunks;
	}

	/**
	 * Get vector store statistics
	 */
	async getStats(): Promise<{
		totalDocuments: number;
		indexName: string;
		dimensions: number;
	}> {
		try {
			const stats = this.vectorStore.getStats();
			const count = await this.vectorStore.count();

			return {
				totalDocuments: count,
				indexName: this.config.indexName,
				dimensions: stats.dimensions,
			};
		} catch (error) {
			console.error("Failed to get vector store stats:", error);
			return {
				totalDocuments: 0,
				indexName: this.config.indexName,
				dimensions: this.config.dimensions,
			};
		}
	}

	/**
	 * Get document count
	 */
	async getDocumentCount(): Promise<number> {
		if (!this.isInitialized) {
			return 0;
		}
		return await this.vectorStore.count();
	}

	/**
	 * Check if vector store is ready
	 */
	isReady(): boolean {
		return this.isInitialized;
	}

	/**
	 * Cleanup the vector store
	 */
	async cleanup(): Promise<void> {
		if (this.isInitialized) {
			try {
				await this.vectorStore.close?.();
				this.isInitialized = false;
				console.log("MastraVectorStore cleaned up successfully");
			} catch (error) {
				console.error("Failed to cleanup MastraVectorStore:", error);
			}
		}
	}

	/**
	 * Get the underlying Obsidian vector store instance
	 */
	getObsidianVectorStore(): ObsidianVectorStore {
		return this.vectorStore;
	}
}
