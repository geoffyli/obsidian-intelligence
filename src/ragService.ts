// src/ragService.ts
import { App, Notice, Plugin } from "obsidian";
import { ObsidianRAGPluginSettings, LangChainChatMessage } from "./types";
import { loadVaultDocuments } from "./obsidianUtils";
import {
	getOpenAIEmbeddings,
	getChatOpenAIModel,
	createMemoryVectorStore,
	createConversationalRAGChain, // Updated to use the new conversational chain
} from "./langchainSetup";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Runnable } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages"; // For formatting history
import ObsidianRAGPlugin from "./main"; // Added import for ObsidianRAGPlugin

export class RAGService {
	private app: App;
	private settings: ObsidianRAGPluginSettings;
	private documents: Document[] | null = null; // These are chunks
	private vectorStore: MemoryVectorStore | null = null;
	private chain: Runnable | null = null; // This will be the conversational chain
	private embeddings: OpenAIEmbeddings | null = null;
	private llm: ChatOpenAI | null = null;
	private isInitialized = false;
	private isInitializing = false;

	// A reference to the plugin for status bar updates
	private plugin!: ObsidianRAGPlugin;

	constructor(app: App, settings: ObsidianRAGPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	public setPlugin(plugin: ObsidianRAGPlugin) {
		// This type is now recognized
		this.plugin = plugin;
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
			// 1. Load documents from the vault
			this.documents = await loadVaultDocuments(this.app);
			if (!this.documents || this.documents.length === 0) {
				new Notice(
					"No markdown documents found in the vault to index."
				);
				this.isInitialized = false;
				this.isInitializing = false;
				return;
			}
			if (this.plugin)
				this.plugin.updateStatusBar(
					`RAG: Embedding ${this.documents.length} chunks...`
				);
			// new Notice(
			// 	`Loaded ${this.documents.length} documents. Creating embeddings and vector store...`
			// );
			// console.log(
			// 	`Loaded ${this.documents.length} documents. Creating embeddings and vector store...`
			// );
			
			// 2. Create embeddings and vector store
			this.embeddings = getOpenAIEmbeddings(this.settings);
			this.vectorStore = await createMemoryVectorStore(
				this.documents,
				this.embeddings
			);

			if (this.plugin)
				this.plugin.updateStatusBar("RAG: Initializing chain...");
			// new Notice("Vector store created. Initializing QA chain...");
			// console.log("Vector store created. Initializing QA chain...");

			// 3. Create the conversational RAG chain
			this.llm = getChatOpenAIModel(this.settings); // Using default model
			this.chain = await createConversationalRAGChain(
				this.llm,
				this.vectorStore
			);

			this.isInitialized = true;
			if (this.plugin) this.plugin.updateStatusBar("RAG: Ready");
			new Notice("RAG Service Initialized Successfully!");
			console.log("RAG Service Initialized Successfully!");
		} catch (error) {
			console.error("Error during RAGService initialization:", error);
			new Notice(
				`RAG Initialization Failed: ${error.message}. Check console for details.`
			);
			if (this.plugin) this.plugin.updateStatusBar("RAG: Init Failed");
			this.isInitialized = false;
			this.isInitializing = false;
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Processes a user query using the RAG chain, now considering chat history.
	 * @param query - The user's current question.
	 * @param history - The past conversation messages in LangChainChatMessage format.
	 * @returns A promise that resolves to the answer string, or null if an error occurs.
	 */
	async processQueryWithHistory(
		query: string,
		history: LangChainChatMessage[]
	): Promise<string | null> {
		if (!this.isInitialized || !this.chain) {
			new Notice(
				"RAG Service is not initialized. Please initialize it first or check settings."
			);
			if (this.plugin)
				this.plugin.updateStatusBar("RAG: Not Initialized");
			return null;
		}
		if (!query || query.trim() === "") {
			new Notice("Query cannot be empty.");
			return null;
		}
		if (this.plugin) this.plugin.updateStatusBar("RAG: Thinking...");
		// No Notice here, ChatView handles "Thinking..."

		try {
			// Convert UIMessage history to LangChain's BaseMessage format
			const formattedHistory: BaseMessage[] = history.map((msg) =>
				msg.type === "human"
					? new HumanMessage(msg.content)
					: new AIMessage(msg.content)
			);

			const result = await this.chain.invoke({
				input: query,
				chat_history: formattedHistory,
			});

			if (this.plugin) this.plugin.updateStatusBar("RAG: Ready");
			// The output of the conversational chain (ending with createStuffDocumentsChain)
			// should be the answer string directly.
			if (typeof result === "string") {
				return result;
			} else if (result && typeof (result as any).answer === "string") {
				// Check for common {answer: string} structure
				return (result as any).answer;
			} else {
				console.error(
					"Unexpected RAG chain result format for conversational query:",
					result
				);
				new Notice(
					"Received an unexpected response format from the RAG chain. Expected a string or {answer: string}."
				);
				return null;
			}
		} catch (error) {
			console.error(
				"Error processing query with conversational RAG chain:",
				error
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			new Notice(`Error answering question: ${errorMessage}`);
			if (this.plugin) this.plugin.updateStatusBar("RAG: Error");
			return null;
		}
	}

	// Keep the old processQuery if you still have the simple prompt command,
	// /**
	//  * Processes a user query using the RAG chain.
	//  * @param query - The user's question.
	//  * @returns A promise that resolves to the answer string, or null if an error occurs.
	//  */
	// async processQuery(query: string): Promise<string | null> {
	// 	if (!this.isInitialized || !this.chain) {
	// 		new Notice(
	// 			"RAG Service is not initialized. Please initialize it first or check settings."
	// 		);
	// 		// Optionally, try to initialize it here:
	// 		// await this.initialize();
	// 		// if (!this.isInitialized || !this.chain) return null;
	// 		return null;
	// 	}

	// 	if (!query || query.trim() === "") {
	// 		new Notice("Query cannot be empty.");
	// 		return null;
	// 	}

	// 	new Notice("Processing your query...");
	// 	try {
	// 		// The new createRAGChain expects an object with an 'input' field
	// 		const result = await this.chain.invoke({ input: query });

	// 		// The output structure of createRetrievalChain typically includes an 'answer' field.
	// 		// You might need to inspect the actual 'result' object to confirm its structure.
	// 		if (result && typeof (result as any).answer === "string") {
	// 			return (result as any).answer;
	// 		} else {
	// 			console.error("Unexpected RAG chain result format:", result);
	// 			new Notice(
	// 				"Received an unexpected response format from the RAG chain. Expected an 'answer' field."
	// 			);
	// 			return null;
	// 		}
	// 	} catch (error) {
	// 		console.error("Error processing query with RAG chain:", error);
	// 		new Notice(`Error answering question: ${(error as Error).message}`);
	// 		return null;
	// 	}
	// }

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
		this.plugin.updateStatusBar("RAG: Re-initializing...");
		new Notice("Re-initializing RAG service...");
		await this.initialize(); // This will update status bar on completion/failure
	}

	public getIsInitialized(): boolean {
		return this.isInitialized;
	}
}
