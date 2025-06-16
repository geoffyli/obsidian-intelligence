import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import IntelligencePlugin from "../main";

class SettingsTab extends PluginSettingTab {
	plugin: IntelligencePlugin;

	constructor(app: App, plugin: IntelligencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Obsidian Intelligence Settings" });

		// OpenAI API Key Setting
		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc(
				"Enter your OpenAI API key. Changes are saved when you click away (on blur)."
			)
			.addText((text) => {
				text
					.setPlaceholder("sk-...")
					.setValue(
						this.plugin.settings.openAIApiKey || ""
					).inputEl.type = "password";
				text.inputEl.addEventListener("blur", async () => {
					const trimmedKey = text.getValue().trim();
					if (this.plugin.settings.openAIApiKey !== trimmedKey) {
						this.plugin.settings.openAIApiKey = trimmedKey;
						new Notice(
							"OpenAI API Key updated. Reinitializing system..."
						);
						await this.plugin.saveSettings();
						
						// Reinitialize the system with new API key
						if (this.plugin.intelligenceService) {
							await this.plugin.intelligenceService.reInitialize();
						}
					}
				});
			});

		// Info about embedding method
		containerEl.createEl("div", {
			cls: "setting-item-description",
			text: "This plugin uses OpenAI's text-embedding-3-small model for fast, high-quality semantic search. An OpenAI API key is required.",
		});

		// My Original Setting
		new Setting(containerEl)
			.setName("My Original Setting")
			.setDesc(
				"It's a secret (original setting example). Saved on change."
			)
			.addText((text) => {
				text.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting || "")
					// .onChange(async (value) => {
					// 	this.plugin.settings.mySetting = value;
					// 	await this.plugin.saveSettings();
					// });
			});

		containerEl.createEl("div", {
			cls: "mt-6",
			text: "These settings are saved automatically when you change them. The plugin will reinitialize with the new settings.",
		});
	}
}

export default SettingsTab;
