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
				text.onBlur(async () => {
					const trimmedKey = text.getValue().trim();
					if (this.plugin.settings.openAIApiKey !== trimmedKey) {
						this.plugin.settings.openAIApiKey = trimmedKey;
						new Notice(
							"OpenAI API Key updated. Saving settings..."
						);
						await this.plugin.saveSettings();
					}
				});
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
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("div", {
			cls: "mt-6",
			text: "These settings are saved automatically when you change them. The plugin will re-initialize with the new settings.",
		});
	}
}

export default SettingsTab;
