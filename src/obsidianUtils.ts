// src/obsidianUtils.ts
// Utility functions for interacting with the Obsidian API.

import { App, TFile, Modal, Notice, Setting } from "obsidian";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

/**
 * Initializes a text splitter for chunking documents.
 * @returns An instance of RecursiveCharacterTextSplitter.
 */
function getTextSplitter(): RecursiveCharacterTextSplitter {
	return new RecursiveCharacterTextSplitter({
		chunkSize: 2000, // Aim for chunks of 1000 characters
		chunkOverlap: 200, // Overlap chunks by 200 characters to maintain context
		// separators: ["\n\n", "\n", " ", ""], // Default separators
	});
}

/**
 * Loads all markdown files from the Obsidian vault, splits them into manageable chunks,
 * and returns their content as Langchain Document objects.
 * @param app - The Obsidian App instance.
 * @returns A promise that resolves to an array of Document objects (chunks).
 */
export async function loadVaultDocuments(app: App): Promise<Document[]> {
	const allFiles: TFile[] = app.vault.getFiles();
	const markdownFiles: TFile[] = allFiles.filter(
		(file) => file.extension === "md"
	);
	const allChunks: Document[] = [];
	const splitter = getTextSplitter();

	new Notice(`Found ${markdownFiles.length} markdown files. Starting processing...`, 5000);

	for (let i = 0; i < markdownFiles.length; i++) {
		const file = markdownFiles[i];
		try {
			const content = await app.vault.cachedRead(file);
			
			const preliminaryDoc = new Document({
				pageContent: content,
				metadata: {
					source: file.path,
					fileName: file.name,
					basename: file.basename,
					createdAt: file.stat.ctime,
					modifiedAt: file.stat.mtime,
				},
			});

			const chunks = await splitter.splitDocuments([preliminaryDoc]);
			
			chunks.forEach((chunk, index) => {
				chunk.metadata = {
					...preliminaryDoc.metadata,
					chunkNumber: index + 1,
				};
			});

			allChunks.push(...chunks);

		} catch (error) {
			console.error(`Error reading or splitting file ${file.path}:`, error);
			new Notice(`Skipping file ${file.name} due to processing error.`);
		}
	}
	// new Notice(`Processed ${markdownFiles.length} files into ${allChunks.length} chunks.`, 5000);
	return allChunks;
}

/**
 * A Modal class for getting text input from the user.
 */
class InputModal extends Modal {
	private inputValue: string | null = null;
	private promptText: string;
	private placeholder: string;
	private onSubmit: (result: string | null) => void;

	constructor(app: App, promptText: string, placeholder: string, onSubmit: (result: string | null) => void) {
		super(app);
		this.promptText = promptText;
		this.placeholder = placeholder;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty(); // Clear previous content

		contentEl.createEl("p", { text: this.promptText });

		const inputSetting = new Setting(contentEl)
			.addText((text) => {
				text.setPlaceholder(this.placeholder)
					.onChange((value) => {
						this.inputValue = value;
					});
				// Focus the input field when the modal opens
				text.inputEl.tabIndex = 0; // Make it focusable
				text.inputEl.focus(); // Set focus
				// Handle Enter key press
				text.inputEl.addEventListener('keydown', (evt) => {
					if (evt.key === 'Enter') {
						evt.preventDefault(); // Prevent default Enter behavior (like form submission)
						this.close();
						this.onSubmit(this.inputValue);
					}
				});
			});
		
		// Add a container for buttons
		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

		new Setting(buttonContainer)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
					.setCta() // Makes it a "call to action" button
					.onClick(() => {
						this.close();
						this.onSubmit(this.inputValue);
					}))
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
						this.onSubmit(null); // Pass null if cancelled
					}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}


/**
 * Prompts the user for input using an Obsidian Modal.
 * @param app - The Obsidian App instance.
 * @param promptText - The text to display in the prompt.
 * @param placeholder - Optional placeholder text for the input field.
 * @returns A promise that resolves to the user's input string, or null if cancelled.
 */
export async function showPrompt(app: App, promptText: string, placeholder = "Type here..."): Promise<string | null> {
	return new Promise((resolve) => {
		new InputModal(app, promptText, placeholder, (result) => {
			resolve(result);
		}).open();
	});
}
