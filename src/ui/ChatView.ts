import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client";
import IntelligencePlugin from "../main";
import { VIEW_TYPE_INTELLIGENCE_CHAT } from "../constants";
import ChatViewComponent from "./ChatViewComponent";

export class ChatView extends ItemView {
	plugin: IntelligencePlugin;
	private root: ReactDOM.Root | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: IntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.icon = "messages-square";
	}

	getViewType(): string {
		return VIEW_TYPE_INTELLIGENCE_CHAT;
	}

	getDisplayText(): string {
		return "Intelligence Chat";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();

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
		console.log("Intelligence ChatView closed");
	}
}
