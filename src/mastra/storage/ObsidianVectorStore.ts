import { App } from "obsidian";

export interface ObsidianVectorStoreConfig {
	dataDir: string;
	fileName?: string;
	dimensions?: number;
}

export interface VectorData {
	id: string;
	vector: number[];
	metadata?: Record<string, any>;
}

export interface VectorQueryResult {
	id: string;
	vector: number[];
	metadata?: Record<string, any>;
	score: number;
}

/**
 * Obsidian-compatible vector store that uses the file system
 * Replaces LibSQL vector storage with JSON file storage
 */
export class ObsidianVectorStore {
	private app: App;
	private dataPath: string;
	private vectors: Record<string, VectorData> = {};
	private initialized = false;
	private dimensions: number;

	constructor(app: App, config: ObsidianVectorStoreConfig) {
		this.app = app;
		this.dataPath = `${config.dataDir}/${config.fileName || 'vectors.json'}`;
		this.dimensions = config.dimensions || 1536; // Default OpenAI embedding size
	}

	/**
	 * Initialize the vector store
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.loadData();
			this.initialized = true;
			console.log("ObsidianVectorStore initialized successfully");
		} catch (error) {
			console.error("Failed to initialize ObsidianVectorStore:", error);
			throw error;
		}
	}

	/**
	 * Upsert vectors (insert or update)
	 */
	async upsert(vectors: VectorData[]): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		for (const vector of vectors) {
			// Validate vector dimensions
			if (vector.vector.length !== this.dimensions) {
				console.warn(`Vector ${vector.id} has ${vector.vector.length} dimensions, expected ${this.dimensions}`);
			}
			
			this.vectors[vector.id] = {
				...vector,
				metadata: {
					...vector.metadata,
					updatedAt: new Date().toISOString(),
				}
			};
		}

		await this.saveData();
	}

	/**
	 * Query vectors using cosine similarity
	 */
	async query(
		queryVector: number[], 
		options: {
			topK?: number;
			filter?: Record<string, any>;
			includeMetadata?: boolean;
		} = {}
	): Promise<VectorQueryResult[]> {
		if (!this.initialized) {
			await this.initialize();
		}

		const { topK = 5, filter, includeMetadata = true } = options;

		// Validate query vector dimensions
		if (queryVector.length !== this.dimensions) {
			throw new Error(`Query vector has ${queryVector.length} dimensions, expected ${this.dimensions}`);
		}

		// Get all vectors and calculate similarities
		let candidates = Object.values(this.vectors);

		// Apply filters if provided
		if (filter) {
			candidates = candidates.filter(vector => 
				this.matchesFilter(vector.metadata || {}, filter)
			);
		}

		// Calculate cosine similarity for each vector
		const results: VectorQueryResult[] = candidates.map(vector => ({
			id: vector.id,
			vector: vector.vector,
			metadata: includeMetadata ? vector.metadata : undefined,
			score: this.cosineSimilarity(queryVector, vector.vector),
		}));

		// Sort by similarity score (descending) and take top K
		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
	}

	/**
	 * Delete vectors by IDs
	 */
	async delete(ids: string[]): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		for (const id of ids) {
			delete this.vectors[id];
		}

		await this.saveData();
	}

	/**
	 * Delete vectors by filter
	 */
	async deleteByFilter(filter: Record<string, any>): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		const idsToDelete: string[] = [];
		
		for (const [id, vector] of Object.entries(this.vectors)) {
			if (this.matchesFilter(vector.metadata || {}, filter)) {
				idsToDelete.push(id);
			}
		}

		await this.delete(idsToDelete);
	}

	/**
	 * Get vector by ID
	 */
	async getById(id: string): Promise<VectorData | null> {
		if (!this.initialized) {
			await this.initialize();
		}

		return this.vectors[id] || null;
	}

	/**
	 * Get all vector IDs
	 */
	async getAllIds(): Promise<string[]> {
		if (!this.initialized) {
			await this.initialize();
		}

		return Object.keys(this.vectors);
	}

	/**
	 * Get vector count
	 */
	async count(): Promise<number> {
		if (!this.initialized) {
			await this.initialize();
		}

		return Object.keys(this.vectors).length;
	}

	/**
	 * Clear all vectors
	 */
	async clear(): Promise<void> {
		this.vectors = {};
		await this.saveData();
	}

	/**
	 * Calculate cosine similarity between two vectors
	 */
	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) {
			throw new Error("Vectors must have the same length");
		}

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		
		if (denominator === 0) {
			return 0;
		}

		return dotProduct / denominator;
	}

	/**
	 * Check if metadata matches filter criteria
	 */
	private matchesFilter(metadata: Record<string, any>, filter: Record<string, any>): boolean {
		for (const [key, value] of Object.entries(filter)) {
			if (metadata[key] !== value) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Load data from file system
	 */
	private async loadData(): Promise<void> {
		try {
			// Ensure the data directory exists
			const dataDir = this.dataPath.substring(0, this.dataPath.lastIndexOf('/'));
			if (!(await this.app.vault.adapter.exists(dataDir))) {
				await this.app.vault.adapter.mkdir(dataDir);
			}

			// Try to read existing data
			if (await this.app.vault.adapter.exists(this.dataPath)) {
				const content = await this.app.vault.adapter.read(this.dataPath);
				const data = JSON.parse(content);
				this.vectors = data.vectors || {};
				this.dimensions = data.dimensions || this.dimensions;
			} else {
				this.vectors = {};
			}
		} catch (error) {
			console.warn("Failed to load vector data, starting with empty store:", error);
			this.vectors = {};
		}
	}

	/**
	 * Save data to file system
	 */
	private async saveData(): Promise<void> {
		try {
			const data = {
				dimensions: this.dimensions,
				vectorCount: Object.keys(this.vectors).length,
				lastUpdated: new Date().toISOString(),
				vectors: this.vectors,
			};

			await this.app.vault.adapter.write(
				this.dataPath, 
				JSON.stringify(data, null, 2)
			);
		} catch (error) {
			console.error("Failed to save vector data:", error);
			throw error;
		}
	}

	/**
	 * Close/cleanup the vector store
	 */
	async close(): Promise<void> {
		// Ensure final save
		if (this.initialized) {
			await this.saveData();
		}
		this.initialized = false;
	}

	/**
	 * Get storage statistics
	 */
	getStats(): { 
		totalVectors: number; 
		dimensions: number;
		filePath: string;
		initialized: boolean;
	} {
		return {
			totalVectors: Object.keys(this.vectors).length,
			dimensions: this.dimensions,
			filePath: this.dataPath,
			initialized: this.initialized,
		};
	}

	/**
	 * Check if vector store is ready
	 */
	isReady(): boolean {
		return this.initialized;
	}
}