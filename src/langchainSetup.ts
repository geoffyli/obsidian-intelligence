// src/langchainSetup.ts
// Configures and initializes LangChain components.

import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
// Import for the new approach to create a retrieval chain
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables"; // For type hint
import { ObsidianRAGPluginSettings } from "./types";
import {ChatModels} from "./constants";

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
		temperature: 0.5, 
	});
}

/**
 * Creates a MemoryVectorStore from an array of Documents.
 * @param documents - An array of Langchain Document objects.
 * @param embeddings - An instance of OpenAIEmbeddings.
 * @returns A promise that resolves to an instance of MemoryVectorStore.
 */
export async function createMemoryVectorStore(
	documents: Document[],
	embeddings: OpenAIEmbeddings
): Promise<MemoryVectorStore> {
	if (documents.length === 0) {
		console.warn(
			"No documents found to create vector store. The RAG chain might not find relevant context."
		);
	}
	return MemoryVectorStore.fromDocuments(documents, embeddings);
}

/**
 * Creates a RAG (Retrieval Augmented Generation) chain.
 * This chain first retrieves relevant documents from the vector store based on the input,
 * then combines these documents with the original input to generate an answer using an LLM.
 * @param llm - An instance of a Langchain LLM (e.g., ChatOpenAI).
 * @param vectorStore - An instance of a Langchain VectorStore (e.g., MemoryVectorStore).
 * @returns A Runnable sequence representing the RAG chain. The output of this chain
 * will typically be an object containing the `answer` and `context` (retrieved documents).
 */
export async function createRAGChain(
	llm: ChatOpenAI,
	vectorStore: MemoryVectorStore
): Promise<Runnable> {
	// The return type is more general, often a RunnableSequence
	// Define a prompt template for answering questions based on retrieved context
	const prompt = ChatPromptTemplate.fromTemplate(
		`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`
	);

	// Create a chain that combines the retrieved documents into a string
	// and then passes them to the LLM with the prompt.
	const documentChain = await createStuffDocumentsChain({
		llm: llm,
		prompt: prompt,
	});

	// Create a retriever from the vector store
	const retriever = vectorStore.asRetriever();

	// Create the retrieval chain that first retrieves documents and then
	// passes them to the documentChain.
	const retrievalChain = await createRetrievalChain({
		combineDocsChain: documentChain,
		retriever: retriever,
	});

	return retrievalChain;
	// For conversational context (chat history), you would use createHistoryAwareRetriever
	// and then combine it with the document chain.
	// Example:
	// import { MessagesPlaceholder } from "@langchain/core/prompts";
	// import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
	// const historyAwarePrompt = ChatPromptTemplate.fromMessages([
	// 	new MessagesPlaceholder("chat_history"),
	// 	["user", "{input}"],
	// 	["user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"]
	// ]);
	// const historyAwareRetrieverChain = await createHistoryAwareRetriever({
	// 	llm,
	// 	retriever,
	// 	rephrasePrompt: historyAwarePrompt
	// });
	// And then chain historyAwareRetrieverChain with documentChain.
}
