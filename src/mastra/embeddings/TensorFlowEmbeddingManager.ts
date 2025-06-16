// TensorFlow.js Embedding Manager using Universal Sentence Encoder
import { Notice } from "obsidian";
import { EmbeddingModel } from "../mastra/agents/types";
import { simpleHash } from "./utils/textProcessing";

// Dynamic imports to handle TensorFlow.js loading gracefully
let tf: any = null;
let use: any = null;

/**
 * TensorFlow.js based embedding manager using Universal Sentence Encoder
 * Provides high-quality semantic embeddings when browser environment supports it
 */
export class TensorFlowEmbeddingManager implements EmbeddingModel {
	readonly name = "Universal-Sentence-Encoder";
	readonly dimensions = 512; // USE generates 512-dimensional embeddings

	private model: any = null;
	private isInitialized = false;
	private isInitializing = false;
	private isAvailable = false;
	private embedCache: Map<string, number[]> = new Map();
	private maxCacheSize = 1000;

	constructor() {}

	/**
	 * Initialize the TensorFlow.js Universal Sentence Encoder
	 */
	async initialize(): Promise<void> {
		if (this.isInitializing) {
			return;
		}
		if (this.isInitialized) {
			return;
		}

		this.isInitializing = true;

		try {
			console.log(
				"Initializing TensorFlow.js Universal Sentence Encoder..."
			);
			new Notice("Loading TensorFlow.js embedding model...");

			// Try to dynamically import TensorFlow.js
			try {
				tf = await import("@tensorflow/tfjs");
				use = await import(
					"@tensorflow-models/universal-sentence-encoder"
				);

				console.log("TensorFlow.js libraries loaded successfully");
			} catch (importError) {
				throw new Error(`Failed to load TensorFlow.js: ${importError}`);
			}

			// Set backend to CPU for better compatibility
			await tf.setBackend("cpu");
			await tf.ready();

			console.log(
				"TensorFlow.js backend ready, loading Universal Sentence Encoder..."
			);

			// Load the Universal Sentence Encoder model
			this.model = await use.load();

			this.isInitialized = true;
			this.isAvailable = true;

			console.log("Universal Sentence Encoder model loaded successfully");
			new Notice("TensorFlow.js embeddings ready!");
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.warn(
				"TensorFlow.js embedding initialization failed:",
				errorMsg
			);

			this.isAvailable = false;
			this.isInitialized = false;

			// Don't throw error - let the system fall back to TF-IDF
			console.log("Will fall back to TF-IDF embeddings");
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string): Promise<number[]> {
		if (!this.isInitialized || !this.isAvailable || !this.model) {
			throw new Error("TensorFlow.js embedding manager not available");
		}

		// Check cache first
		const cacheKey = this.getCacheKey(text);
		if (this.embedCache.has(cacheKey)) {
			return this.embedCache.get(cacheKey)!;
		}

		try {
			// Preprocess text (basic cleanup)
			const processedText = this.preprocessText(text);

			if (processedText.length === 0) {
				// Return zero vector for empty text
				const zeroVector = new Array(this.dimensions).fill(0);
				this.cacheEmbedding(cacheKey, zeroVector);
				return zeroVector;
			}

			// Generate embedding using Universal Sentence Encoder
			const embeddings = await this.model.embed([processedText]);
			const embeddingArray = await embeddings.array();

			// Extract the embedding vector
			const embedding = Array.from(embeddingArray[0]) as number[];

			// Dispose of tensors to prevent memory leaks
			embeddings.dispose();

			// Validate embedding dimensions
			if (embedding.length !== this.dimensions) {
				throw new Error(
					`Expected ${this.dimensions} dimensions, got ${embedding.length}`
				);
			}

			// Cache the result
			this.cacheEmbedding(cacheKey, embedding);

			return embedding;
		} catch (error) {
			console.error("Error generating TensorFlow.js embedding:", error);
			throw error;
		}
	}

	/**
	 * Generate embeddings for multiple texts (batch processing)
	 */
	async embedBatch(texts: string[]): Promise<number[][]> {
		if (!this.isInitialized || !this.isAvailable || !this.model) {
			throw new Error("TensorFlow.js embedding manager not available");
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

		// Process uncached texts in batch
		if (uncachedTexts.length > 0) {
			console.log(
				`Generating TensorFlow.js embeddings for ${uncachedTexts.length} texts...`
			);

			try {
				// Preprocess all texts
				const processedTexts = uncachedTexts.map((text) =>
					this.preprocessText(text)
				);

				// Generate embeddings in batch (more efficient)
				const batchEmbeddings = await this.model.embed(processedTexts);
				const embeddingArray = await batchEmbeddings.array();

				// Extract and store embeddings
				for (let i = 0; i < uncachedTexts.length; i++) {
					const originalIndex = uncachedIndices[i];
					const embedding = Array.from(embeddingArray[i]) as number[];

					embeddings[originalIndex] = embedding;

					// Cache the result
					const cacheKey = this.getCacheKey(uncachedTexts[i]);
					this.cacheEmbedding(cacheKey, embedding);
				}

				// Dispose of tensors to prevent memory leaks
				batchEmbeddings.dispose();
			} catch (error) {
				console.error(
					"Error in batch TensorFlow.js embedding generation:",
					error
				);
				throw error;
			}
		}

		return embeddings;
	}

	/**
	 * Check if TensorFlow.js is available and working
	 */
	async testAvailability(): Promise<boolean> {
		try {
			await this.initialize();

			if (this.isAvailable && this.model) {
				// Test with a simple sentence
				const testEmbedding = await this.embed(
					"This is a test sentence."
				);
				return testEmbedding.length === this.dimensions;
			}

			return false;
		} catch (error) {
			console.warn("TensorFlow.js availability test failed:", error);
			return false;
		}
	}

	/**
	 * Get information about the embedding model
	 */
	getModelInfo(): {
		name: string;
		dimensions: number;
		isLocal: boolean;
		isInitialized: boolean;
		isAvailable: boolean;
		cacheSize: number;
	} {
		return {
			name: this.name,
			dimensions: this.dimensions,
			isLocal: true,
			isInitialized: this.isInitialized,
			isAvailable: this.isAvailable,
			cacheSize: this.embedCache.size,
		};
	}

	/**
	 * Check if embedding manager is ready
	 */
	isReady(): boolean {
		return this.isInitialized && this.isAvailable && this.model !== null;
	}

	/**
	 * Clear embedding cache
	 */
	clearCache(): void {
		this.embedCache.clear();
		console.log("TensorFlow.js embedding cache cleared");
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
		// Dispose of the model if it exists
		if (this.model && this.model.dispose) {
			this.model.dispose();
			this.model = null;
		}

		this.embedCache.clear();
		this.isInitialized = false;
		this.isAvailable = false;

		console.log("TensorFlow.js embedding manager cleaned up");
	}

	/**
	 * Preprocess text for embedding
	 */
	private preprocessText(text: string): string {
		return text
			.trim()
			.replace(/\s+/g, " ") // Normalize whitespace
			.substring(0, 1000); // Truncate very long texts
	}

	/**
	 * Generate cache key for text
	 */
	private getCacheKey(text: string): string {
		return `tf_${simpleHash(text.substring(0, 200))}`;
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
	 * Calculate similarity between two texts using TensorFlow.js embeddings
	 */
	async calculateSimilarity(text1: string, text2: string): Promise<number> {
		const [embedding1, embedding2] = await Promise.all([
			this.embed(text1),
			this.embed(text2),
		]);

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
