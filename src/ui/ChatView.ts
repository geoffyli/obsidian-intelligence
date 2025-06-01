import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client";
import ObsidianRAGPlugin from "../main";
import { VIEW_TYPE_RAG_CHAT } from "../constants";
import ChatViewComponent from "./ChatViewComponent";

export class ChatView extends ItemView {
  plugin: ObsidianRAGPlugin;
  private root: ReactDOM.Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianRAGPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "messages-square";
  }

  getViewType(): string {
    return VIEW_TYPE_RAG_CHAT;
  }

  getDisplayText(): string {
    return "RAG Chat";
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("rag-chat-view-container");

    this.root = ReactDOM.createRoot(container);
    this.root.render(
      React.createElement(ChatViewComponent, {
        plugin: this.plugin,
        app: this.plugin.app,
      })
    );
  }

  async onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    console.log("RAG ChatView closed");
  }
}
