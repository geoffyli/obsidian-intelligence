import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import ReactDOM from "react-dom/client";
import IntelligencePlugin from "../main";
import { VIEW_TYPE_INTELLIGENCE_CHAT } from "../constants";
import ChatViewComponent from "./ChatViewComponent";
import { SharedState } from "../state/SharedState";
import { Providers } from "../state/contexts";

export class ChatView extends ItemView {
	plugin: IntelligencePlugin;
	private root: ReactDOM.Root | null = null;
	private sharedState: SharedState;
	private eventTarget: EventTarget;

	constructor(leaf: WorkspaceLeaf, plugin: IntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.icon = "messages-square";
		
		// Initialize SharedState
		this.sharedState = new SharedState();
		
		// Create an event target for plugin-wide events
		this.eventTarget = new EventTarget();
		
		// Load persisted state if available
		this.loadPersistedState();
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
			React.createElement(React.StrictMode, {},
				React.createElement(Providers, {
					sharedState: this.sharedState,
					app: this.plugin.app,
					eventTarget: this.eventTarget
				},
					React.createElement(ChatViewComponent, {
						plugin: this.plugin,
						app: this.plugin.app,
					})
				)
			)
		);
	}

	async onClose() {
		// Save state before closing
		this.savePersistedState();
		
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		console.log("Intelligence ChatView closed");
	}

	private async loadPersistedState() {
		try {
			const savedState = await this.plugin.loadData();
			if (savedState?.chatState) {
				this.sharedState.loadState(savedState.chatState);
			}
		} catch (error) {
			console.error("Failed to load persisted state:", error);
		}
	}

	private async savePersistedState() {
		try {
			const currentData = await this.plugin.loadData() || {};
			const stateToSave = {
				...currentData,
				chatState: this.sharedState.saveState()
			};
			await this.plugin.saveData(stateToSave);
		} catch (error) {
			console.error("Failed to save persisted state:", error);
		}
	}

	// Public method to save chat from external sources
	async handleSaveChat() {
		await this.savePersistedState();
	}
}
