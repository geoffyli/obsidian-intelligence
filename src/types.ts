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
