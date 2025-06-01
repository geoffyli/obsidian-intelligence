import { App, PluginSettingTab } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client";
import ObsidianRAGPlugin from "../main";
import SettingsTabComponent from "./SettingsTabComponent";

export class RAGSettingsTab extends PluginSettingTab {
  plugin: ObsidianRAGPlugin;
  private root: ReactDOM.Root | null = null;

  constructor(app: App, plugin: ObsidianRAGPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    if (!this.plugin) {
      console.error("RAGSettingsTab Error: Plugin instance is not available.");
      containerEl.setText("Error: RAG Plugin instance is not available. Cannot display settings.");
      return;
    }

    if (!this.plugin.settings) {
      console.error("RAGSettingsTab Error: Plugin settings are not loaded.");
      containerEl.setText("Error: RAG Plugin settings are not loaded. Please try reloading the plugin.");
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
