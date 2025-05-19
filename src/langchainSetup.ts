// src/langchainSetup.ts
// Configures and initializes LangChain components.

import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
// Import for the new approach to create a retrieval chain
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts";
import { Runnable, RunnableSequence } from "@langchain/core/runnables"; // For type hint
import { ObsidianRAGPluginSettings, LangChainChatMessage } from "./types";
import {
	ChatModels,
	TEMPATURE,
	DEFAULT_DOC_FETCHED,
	ANSWER_GENERATION_PROMPT,
	QUERY_GENERATION_PROMPT,
} from "./constants";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { Notice } from "obsidian";

/**
 * Initializes OpenAI Embeddings.
 * @param settings - Plugin settings containing the API key.
 * @returns An instance of OpenAIEmbeddings.
 * @throws Error if API key is missing.
 */
export function getOpenAIEmbeddings(
	settings: ObsidianRAGPluginSettings
): OpenAIEmbeddings {
	if (!settings.openAIApiKey) {
		throw new Error("OpenAI API Key is not set in plugin settings.");
	}
	return new OpenAIEmbeddings({ openAIApiKey: settings.openAIApiKey });
}

/**
 * Initializes the ChatOpenAI model.
 * @param settings - Plugin settings containing the API key.
 * @param modelName - The name of the OpenAI model to use (e.g., "gpt-3.5-turbo", "gpt-4o-mini").
 * @returns An instance of ChatOpenAI.
 * @throws Error if API key is missing.
 */
export function getChatOpenAIModel(
	settings: ObsidianRAGPluginSettings,
	modelName = ChatModels.GPT_41
): ChatOpenAI {
	if (!settings.openAIApiKey) {
		throw new Error("OpenAI API Key is not set in plugin settings.");
	}
	return new ChatOpenAI({
		openAIApiKey: settings.openAIApiKey,
		modelName: modelName,
		temperature: TEMPATURE,
	});
}

/**
 * Creates a MemoryVectorStore from an array of Documents.
 * @param documents - An array of Langchain Document objects.
 * @param embeddings - An instance of OpenAIEmbeddings.
 * @returns A promise that resolves to an instance of MemoryVectorStore.
 */
export async function createMemoryVectorStore(
	documents: Document[], // These are expected to be pre-split chunks
	embeddings: OpenAIEmbeddings
): Promise<MemoryVectorStore> {
	if (documents.length === 0) {
		console.warn(
			"No documents found to create vector store. The relevant context might not found."
		);
		return new MemoryVectorStore(embeddings); // Return an empty vector store
	}
	// new Notice(
	// 	`Creating vector store from ${documents.length} document chunks... This may take a moment.`,
	// 	10000
	// );
	const vectorStore = await MemoryVectorStore.fromDocuments(
		documents,
		embeddings
	);
	new Notice(
		`Vector store created successfully from ${documents.length} chunks.`,
		5000
	);
	return vectorStore;
}

/**
 * Creates a Conversational RAG chain.
 * It first uses chat history to rephrase the follow-up question, then retrieves documents,
 * and finally generates an answer based on the retrieved context and original question.
 * @param llm - An instance of ChatOpenAI.
 * @param vectorStore - An instance of MemoryVectorStore.
 * @param retrieverK - Optional number of document chunks the retriever should fetch.
 * @returns A Runnable sequence for conversational RAG.
 */
export async function createConversationalRAGChain(
	llm: ChatOpenAI,
	vectorStore: MemoryVectorStore,
	retrieverK?: number
): Promise<Runnable> {
	// Create a retriever from the vector store
	const retriever = vectorStore.asRetriever({
		k: retrieverK ?? DEFAULT_DOC_FETCHED,
	}); // Default to 5 docs if not specified

	// Prompt for rephrasing the question based on history
	const queryGenerationPrompt = ChatPromptTemplate.fromMessages([
		new MessagesPlaceholder("chat_history"),
		["user", "{input}"],
		["user", QUERY_GENERATION_PROMPT],
	]);

	// Create a retriever that's aware of the chat history
	const historyAwareRetriever = await createHistoryAwareRetriever({
		llm,
		retriever,
		rephrasePrompt: queryGenerationPrompt,
	});

	// Prompt for answering the question based on retrieved context and history
	const answerGenerationPrompt = ChatPromptTemplate.fromMessages([
		["system", ANSWER_GENERATION_PROMPT],
		new MessagesPlaceholder("chat_history"), // Include history for the LLM to maintain conversational flow
		["user", "{input}"], // The original user input
	]);

	// Chain to combine documents and generate an answer
	const documentChain = await createStuffDocumentsChain({
		llm,
		prompt: answerGenerationPrompt,
	});

	// The full conversational RAG chain
	const conversationalRetrievalChain = RunnableSequence.from([
		// Step 1: Prepare the input for the parallel processing step.
		// This step receives the initial {input, chat_history} from the chain's invocation.
		(initialInput: { input: string; chat_history: BaseMessage[] }) => {
			return {
				input: initialInput.input,
				chat_history: initialInput.chat_history,
				// The historyAwareRetriever also needs input and chat_history,
				// so we pass them along for it to use.
			};
		},
		// Step 2: Run historyAwareRetriever for context, and pass through input and chat_history.
		// The output of this step: { context: Document[], input: string, chat_history: BaseMessage[] }
		{
			context: historyAwareRetriever, // historyAwareRetriever consumes {input, chat_history} from the previous step's output
			input: (previousOutput: {
				input: string;
				chat_history: BaseMessage[];
			}) => previousOutput.input,
			chat_history: (previousOutput: {
				input: string;
				chat_history: BaseMessage[];
			}) => previousOutput.chat_history,
		},
		// Step 3: documentChain consumes the output of Step 2.
		documentChain,
	]);

	return conversationalRetrievalChain;
}
