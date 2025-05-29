import { App, PluginSettingTab } from "obsidian";
import ObsidianRAGPlugin from "../main";
import SettingsTabComponent from "./SettingsTab.svelte";
// Svelte 4 uses component constructor for mounting

export class RAGSettingsTab extends PluginSettingTab {
	plugin: ObsidianRAGPlugin;
	private svelteComponent: SettingsTabComponent | null = null;

	constructor(app: App, plugin: ObsidianRAGPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		// Clear any existing content
		containerEl.empty();

        // Defensive check: Ensure plugin and settings are available
        if (!this.plugin) {
            console.error("RAGSettingsTab Error: Plugin instance is not available.");
            containerEl.setText("Error: RAG Plugin instance is not available. Cannot display settings.");
            return;
        }

        if (!this.plugin.settings) {
            console.error("RAGSettingsTab Error: Plugin settings are not loaded.");
            // Optionally, try to load settings again or show an error
            // await this.plugin.loadSettings(); // Be careful with async operations directly in display if not handled well
            // if (!this.plugin.settings) {
            containerEl.setText("Error: RAG Plugin settings are not loaded. Please try reloading the plugin.");
            return;
            // }
        }
		
		// Mount the Svelte 4 component
		this.svelteComponent = new SettingsTabComponent({
			target: containerEl,
			props: {
				plugin: this.plugin,
			},
		});
	}

	// Optional: If you need to explicitly destroy the Svelte component when the tab is hidden/closed
	// This is good practice for preventing memory leaks, though Svelte is often good at cleanup.
	hide(): void {
		if (this.svelteComponent) {
			// In Svelte 4, use $destroy method to clean up
			this.svelteComponent.$destroy();
			this.svelteComponent = null;
		}
		// containerEl is automatically emptied by Obsidian when the tab is re-displayed or closed.
	}
}
