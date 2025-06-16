// Hybrid Embedding Manager - Orchestrates between TF-IDF and TensorFlow.js
import { Notice } from "obsidian";
import { EmbeddingModel } from "../mastra/agents/types";
import { TfIdfEmbeddingManager } from "./TfIdfEmbeddingManager";
import { TensorFlowEmbeddingManager } from "./TensorFlowEmbeddingManager";

export type EmbeddingMethod = "auto" | "tensorflow" | "tfidf" | "openai";

export interface HybridEmbeddingConfig {
	method?: EmbeddingMethod;
	tfIdfConfig?: {
		dimensions?: number;
		maxVocabularySize?: number;
		useStopwords?: boolean;
		useStemming?: boolean;
	};
	fallbackTimeout?: number; // Timeout for TensorFlow.js initialization
}

/**
 * Hybrid embedding manager that provides the best available embedding method
 * with graceful fallback from TensorFlow.js to TF-IDF
 */
export class HybridEmbeddingManager implements EmbeddingModel {
	readonly name: string;
	readonly dimensions: number;

	private config: HybridEmbeddingConfig;
	private primaryManager: EmbeddingModel;
	private fallbackManager: TfIdfEmbeddingManager;
	private tensorflowManager: TensorFlowEmbeddingManager;
	private usingFallback = false;
	private isInitialized = false;
	private isInitializing = false;
	private initializationAttempted = false;

	constructor(config: HybridEmbeddingConfig = {}) {
		this.config = {
			method: "auto",
			fallbackTimeout: 30000, // 30 seconds
			...config,
		};

		// Initialize managers
		this.fallbackManager = new TfIdfEmbeddingManager(
			this.config.tfIdfConfig
		);
		this.tensorflowManager = new TensorFlowEmbeddingManager();

		// Set initial primary based on method
		if (this.config.method === "tfidf") {
			this.primaryManager = this.fallbackManager;
			this.usingFallback = true;
			this.name = "TF-IDF (Forced)";
			this.dimensions = this.fallbackManager.dimensions;
		} else {
			this.primaryManager = this.tensorflowManager;
			this.name = "Hybrid (TensorFlow.js + TF-IDF)";
			this.dimensions = this.tensorflowManager.dimensions;
		}
	}

	/**
	 * Initialize the hybrid embedding system
	 */
	async initialize(): Promise<void> {
		if (this.isInitializing) {
			return;
		}
		if (this.isInitialized) {
			return;
		}

		this.isInitializing = true;
		this.initializationAttempted = true;

		try {
			console.log("Initializing hybrid embedding system...");
			new Notice("Initializing embedding system...");

			// Always initialize TF-IDF (our reliable fallback)
			await this.fallbackManager.initialize();
			console.log("TF-IDF manager initialized successfully");

			// Try to initialize TensorFlow.js based on method
			if (
				this.config.method === "auto" ||
				this.config.method === "tensorflow"
			) {
				await this.initializeTensorFlow();
			} else {
				// Use TF-IDF only
				this.useFallback("TF-IDF mode selected");
			}

			this.isInitialized = true;
			this.logFinalStatus();
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.error(
				"Error during hybrid embedding initialization:",
				errorMsg
			);

			// Ensure fallback is working
			if (!this.fallbackManager.isReady()) {
				throw error;
			}

			this.useFallback(`Initialization error: ${errorMsg}`);
			this.isInitialized = true;
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string): Promise<number[]> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		try {
			const embedding = await this.primaryManager.embed(text);

			// Verify embedding has correct dimensions
			if (embedding.length !== this.dimensions) {
				console.warn(
					`Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`
				);

				// If using TensorFlow.js and it fails, switch to fallback
				if (!this.usingFallback) {
					console.log(
						"Switching to TF-IDF due to dimension mismatch"
					);
					this.useFallback("Dimension mismatch in TensorFlow.js");
					return await this.fallbackManager.embed(text);
				}
			}

			return embedding;
		} catch (error) {
			console.error("Primary embedding failed:", error);

			// If primary fails and we're not already using fallback, switch
			if (!this.usingFallback) {
				console.log(
					"Switching to TF-IDF due to primary embedding failure"
				);
				this.useFallback(`Primary embedding error: ${error}`);
				return await this.fallbackManager.embed(text);
			}

			throw error;
		}
	}

	/**
	 * Generate embeddings for multiple texts (batch processing)
	 */
	async embedBatch(texts: string[]): Promise<number[][]> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		try {
			return await this.primaryManager.embedBatch(texts);
		} catch (error) {
			console.error("Primary batch embedding failed:", error);

			// If primary fails and we're not already using fallback, switch
			if (!this.usingFallback) {
				console.log("Switching to TF-IDF for batch embedding");
				this.useFallback(`Batch embedding error: ${error}`);
				return await this.fallbackManager.embedBatch(texts);
			}

			throw error;
		}
	}

	/**
	 * Add documents to the corpus (for TF-IDF improvement)
	 */
	async addDocuments(
		documents: Array<{ content: string; source?: string }>
	): Promise<void> {
		// Always add to TF-IDF for better IDF calculations
		await this.fallbackManager.addDocuments(documents);

		console.log(`Added ${documents.length} documents to TF-IDF corpus`);
	}

	/**
	 * Switch embedding method (useful for user preferences)
	 */
	async switchMethod(method: EmbeddingMethod): Promise<void> {
		if (this.config.method === method) {
			return; // Already using this method
		}

		console.log(`Switching embedding method to: ${method}`);
		this.config.method = method;

		if (method === "tfidf") {
			this.useFallback("Manual switch to TF-IDF");
		} else if (method === "tensorflow") {
			// Try to use TensorFlow.js only
			if (this.tensorflowManager.isReady()) {
				this.primaryManager = this.tensorflowManager;
				this.usingFallback = false;
				this.updateDimensions();
				console.log("Switched to TensorFlow.js mode");
			} else {
				console.warn(
					"TensorFlow.js not available, staying with TF-IDF"
				);
			}
		} else if (method === "auto") {
			// Auto mode: prefer TensorFlow.js, fallback to TF-IDF
			if (this.tensorflowManager.isReady()) {
				this.primaryManager = this.tensorflowManager;
				this.usingFallback = false;
				this.updateDimensions();
				console.log("Auto mode: using TensorFlow.js");
			} else {
				this.useFallback("Auto mode: TensorFlow.js not available");
			}
		}

		new Notice(`Embedding method: ${this.getActiveMethod()}`);
	}

	/**
	 * Get the currently active embedding method
	 */
	getActiveMethod(): string {
		if (this.usingFallback) {
			return "TF-IDF";
		} else if (this.tensorflowManager.isReady()) {
			return "TensorFlow.js (Universal Sentence Encoder)";
		} else {
			return "Unknown";
		}
	}

	/**
	 * Get embedding system status
	 */
	getStatus(): {
		method: EmbeddingMethod;
		activeManager: string;
		usingFallback: boolean;
		isInitialized: boolean;
		tensorflowAvailable: boolean;
		tfIdfReady: boolean;
		dimensions: number;
	} {
		return {
			method: this.config.method!,
			activeManager: this.getActiveMethod(),
			usingFallback: this.usingFallback,
			isInitialized: this.isInitialized,
			tensorflowAvailable: this.tensorflowManager.isReady(),
			tfIdfReady: this.fallbackManager.isReady(),
			dimensions: this.dimensions,
		};
	}

	/**
	 * Get information about the embedding model
	 */
	getModelInfo(): {
		name: string;
		dimensions: number;
		isLocal: boolean;
		isInitialized: boolean;
		cacheSize: number;
		activeMethod: string;
		fallbackAvailable: boolean;
	} {
		const primaryInfo = this.primaryManager.getModelInfo();

		return {
			name: this.name,
			dimensions: this.dimensions,
			isLocal: true,
			isInitialized: this.isInitialized,
			cacheSize: primaryInfo.cacheSize,
			activeMethod: this.getActiveMethod(),
			fallbackAvailable: this.fallbackManager.isReady(),
		};
	}

	/**
	 * Check if embedding manager is ready
	 */
	isReady(): boolean {
		return this.isInitialized && this.primaryManager.isReady();
	}

	/**
	 * Clear embedding cache for all managers
	 */
	clearCache(): void {
		this.tensorflowManager.clearCache();
		this.fallbackManager.clearCache();
		console.log("All embedding caches cleared");
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		size: number;
		maxSize: number;
		hitRate: number;
		fallbackCacheSize?: number;
	} {
		const primaryStats = this.primaryManager.getCacheStats();
		const fallbackStats = this.fallbackManager.getCacheStats();

		return {
			...primaryStats,
			fallbackCacheSize: fallbackStats.size,
		};
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		await this.tensorflowManager.cleanup();
		await this.fallbackManager.cleanup();
		this.isInitialized = false;
		this.initializationAttempted = false;

		console.log("Hybrid embedding manager cleaned up");
	}

	/**
	 * Initialize TensorFlow.js with timeout and fallback
	 */
	private async initializeTensorFlow(): Promise<void> {
		try {
			console.log("Attempting to initialize TensorFlow.js...");

			// Create a timeout promise
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(
					() =>
						reject(
							new Error("TensorFlow.js initialization timeout")
						),
					this.config.fallbackTimeout
				);
			});

			// Race between initialization and timeout
			await Promise.race([
				this.tensorflowManager.initialize(),
				timeoutPromise,
			]);

			// Test if TensorFlow.js is actually working
			const isWorking = await this.tensorflowManager.testAvailability();

			if (isWorking) {
				this.primaryManager = this.tensorflowManager;
				this.usingFallback = false;
				console.log("TensorFlow.js initialized successfully");
			} else {
				throw new Error("TensorFlow.js availability test failed");
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.warn(`TensorFlow.js initialization failed: ${errorMsg}`);

			if (this.config.method === "tensorflow") {
				// User specifically requested TensorFlow.js
				throw new Error(
					`TensorFlow.js required but failed to initialize: ${errorMsg}`
				);
			}

			this.useFallback(`TensorFlow.js failed: ${errorMsg}`);
		}
	}

	/**
	 * Switch to fallback manager (TF-IDF)
	 */
	private useFallback(reason: string): void {
		console.log(`Using TF-IDF fallback: ${reason}`);
		this.primaryManager = this.fallbackManager;
		this.usingFallback = true;
		this.updateDimensions();
	}

	/**
	 * Update dimensions based on active manager
	 */
	private updateDimensions(): void {
		(this as any).dimensions = this.primaryManager.dimensions;
	}

	/**
	 * Log final initialization status
	 */
	private logFinalStatus(): void {
		const status = this.getStatus();
		const method = this.getActiveMethod();

		console.log(
			`Hybrid embedding system ready: ${method} (${status.dimensions}D)`
		);
		new Notice(`Embeddings: ${method}`);
	}
}
