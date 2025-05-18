// src/ragService.ts
// Handles the core Retrieval Augmented Generation (RAG) logic.

import { App, Notice } from "obsidian";
import { ObsidianRAGPluginSettings } from "./types";
import { loadVaultDocuments } from "./obsidianUtils";
import {
	getOpenAIEmbeddings,
	getChatOpenAIModel,
	createMemoryVectorStore,
	createRAGChain,
} from "./langchainSetup";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Runnable } from "@langchain/core/runnables"; // For the chain type

export class RAGService {
	private app: App;
	private settings: ObsidianRAGPluginSettings; // Changed from ObsidianRAGPluginSettings for consistency
	private documents: Document[] | null = null;
	private vectorStore: MemoryVectorStore | null = null;
	private chain: Runnable | null = null; // Updated chain type
	private embeddings: OpenAIEmbeddings | null = null;
	private llm: ChatOpenAI | null = null;
	private isInitialized = false;
	private isInitializing = false;

	constructor(app: App, settings: ObsidianRAGPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Initializes the RAG service by loading documents, creating embeddings,
	 * vector store, and the QA chain.
	 * This should be called before processing queries.
	 * It's designed to be called once, or again if settings/documents change significantly.
	 */
	async initialize(): Promise<void> {
		if (this.isInitializing) {
			new Notice("Initialization is already in progress.");
			console.log("Initialization is already in progress.");
			return;
		}
		if (!this.settings.openAIApiKey) {
			new Notice(
				"OpenAI API Key is not set. Please configure it in the plugin settings."
			);
			this.isInitialized = false;
			return;
		}

		this.isInitializing = true;
		new Notice("Initializing RAG: Loading vault documents...");
		console.log("Initializing RAG: Loading vault documents...");

		try {
			this.documents = await loadVaultDocuments(this.app);
			if (!this.documents || this.documents.length === 0) {
				new Notice(
					"No markdown documents found in the vault to index."
				);
				this.isInitialized = false;
				this.isInitializing = false;
				return;
			}
			new Notice(
				`Loaded ${this.documents.length} documents. Creating embeddings and vector store...`
			);
			console.log(`Loaded ${this.documents.length} documents. Creating embeddings and vector store...`)

			this.embeddings = getOpenAIEmbeddings(this.settings);
			this.vectorStore = await createMemoryVectorStore(
				this.documents,
				this.embeddings
			);
			new Notice("Vector store created. Initializing QA chain...");
			console.log("Vector store created. Initializing QA chain...");

			this.llm = getChatOpenAIModel(this.settings); // Using default model
			// Call the updated createRAGChain function
			this.chain = await createRAGChain(this.llm, this.vectorStore);

			this.isInitialized = true;
			this.isInitializing = false;
			new Notice("RAG Service Initialized Successfully!");
			console.log("RAG Service Initialized Successfully!");
		} catch (error) {
			console.error("Error during RAGService initialization:", error);
			new Notice(
				`RAG Initialization Failed: ${error.message}. Check console for details.`
			);
			this.isInitialized = false;
			this.isInitializing = false;
		}
	}

	/**
	 * Processes a user query using the RAG chain.
	 * @param query - The user's question.
	 * @returns A promise that resolves to the answer string, or null if an error occurs.
	 */
	async processQuery(query: string): Promise<string | null> {
		if (!this.isInitialized || !this.chain) {
			new Notice(
				"RAG Service is not initialized. Please initialize it first or check settings."
			);
			// Optionally, try to initialize it here:
			// await this.initialize();
			// if (!this.isInitialized || !this.chain) return null;
			return null;
		}

		if (!query || query.trim() === "") {
			new Notice("Query cannot be empty.");
			return null;
		}

		new Notice("Processing your query...");
		try {
			// The new createRAGChain expects an object with an 'input' field
			const result = await this.chain.invoke({ input: query });

			// The output structure of createRetrievalChain typically includes an 'answer' field.
			// You might need to inspect the actual 'result' object to confirm its structure.
			if (result && typeof (result as any).answer === "string") {
				return (result as any).answer;
			} else {
				console.error("Unexpected RAG chain result format:", result);
				new Notice(
					"Received an unexpected response format from the RAG chain. Expected an 'answer' field."
				);
				return null;
			}
		} catch (error) {
			console.error("Error processing query with RAG chain:", error);
			new Notice(`Error answering question: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Re-initializes the RAG service. Useful if vault content or settings change.
	 */
	async reInitialize(): Promise<void> {
		this.isInitialized = false;
		this.documents = null;
		this.vectorStore = null;
		this.chain = null;
		this.embeddings = null;
		this.llm = null;
		new Notice("Re-initializing RAG service...");
		await this.initialize();
	}

	public getIsInitialized(): boolean {
		return this.isInitialized;
	}
}
