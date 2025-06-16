// OpenAI Embedding Manager using text-embedding-3-small
import { EmbeddingModel } from "../mastra/agents/types";

interface OpenAIEmbeddingResponse {
	data: Array<{
		embedding: number[];
		index: number;
	}>;
	model: string;
	usage: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

/**
 * Manages embedding generation using OpenAI's text-embedding-3-small model
 * Provides fast, high-quality embeddings with real-time update capabilities
 */
export class OpenAIEmbeddingManager implements EmbeddingModel {
	readonly name = "text-embedding-3-small";
	readonly dimensions = 1536; // text-embedding-3-small dimensions

	private apiKey: string | null = null;
	private isInitialized = false;
	private embedCache: Map<string, number[]> = new Map();
	private batchSize = 100; // Optimal batch size for OpenAI API
	private maxCacheSize = 2000; // Larger cache for cloud embeddings
	private baseUrl = "https://api.openai.com/v1/embeddings";

	constructor(apiKey?: string) {
		this.apiKey = apiKey || null;
	}

	/**
	 * Initialize the embedding manager
	 */
	async initialize(apiKey?: string): Promise<void> {
		console.log("OpenAIEmbeddingManager: Starting initialization...");

		if (this.isInitialized) {
			console.log(
				"OpenAIEmbeddingManager: Already initialized, skipping"
			);
			return;
		}

		if (apiKey) {
			console.log(
				"OpenAIEmbeddingManager: Setting API key from parameter"
			);
			this.apiKey = apiKey;
		}
		if (!this.apiKey) {
			throw new Error(
				"OpenAI API key is required for embedding generation"
			);
		}

		// Test the API key with a simple embedding request
		// try {
		//   const processedText = this.preprocessText('test');

		//   const response = await fetch(this.baseUrl, {
		//     method: 'POST',
		//     headers: {
		//       'Authorization': `Bearer ${this.apiKey}`,
		//       'Content-Type': 'application/json',
		//     },
		//     body: JSON.stringify({
		//       model: this.name,
		//       input: processedText,
		//       encoding_format: 'float',
		//     }),
		//   });

		//   if (!response.ok) {
		//     const errorData = await response.json().catch(() => ({}));
		//     throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
		//   }

		//   const data: OpenAIEmbeddingResponse = await response.json();

		//   if (!data.data || data.data.length === 0) {
		//     throw new Error('No embedding data received from OpenAI API');
		//   }

		//   this.isInitialized = true;
		//   console.log('OpenAI embedding manager initialized successfully');
		// } catch (error) {
		//   const errorMsg = error instanceof Error ? error.message : String(error);
		//   console.error('Failed to initialize OpenAI embedding manager:', errorMsg);
		//   throw new Error(`OpenAI API key validation failed: ${errorMsg}`);
		// }
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string): Promise<number[]> {
		if (!this.isInitialized || !this.apiKey) {
			throw new Error("OpenAI embedding manager not initialized");
		}

		// Check cache first
		const cacheKey = this.getCacheKey(text);
		if (this.embedCache.has(cacheKey)) {
			return this.embedCache.get(cacheKey)!;
		}

		try {
			const processedText = this.preprocessText(text);

			const response = await fetch(this.baseUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: this.name,
					input: processedText,
					encoding_format: "float",
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					`OpenAI API error: ${response.status} - ${
						errorData.error?.message || "Unknown error"
					}`
				);
			}

			const data: OpenAIEmbeddingResponse = await response.json();

			if (!data.data || data.data.length === 0) {
				throw new Error("No embedding data received from OpenAI API");
			}

			const embedding = data.data[0].embedding;

			// Validate embedding
			if (embedding.length !== this.dimensions) {
				throw new Error(
					`Expected ${this.dimensions} dimensions, got ${embedding.length}`
				);
			}

			// Cache the result
			this.cacheEmbedding(cacheKey, embedding);

			return embedding;
		} catch (error) {
			console.error("Error generating OpenAI embedding:", error);
			throw error;
		}
	}

	/**
	 * Generate embeddings for multiple texts (batch processing)
	 */
	async embedBatch(texts: string[]): Promise<number[][]> {
		if (!this.isInitialized || !this.apiKey) {
			throw new Error("OpenAI embedding manager not initialized");
		}

		if (texts.length === 0) {
			return [];
		}

		// Check cache for each text
		const embeddings: number[][] = [];
		const uncachedTexts: string[] = [];
		const uncachedIndices: number[] = [];

		for (let i = 0; i < texts.length; i++) {
			const cacheKey = this.getCacheKey(texts[i]);
			if (this.embedCache.has(cacheKey)) {
				embeddings[i] = this.embedCache.get(cacheKey)!;
			} else {
				uncachedTexts.push(texts[i]);
				uncachedIndices.push(i);
			}
		}

		// Process uncached texts in batches
		if (uncachedTexts.length > 0) {
			console.log(
				`Generating OpenAI embeddings for ${uncachedTexts.length} texts...`
			);

			const batches = this.chunkArray(uncachedTexts, this.batchSize);
			let processedCount = 0;

			for (const batch of batches) {
				try {
					// Preprocess batch
					const processedBatch = batch.map((text) =>
						this.preprocessText(text)
					);

					const response = await fetch(this.baseUrl, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${this.apiKey}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							model: this.name,
							input: processedBatch,
							encoding_format: "float",
						}),
					});

					if (!response.ok) {
						const errorData = await response
							.json()
							.catch(() => ({}));
						throw new Error(
							`OpenAI API error: ${response.status} - ${
								errorData.error?.message || "Unknown error"
							}`
						);
					}

					const data: OpenAIEmbeddingResponse = await response.json();

					if (!data.data || data.data.length !== batch.length) {
						throw new Error(
							`Expected ${batch.length} embeddings, got ${
								data.data?.length || 0
							}`
						);
					}

					// Sort by index to ensure correct order
					const sortedEmbeddings = data.data.sort(
						(a, b) => a.index - b.index
					);

					// Store results and cache
					for (let i = 0; i < batch.length; i++) {
						const originalIndex =
							uncachedIndices[processedCount + i];
						const embedding = sortedEmbeddings[i].embedding;

						// Validate embedding
						if (embedding.length !== this.dimensions) {
							throw new Error(
								`Expected ${this.dimensions} dimensions, got ${embedding.length}`
							);
						}

						embeddings[originalIndex] = embedding;

						// Cache the result
						const cacheKey = this.getCacheKey(batch[i]);
						this.cacheEmbedding(cacheKey, embedding);
					}

					processedCount += batch.length;

					// Progress feedback for large batches
					if (uncachedTexts.length > 50) {
						console.log(
							`Processed ${processedCount}/${uncachedTexts.length} texts...`
						);
					}

					// Rate limiting: small delay between batches
					if (batches.length > 1) {
						await new Promise((resolve) =>
							setTimeout(resolve, 100)
						);
					}
				} catch (error) {
					console.error(
						"Error in OpenAI batch embedding generation:",
						error
					);
					throw error;
				}
			}
		}

		return embeddings;
	}

	/**
	 * Update API key
	 */
	updateApiKey(apiKey: string): void {
		this.apiKey = apiKey;
		this.isInitialized = false;
	}

	/**
	 * Get embedding model information
	 */
	getModelInfo(): {
		name: string;
		dimensions: number;
		isLocal: boolean;
		isInitialized: boolean;
		cacheSize: number;
	} {
		return {
			name: this.name,
			dimensions: this.dimensions,
			isLocal: false,
			isInitialized: this.isInitialized,
			cacheSize: this.embedCache.size,
		};
	}

	/**
	 * Check if embedding manager is ready
	 */
	isReady(): boolean {
		return this.isInitialized && this.apiKey !== null;
	}

	/**
	 * Clear embedding cache
	 */
	clearCache(): void {
		this.embedCache.clear();
		console.log("OpenAI embedding cache cleared");
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		size: number;
		maxSize: number;
		hitRate: number;
	} {
		return {
			size: this.embedCache.size,
			maxSize: this.maxCacheSize,
			hitRate: 0, // TODO: Implement hit rate tracking
		};
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		this.embedCache.clear();
		this.isInitialized = false;
		this.apiKey = null;
		console.log("OpenAI embedding manager cleaned up");
	}

	/**
	 * Preprocess text for embedding
	 */
	private preprocessText(text: string): string {
		// OpenAI models can handle longer texts, but we'll still normalize
		return text
			.trim()
			.replace(/\s+/g, " ") // Normalize whitespace
			.substring(0, 8192); // OpenAI's max token limit is ~8192 tokens
	}

	/**
	 * Generate cache key for text
	 */
	private getCacheKey(text: string): string {
		const processed = this.preprocessText(text);
		return this.simpleHash(processed);
	}

	/**
	 * Cache embedding with size management
	 */
	private cacheEmbedding(key: string, embedding: number[]): void {
		// Remove oldest entries if cache is full
		if (this.embedCache.size >= this.maxCacheSize) {
			const firstKey = this.embedCache.keys().next().value;
			if (firstKey) {
				this.embedCache.delete(firstKey);
			}
		}

		this.embedCache.set(key, embedding);
	}

	/**
	 * Simple hash function for cache keys
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Chunk array into smaller arrays
	 */
	private chunkArray<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}

	/**
	 * Test embedding generation (for debugging)
	 */
	async testEmbedding(): Promise<boolean> {
		try {
			const testText =
				"This is a test sentence for OpenAI embedding generation.";
			const embedding = await this.embed(testText);

			console.log(
				`Test OpenAI embedding generated: ${embedding.length} dimensions`
			);
			console.log(
				`First few values: ${embedding.slice(0, 5).join(", ")}`
			);

			return embedding.length === this.dimensions;
		} catch (error) {
			console.error("OpenAI embedding test failed:", error);
			return false;
		}
	}

	/**
	 * Calculate similarity between two embeddings
	 */
	static calculateSimilarity(
		embedding1: number[],
		embedding2: number[]
	): number {
		if (embedding1.length !== embedding2.length) {
			throw new Error("Embeddings must have the same dimensions");
		}

		// Calculate cosine similarity
		let dotProduct = 0;
		let norm1 = 0;
		let norm2 = 0;

		for (let i = 0; i < embedding1.length; i++) {
			dotProduct += embedding1[i] * embedding2[i];
			norm1 += embedding1[i] * embedding1[i];
			norm2 += embedding2[i] * embedding2[i];
		}

		const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
		return magnitude === 0 ? 0 : dotProduct / magnitude;
	}
}
