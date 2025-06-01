import {
	Notice,
	Plugin,
	WorkspaceLeaf,
} from "obsidian";
import { COMMAND_IDS, COMMAND_NAMES, VIEW_TYPE_RAG_CHAT } from "./constants";
import { DEFAULT_SETTINGS } from "./types";
import type { ObsidianRAGPluginSettings } from "./types";
import { RAGSettingsTab } from "./ui/SettingsTab";
import { RAGService } from "./ragService";
import { ChatView } from "./ui/ChatView"; // Import the new ChatView

export default class ObsidianRAGPlugin extends Plugin {
	settings: ObsidianRAGPluginSettings;
	ragService: RAGService;
	private statusBarItemEl: HTMLElement | null = null;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Register the Chat View
		this.registerView(
			VIEW_TYPE_RAG_CHAT,
			(leaf: WorkspaceLeaf) => new ChatView(leaf, this)
		);

		// Add the RAG command
		this.addCommand({
			id: COMMAND_IDS.OPEN_RAG_CHAT,
			name: COMMAND_NAMES["open-rag-chat-view"] || "Open RAG Chat", // Fallback name
			callback: () => this.activateChatView(),
		});

		// Command to re-index/re-initialize the RAG service
		this.addCommand({
			id: COMMAND_IDS.REINDEX_VAULT_RAG || "reindex-vault-rag", // Ensure ID from constants
			name:
				COMMAND_NAMES["reindex-vault-rag"] ||
				"Re-initialize RAG (Re-index Vault)",
			callback: async () => {
				if (!this.settings.openAIApiKey) {
					new Notice(
						"OpenAI API Key is not set. Please configure it in the plugin settings."
					);
					return;
				}
				// Status bar update is handled within reInitialize
				await this.ragService.reInitialize();
			},
		});

		// Initialize RAG Service
		this.ragService = new RAGService(this.app, this.settings);
		this.ragService.setPlugin(this); // Pass plugin instance to RAGService for status bar updates

		// You might want to make this user-triggered or lazy-loaded
		// if initialization is time-consuming or depends on user actions.
		this.updateStatusBar("RAG: Initializing...");
		await this.ragService.initialize();


		// Update Ribbon Icon to open the Chat View
		this.addRibbonIcon(
			"messages-square", // More appropriate icon for chat
			"Open RAG Chat",
			(evt: MouseEvent) => {
				this.activateChatView();
			}
		).addClass("my-plugin-ribbon-class");

		// Initial Status Bar setup (actual text set by RAGService)
		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar("RAG"); // Initial placeholder

		this.addSettingTab(new RAGSettingsTab(this.app, this)); 
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_RAG_CHAT); // Clean up the view
		console.log("Unloading Obsidian RAG plugin");
	}

	// Helper method to activate and reveal the chat view
	async activateChatView() {
		// Check if a view of this type already exists and reveal it
		const existingLeaves =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_RAG_CHAT);
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
				type: VIEW_TYPE_RAG_CHAT,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		} else {
			new Notice(
				"Could not open RAG Chat view: No available leaf in right sidebar."
			);
		}
	}

	// Public method for RAGService to update status bar
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
        if (this.ragService && this.ragService.getIsInitialized()) { // Check if ragService and initialized
            new Notice("Settings saved. RAG service will re-initialize if API key changed or to apply other settings.");
            // Conditionally re-initialize. For now, re-initializing if settings are saved.
            // You might want more granular control here, e.g., only re-initialize if API key changed.
            await this.ragService.reInitialize();
        } else if (this.ragService && !this.ragService.getIsInitialized()) {
            new Notice("Settings saved. RAG service is not yet initialized. It will use new settings on next initialization.");
        } else {
             new Notice("Settings saved.");
        }
    }
}

