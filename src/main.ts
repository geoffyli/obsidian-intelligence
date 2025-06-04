import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
	COMMAND_IDS,
	COMMAND_NAMES,
	VIEW_TYPE_INTELLIGENCE_CHAT,
} from "./constants";
import { DEFAULT_SETTINGS } from "./types";
import type { IntelligencePluginSettings } from "./types";
import { IntelligenceService } from "./intelligenceService";
import React from "react";
import ReactDOM from "react-dom/client";
import { ItemView } from "obsidian";
import ChatViewComponent from "./ui/ChatView";
import { SharedState } from "./state/SharedState";
import { Providers } from "./state/contexts";
import SettingsTab from "./ui/SettingsTab";

export default class IntelligencePlugin extends Plugin {
	// Fix: Add definite assignment assertions to class properties
	settings!: IntelligencePluginSettings;
	intelligenceService!: IntelligenceService;
	private statusBarItemEl: HTMLElement | null = null;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Register the Chat View
		this.registerView(
			VIEW_TYPE_INTELLIGENCE_CHAT,
			(leaf: WorkspaceLeaf) => new ChatView(leaf, this)
		);

		this.addCommand({
			id: COMMAND_IDS.OPEN_INTELLIGENCE_CHAT,
			name:
				COMMAND_NAMES["open-intelligence-chat-view"] ||
				"Open Intelligence Chat", // Fallback name
			callback: () => this.activateChatView(),
		});

		// Command to reindex/re-initialize the Intelligence service
		this.addCommand({
			id:
				COMMAND_IDS.REINDEX_VAULT_INTELLIGENCE ||
				"reindex-vault-intelligence", // Ensure ID from constants
			name:
				COMMAND_NAMES["reindex-vault-intelligence"] ||
				"Reinitialize Intelligence (Reindex Vault)",
			callback: async () => {
				if (!this.settings.openAIApiKey) {
					new Notice(
						"OpenAI API Key is not set. Please configure it in the plugin settings."
					);
					return;
				}
				// Status bar update is handled within reInitialize
				await this.intelligenceService.reInitialize();
			},
		});

		// Initialize Inteliigence Service
		this.intelligenceService = new IntelligenceService(
			this.app,
			this.settings
		);
		this.intelligenceService.setPlugin(this); // Pass plugin instance to IntelligenceService for status bar updates

		// You might want to make this user-triggered or lazy-loaded
		// if initialization is time-consuming or depends on user actions.
		this.updateStatusBar("Intelligence: Initializing...");
		await this.intelligenceService.initialize();

		// Update Ribbon Icon to open the Chat View
		// Fix: Remove unused parameter 'evt' in addRibbonIcon callback
		this.addRibbonIcon("messages-square", "Open Intelligence Chat", () => {
			this.activateChatView();
		}).addClass("my-plugin-ribbon-class");

		// Initial Status Bar setup (actual text set by IntelligenceService)
		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar("Intelligence"); // Initial placeholder

		// In onload(), register the settings tab using the new SettingsTab class
		this.addSettingTab(new SettingsTab(this.app, this));

		//debugging: Activate the chat view on load
		await this.activateChatView(); // Uncomment to auto-open chat view on plugin load
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_INTELLIGENCE_CHAT); // Clean up the view
		console.log("Unloading Obsidian Intelligence");
	}

	// Helper method to activate and reveal the chat view
	async activateChatView() {
		// Check if a view of this type already exists and reveal it
		const existingLeaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_INTELLIGENCE_CHAT
		);
		if (existingLeaves.length > 0) {
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// If not, create a new leaf in the right sidebar (or preferred location)
		// const leaf = this.app.workspace.getRightLeaf(false);
		// Get a new leaf in the main workspace area
		const leaf = this.app.workspace.getLeaf(true); // true to create a new leaf if none exists
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_INTELLIGENCE_CHAT,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		} else {
			new Notice(
				"Could not open Intelligence Chat view: No available leaf in right sidebar."
			);
		}
	}

	// Public method for IntelligenceService to update status bar
	public updateStatusBar(text: string) {
		if (this.statusBarItemEl) {
			this.statusBarItemEl.setText(text);
		} else {
			// If called before status bar is initialized (e.g. very early error)
			console.log("Status Bar Update:", text);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (
			this.intelligenceService &&
			this.intelligenceService.getIsInitialized()
		) {
			// Check if intelligenceService and initialized
			new Notice(
				"Settings saved. Intelligence service will re-initialize if API key changed or to apply other settings."
			);
			// Conditionally re-initialize. For now, re-initializing if settings are saved.
			// You might want more granular control here, e.g., only re-initialize if API key changed.
			await this.intelligenceService.reInitialize();
		} else if (
			this.intelligenceService &&
			!this.intelligenceService.getIsInitialized()
		) {
			new Notice(
				"Settings saved. Intelligence service is not yet initialized. It will use new settings on next initialization."
			);
		} else {
			new Notice("Settings saved.");
		}
	}
}

// --- Begin: ChatView (moved from ChatView.ts) ---
export class ChatView extends ItemView {
	plugin: IntelligencePlugin;
	private root: ReactDOM.Root | null = null;
	private sharedState: SharedState;
	private eventTarget: EventTarget;

	constructor(leaf: WorkspaceLeaf, plugin: IntelligencePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.icon = "messages-square";
		this.sharedState = new SharedState();
		this.eventTarget = new EventTarget();
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
		// Fix: Add children prop to Providers in ChatView
		this.root.render(
			React.createElement(
				React.StrictMode,
				{},
				React.createElement(Providers, {
					sharedState: this.sharedState,
					app: this.plugin.app,
					eventTarget: this.eventTarget,
					children: React.createElement(ChatViewComponent, {
						plugin: this.plugin,
						app: this.plugin.app,
					}),
				})
			)
		);
	}

	async onClose() {
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
			const currentData = (await this.plugin.loadData()) || {};
			const stateToSave = {
				...currentData,
				chatState: this.sharedState.saveState(),
			};
			await this.plugin.saveData(stateToSave);
		} catch (error) {
			console.error("Failed to save persisted state:", error);
		}
	}

	async handleSaveChat() {
		await this.savePersistedState();
	}
}
// --- End: ChatView ---
