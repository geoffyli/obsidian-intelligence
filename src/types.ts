// Shared TypeScript types for the plugin.

/**
 * Interface for the plugin settings.
 * Includes a setting for the OpenAI API key.
 */
export interface ObsidianRAGPluginSettings {
	mySetting: string; // Existing setting
	openAIApiKey: string; // New setting for OpenAI API Key
}

/**
 * Default values for the plugin settings.
 */
export const DEFAULT_SETTINGS: ObsidianRAGPluginSettings = {
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
