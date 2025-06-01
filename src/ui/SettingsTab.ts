import { App, PluginSettingTab } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client";
import IntelligencePlugin from "../main";
import SettingsTabComponent from "./SettingsTabComponent";

export class IntelligenceSettingsTab extends PluginSettingTab {
	plugin: IntelligencePlugin;
	private root: ReactDOM.Root | null = null;

	constructor(app: App, plugin: IntelligencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		if (!this.plugin) {
			console.error(
				"IntelligenceSettingsTab Error: Plugin instance is not available."
			);
			containerEl.setText(
				"Error: Intelligence Plugin instance is not available. Cannot display settings."
			);
			return;
		}

		if (!this.plugin.settings) {
			console.error(
				"IntelligenceSettingsTab Error: Plugin settings are not loaded."
			);
			containerEl.setText(
				"Error: Intelligence Plugin settings are not loaded. Please try reloading the plugin."
			);
			return;
		}

		this.root = ReactDOM.createRoot(containerEl);
		this.root.render(
			React.createElement(SettingsTabComponent, {
				plugin: this.plugin,
			})
		);
	}

	hide(): void {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}
}
