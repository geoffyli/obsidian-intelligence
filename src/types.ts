// Shared TypeScript types for the plugin.

/**
 * Interface for the plugin settings.
 * Includes a setting for the OpenAI API key.
 */
export interface IntelligencePluginSettings {
	mySetting: string; // Existing setting
	openAIApiKey: string; // New setting for OpenAI API Key
}

/**
 * Default values for the plugin settings.
 */
export const DEFAULT_SETTINGS: IntelligencePluginSettings = {
	mySetting: "default",
	openAIApiKey: "", // Default to an empty API key
};

/**
 * Represents a message in the chat history for LangChain.
 * 'human' corresponds to 'user', 'ai' to the assistant.
 */
export type LangChainChatMessage = {
	type: "human" | "ai";
	content: string;
};

/**
 * Represents a message displayed in the UI.
 * 'system' messages are for notifications or instructions within the chat UI.
 */
export interface UIMessage {
	sender: "user" | "ai" | "system";
	text: string;
	timestamp?: Date; // Optional: for displaying message times
}

/**
 * Defines the structure for a metadata filter.
 */
export type MetadataField =
	| "modifiedAt"
	| "createdAt"
	| "fileName"
	| "basename"
	| "source";
export type MetadataCondition =
	| "is"
	| ">"
	| ">="
	| "<"
	| "<="
	| "contains"
	| "startsWith"
	| "endsWith"
	| "in";

export interface MetadataFilter {
	// id: string;
	field: MetadataField;
	condition: MetadataCondition;
	value: string;
}
