// src/ui/ChatView.ts
import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import ObsidianRAGPlugin from "../main";
import { VIEW_TYPE_RAG_CHAT } from "../constants";
import { UIMessage, LangChainChatMessage } from "../types";

export class ChatView extends ItemView {
    plugin: ObsidianRAGPlugin;
    private messagesContainer!: HTMLDivElement;
    private inputArea!: HTMLTextAreaElement;
    private sendButton!: HTMLButtonElement;
    private thinkingIndicator!: HTMLDivElement;
    private clearChatButton!: HTMLButtonElement;


    private chatHistory: LangChainChatMessage[] = []; // Stores history for LangChain

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianRAGPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.icon = "messages-square"; // Set icon for the view tab
    }

    getViewType(): string {
        return VIEW_TYPE_RAG_CHAT;
    }

    getDisplayText(): string {
        return "RAG Chat";
    }

    // getIcon(): string { // Already set in constructor
    //     return "messages-square"; 
    // }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass("rag-chat-view-container");

        // Header for controls like clear chat
        const headerControls = container.createDiv({cls: "rag-chat-header-controls"});
        this.clearChatButton = headerControls.createEl("button", {
            text: "Clear Chat",
            cls: "rag-chat-clear-button"
        });
        this.clearChatButton.addEventListener("click", this.handleClearChat.bind(this));


        // Messages display area
        this.messagesContainer = container.createDiv({ cls: "rag-messages-container" });

        // Thinking indicator
        this.thinkingIndicator = container.createDiv({ cls: "rag-thinking-indicator"});
        this.thinkingIndicator.style.display = "none"; // Initially hidden
        const thinkingText = this.thinkingIndicator.createSpan();
        thinkingText.setText("AI is thinking...");
        // Optional: Add a simple spinner or animation here later

        // Input area
        const inputWrapper = container.createDiv({ cls: "rag-input-wrapper" });
        this.inputArea = inputWrapper.createEl("textarea", {
            cls: "rag-chat-input",
            attr: { placeholder: "Ask your vault..." },
        });
        this.sendButton = inputWrapper.createEl("button", {
            text: "Send",
            cls: "rag-chat-send-button",
        });

        // Event listeners
        this.sendButton.addEventListener("click", this.handleSendMessage.bind(this));
        this.inputArea.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                this.handleSendMessage();
            }
        });

        // Initial welcome message
        this.addMessageToDisplay({ sender: "system", text: "Welcome to RAG Chat! Ask questions about your vault. Type your query below." });
    }

    private async addMessageToDisplay(message: UIMessage, isStreaming = false) {
        const messageElWrapper = this.messagesContainer.createDiv({
            cls: `rag-message-wrapper rag-message-wrapper-${message.sender}`,
        });

        // Optional: Add sender icon or name
        // if (message.sender === 'ai' || message.sender === 'user') {
        //     messageElWrapper.createDiv({cls: `rag-sender-label ${message.sender}-label`, text: message.sender === 'ai' ? 'AI' : 'You'});
        // }

        const messageEl = messageElWrapper.createDiv({
            cls: `rag-message rag-message-${message.sender}`,
        });

        // Use MarkdownRenderer for better formatting, including code blocks and lists
        // For streaming, we might update this element's content directly.
        await MarkdownRenderer.render(this.app, message.text, messageEl, this.plugin.manifest.dir || "", this);


        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        return messageEl; // Return for potential streaming updates
    }
    
    private handleClearChat() {
        this.chatHistory = [];
        this.messagesContainer.empty(); // Clear displayed messages
        this.addMessageToDisplay({ sender: "system", text: "Chat cleared. Ask a new question!" });
        new Notice("Chat history cleared.");
    }


    private async handleSendMessage() {
        const inputText = this.inputArea.value.trim();
        if (!inputText) return;

        // Add user message to UI and history
        this.addMessageToDisplay({ sender: "user", text: inputText });
        this.chatHistory.push({ type: "human", content: inputText });
        this.inputArea.value = ""; // Clear input
        this.inputArea.focus();

        // Show thinking indicator and disable input
        this.thinkingIndicator.style.display = "flex"; // Use flex for centering if styled
        this.sendButton.disabled = true;
        this.inputArea.disabled = true;

        try {
            if (!this.plugin.settings.openAIApiKey) {
                this.addMessageToDisplay({ sender: "system", text: "OpenAI API Key is not set. Please configure it in the plugin settings." });
                return;
            }
            if (!this.plugin.ragService.getIsInitialized()) {
                 this.addMessageToDisplay({ sender: "system", text: "RAG service is not ready. Attempting to initialize..." });
                await this.plugin.ragService.initialize();
                if (!this.plugin.ragService.getIsInitialized()) {
                    this.addMessageToDisplay({ sender: "system", text: "RAG Service could not be initialized. Please check settings and console."});
                    return;
                }
                 this.addMessageToDisplay({ sender: "system", text: "RAG service initialized. Ready to chat." });
            }

            // Pass history *before* current user message
            const historyForChain = this.chatHistory.slice(0, -1); 

            const aiResponseText = await this.plugin.ragService.processQueryWithHistory(
                inputText,
                historyForChain 
            );

            if (aiResponseText) {
                this.addMessageToDisplay({ sender: "ai", text: aiResponseText });
                this.chatHistory.push({ type: "ai", content: aiResponseText });
            } else {
                this.addMessageToDisplay({ sender: "system", text: "Sorry, I couldn't retrieve an answer. The RAG chain might not have found relevant context or an error occurred." });
            }
        } catch (error) {
            console.error("Error processing RAG query in ChatView:", error);
            this.addMessageToDisplay({ sender: "system", text: `Error: ${(error as Error).message}` });
        } finally {
            this.thinkingIndicator.style.display = "none";
            this.sendButton.disabled = false;
            this.inputArea.disabled = false;
            this.inputArea.focus();
        }
    }

    async onClose() {
        // Perform any cleanup if necessary
        console.log("RAG ChatView closed");
    }
}
