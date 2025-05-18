import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { COMMAND_IDS, COMMAND_NAMES, CommandId } from "./constants";
import { ObsidianRAGPluginSettings, DEFAULT_SETTINGS } from "./types";
import { RAGSettingsTab } from "./ui/SettingsTab";
import { RAGService } from "./ragService";
import { showPrompt } from "./obsidianUtils"; // For prompting user

export default class ObsidianRAGPlugin extends Plugin {
	settings: ObsidianRAGPluginSettings;
	ragService: RAGService;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Initialize RAG Service
		this.ragService = new RAGService(this.app, this.settings);
		// You might want to make this user-triggered or lazy-loaded
		// if initialization is time-consuming or depends on user actions.
		await this.ragService.initialize();

		// Add the RAG command
		this.addCommand({
			id: COMMAND_IDS.CHAT_WITH_VAULT,
			name: COMMAND_NAMES["chat-with-vault-rag"],
			callback: async () => {
				if (!this.settings.openAIApiKey) {
					new Notice(
						"OpenAI API Key is not set. Please configure it in the plugin settings."
					);
					return;
				}

				if (!this.ragService.getIsInitialized()) {
					new Notice("RAG service is not ready. Trying to initialize...");
					await this.ragService.initialize();
					if (!this.ragService.getIsInitialized()){
						new Notice("RAG Service could not be initialized. Please check settings and console logs.");
						return;
					}
				}

				const question = await showPrompt(this.app, "Ask your vault:");
				if (!question) {
					new Notice("Query cancelled.");
					return;
				}

				const answer = await this.ragService.processQuery(question);
				if (answer) {
					// Displaying answer in a notice. For longer answers, consider a modal or new pane.
					new Notice(answer, 15000); // Show notice for 15 seconds
				} else {
					new Notice("Could not retrieve an answer. Check console for details.");
				}
			},
		
		});

		// Command to re-index/re-initialize the RAG service
		this.addCommand({
			id: "reindex-vault-rag",
			name: "Re-initialize RAG (Re-index Vault)",
			callback: async () => {
				if (!this.settings.openAIApiKey) {
					new Notice(
						"OpenAI API Key is not set. Please configure it in the plugin settings."
					);
					return;
				}
				await this.ragService.reInitialize();
			}
		})



		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"brain-cog",
			"Obsidian RAG Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("Obsidian RAG Plugin is active!");
			}
		);
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("RAG Ready"); // Or dynamically update based on RAGService state

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RAGSettingsTab(this.app, this));

		// ---

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {
		console.log("Unloading Obsidian RAG plugin");
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
		// If settings relevant to RAGService change (like API key), re-initialize.
		if (this.ragService) {
			// A more sophisticated check might be needed if only certain settings trigger re-init
			new Notice("Settings saved. RAG service will re-initialize if necessary.");
			await this.ragService.reInitialize();
		}	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
