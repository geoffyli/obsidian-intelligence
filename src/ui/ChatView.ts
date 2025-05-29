// src/ui/ChatView.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import ObsidianRAGPlugin from "../main";
import { VIEW_TYPE_RAG_CHAT } from "../constants";
import ChatViewComponent from "./ChatView.svelte";

export class ChatView extends ItemView {
	plugin: ObsidianRAGPlugin;
	private svelteComponent: ChatViewComponent | null = null;

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

		// @ts-ignore
		this.svelteComponent = new ChatViewComponent({
			target: container,
			props: {
				plugin: this.plugin,
				app: this.plugin.app,
			},
		});
	}

	async onClose() {
		// Clean up the Svelte component
		if (this.svelteComponent) {
			this.svelteComponent = null;
		}
		console.log("RAG ChatView closed");
	}
}
