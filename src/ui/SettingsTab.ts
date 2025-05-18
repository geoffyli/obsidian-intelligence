// src/ui/SettingsTab.ts
// Defines the settings tab UI for the plugin.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ObsidianRAGPlugin from "../main"; // Adjust path as needed
import { ObsidianRAGPluginSettings } from "../types"; // Adjust path as needed

export class RAGSettingsTab extends PluginSettingTab {
	plugin: ObsidianRAGPlugin;

	constructor(app: App, plugin: ObsidianRAGPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Obsidian RAG Settings" });

		// Setting for the OpenAI API Key
		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Enter your OpenAI API key. Changes are saved when you click away.")
			.addText((text) => {
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openAIApiKey)
					.onChange(async (value) => {
						// Update the setting in memory on each change
						this.plugin.settings.openAIApiKey = value.trim();
						// Do NOT save settings here to avoid re-initializing on every keystroke.
					});
				
				// Add an onblur event listener to save settings when the input field loses focus
				text.inputEl.addEventListener('blur', async () => {
					new Notice("OpenAI API Key updated. Saving settings...");
					await this.plugin.saveSettings(); // This will trigger re-initialization via main.ts
				});
			});
		
		// Existing setting (example)
		new Setting(containerEl)
			.setName("My Original Setting")
			.setDesc("It's a secret (original setting example).")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
