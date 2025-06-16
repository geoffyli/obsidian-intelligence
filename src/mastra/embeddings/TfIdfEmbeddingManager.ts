// TF-IDF Embedding Manager - Reliable browser-compatible embedding system
import { Notice } from "obsidian";
import { EmbeddingModel } from "../mastra/agents/types";
import {
	preprocessText,
	calculateTermFrequency,
	createDocumentId,
	simpleHash,
} from "./utils/textProcessing";
import {
	cosineSimilarity,
	normalizeVector,
	calculateTfIdf,
	createZeroVector,
} from "./utils/mathUtils";

export interface TfIdfConfig {
	dimensions?: number;
	maxVocabularySize?: number;
	minDocumentFrequency?: number;
	maxDocumentFrequency?: number;
	useStopwords?: boolean;
	useStemming?: boolean;
	minWordLength?: number;
}

interface DocumentData {
	id: string;
	content: string;
	tokens: string[];
	termFrequency: Map<string, number>;
	source?: string;
}

/**
 * TF-IDF based embedding manager that provides reliable, browser-compatible
 * text embeddings using term frequency-inverse document frequency calculations
 */
export class TfIdfEmbeddingManager implements EmbeddingModel {
	readonly name = "TF-IDF";
	readonly dimensions: number;

	private config: TfIdfConfig;
	private vocabulary: Map<string, number> = new Map(); // term -> index
	private documentFrequency: Map<string, number> = new Map(); // term -> doc count
	private documents: Map<string, DocumentData> = new Map();
	private embedCache: Map<string, number[]> = new Map();

	private isInitialized = false;
	private isInitializing = false;
	private totalDocuments = 0;
	private maxCacheSize = 1000;
	private vocabularyLocked = false;

	constructor(config: TfIdfConfig = {}) {
		this.config = {
			dimensions: 1000,
			maxVocabularySize: 50000,
			minDocumentFrequency: 2,
			maxDocumentFrequency: 0.95, // 95% of documents
			useStopwords: true,
			useStemming: false,
			minWordLength: 2,
			...config,
		};

		this.dimensions = this.config.dimensions!;
	}

	/**
	 * Initialize the TF-IDF embedding system
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
			console.log("Initializing TF-IDF embedding system...");
			new Notice("Initializing TF-IDF embeddings...");

			// TF-IDF is ready immediately - no model loading required
			this.isInitialized = true;

			console.log("TF-IDF embedding system ready");
			new Notice("TF-IDF embeddings ready!");
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.error("Failed to initialize TF-IDF embeddings:", errorMsg);
			new Notice(`TF-IDF initialization failed: ${errorMsg}`);
			throw error;
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string): Promise<number[]> {
		if (!this.isInitialized) {
			throw new Error("TF-IDF embedding manager not initialized");
		}

		// Check cache first
		const cacheKey = this.getCacheKey(text);
		if (this.embedCache.has(cacheKey)) {
			return this.embedCache.get(cacheKey)!;
		}

		try {
			// Preprocess text
			const tokens = preprocessText(text, {
				removeStopwords: this.config.useStopwords,
				applyStemming: this.config.useStemming,
				minWordLength: this.config.minWordLength,
			});

			if (tokens.length === 0) {
				const zeroVector = createZeroVector(this.dimensions);
				this.cacheEmbedding(cacheKey, zeroVector);
				return zeroVector;
			}

			// Calculate term frequencies
			const termFreq = calculateTermFrequency(tokens);

			// Generate TF-IDF vector
			const embedding = this.generateTfIdfVector(termFreq);

			// Normalize the vector
			const normalizedEmbedding = normalizeVector(embedding);

			// Cache the result
			this.cacheEmbedding(cacheKey, normalizedEmbedding);

			return normalizedEmbedding;
		} catch (error) {
			console.error("Error generating TF-IDF embedding:", error);
			throw error;
		}
	}

	/**
	 * Generate embeddings for multiple texts (batch processing)
	 */
	async embedBatch(texts: string[]): Promise<number[][]> {
		if (!this.isInitialized) {
			throw new Error("TF-IDF embedding manager not initialized");
		}

		if (texts.length === 0) {
			return [];
		}

		const embeddings: number[][] = [];
		const uncachedTexts: { text: string; index: number }[] = [];

		// Check cache for each text
		for (let i = 0; i < texts.length; i++) {
			const cacheKey = this.getCacheKey(texts[i]);
			if (this.embedCache.has(cacheKey)) {
				embeddings[i] = this.embedCache.get(cacheKey)!;
			} else {
				uncachedTexts.push({ text: texts[i], index: i });
			}
		}

		// Process uncached texts
		if (uncachedTexts.length > 0) {
			console.log(
				`Generating TF-IDF embeddings for ${uncachedTexts.length} texts...`
			);

			for (const { text, index } of uncachedTexts) {
				const embedding = await this.embed(text);
				embeddings[index] = embedding;
			}
		}

		return embeddings;
	}

	/**
	 * Add a document to the TF-IDF corpus for better IDF calculations
	 */
	async addDocument(content: string, source?: string): Promise<string> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		const tokens = preprocessText(content, {
			removeStopwords: this.config.useStopwords,
			applyStemming: this.config.useStemming,
			minWordLength: this.config.minWordLength,
		});

		if (tokens.length === 0) {
			console.warn("Document has no valid tokens after preprocessing");
			return "";
		}

		const docId = createDocumentId(content, source);
		const termFreq = calculateTermFrequency(tokens);

		const docData: DocumentData = {
			id: docId,
			content,
			tokens,
			termFrequency: termFreq,
			source,
		};

		// Update vocabulary and document frequency
		this.updateVocabulary(tokens);
		this.documents.set(docId, docData);
		this.totalDocuments++;

		// Clear cache as document frequencies have changed
		this.clearCache();

		console.log(`Added document ${docId} with ${tokens.length} tokens`);
		return docId;
	}

	/**
	 * Add multiple documents in batch
	 */
	async addDocuments(
		documents: Array<{ content: string; source?: string }>
	): Promise<string[]> {
		const docIds: string[] = [];

		console.log(`Adding ${documents.length} documents to TF-IDF corpus...`);

		for (const doc of documents) {
			const docId = await this.addDocument(doc.content, doc.source);
			if (docId) {
				docIds.push(docId);
			}
		}

		// Lock vocabulary after initial corpus building
		this.vocabularyLocked = true;

		console.log(
			`TF-IDF corpus ready: ${this.totalDocuments} documents, ${this.vocabulary.size} terms`
		);

		return docIds;
	}

	/**
	 * Find similar documents using cosine similarity
	 */
	async findSimilar(
		queryText: string,
		topK: number = 10,
		threshold: number = 0.1
	): Promise<
		Array<{ id: string; score: number; content: string; source?: string }>
	> {
		const queryEmbedding = await this.embed(queryText);
		const results: Array<{
			id: string;
			score: number;
			content: string;
			source?: string;
		}> = [];

		for (const [docId, docData] of this.documents.entries()) {
			const docEmbedding = await this.embed(docData.content);
			const similarity = cosineSimilarity(queryEmbedding, docEmbedding);

			if (similarity >= threshold) {
				results.push({
					id: docId,
					score: similarity,
					content: docData.content,
					source: docData.source,
				});
			}
		}

		// Sort by similarity score descending
		results.sort((a, b) => b.score - a.score);

		return results.slice(0, topK);
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
		vocabularySize: number;
		documentCount: number;
	} {
		return {
			name: this.name,
			dimensions: this.dimensions,
			isLocal: true,
			isInitialized: this.isInitialized,
			cacheSize: this.embedCache.size,
			vocabularySize: this.vocabulary.size,
			documentCount: this.totalDocuments,
		};
	}

	/**
	 * Check if embedding manager is ready
	 */
	isReady(): boolean {
		return this.isInitialized;
	}

	/**
	 * Clear embedding cache
	 */
	clearCache(): void {
		this.embedCache.clear();
		console.log("TF-IDF embedding cache cleared");
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
		this.vocabulary.clear();
		this.documentFrequency.clear();
		this.documents.clear();
		this.totalDocuments = 0;
		this.vocabularyLocked = false;
		this.isInitialized = false;

		console.log("TF-IDF embedding manager cleaned up");
	}

	/**
	 * Generate TF-IDF vector from term frequencies
	 */
	private generateTfIdfVector(termFreq: Map<string, number>): number[] {
		const vector = createZeroVector(this.dimensions);

		for (const [term, tf] of termFreq.entries()) {
			const vocabIndex = this.vocabulary.get(term);
			if (vocabIndex !== undefined && vocabIndex < this.dimensions) {
				const df = this.documentFrequency.get(term) || 1;
				const tfidf = calculateTfIdf(
					tf,
					df,
					Math.max(this.totalDocuments, 1)
				);
				vector[vocabIndex] = tfidf;
			}
		}

		return vector;
	}

	/**
	 * Update vocabulary with new terms
	 */
	private updateVocabulary(tokens: string[]): void {
		if (this.vocabularyLocked) {
			return; // Don't update vocabulary after it's locked
		}

		const uniqueTokens = new Set(tokens);

		for (const token of uniqueTokens) {
			// Update document frequency
			this.documentFrequency.set(
				token,
				(this.documentFrequency.get(token) || 0) + 1
			);

			// Add to vocabulary if not exists and under size limit
			if (
				!this.vocabulary.has(token) &&
				this.vocabulary.size < this.config.maxVocabularySize!
			) {
				this.vocabulary.set(token, this.vocabulary.size);
			}
		}
	}

	/**
	 * Generate cache key for text
	 */
	private getCacheKey(text: string): string {
		return simpleHash(text.substring(0, 200));
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
	 * Get vocabulary terms (for debugging)
	 */
	getVocabulary(): string[] {
		return Array.from(this.vocabulary.keys());
	}

	/**
	 * Get document frequency for a term (for debugging)
	 */
	getDocumentFrequency(term: string): number {
		return this.documentFrequency.get(term) || 0;
	}

	/**
	 * Calculate similarity between two texts
	 */
	async calculateSimilarity(text1: string, text2: string): Promise<number> {
		const [embedding1, embedding2] = await Promise.all([
			this.embed(text1),
			this.embed(text2),
		]);

		return cosineSimilarity(embedding1, embedding2);
	}
}
