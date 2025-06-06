import React, { useState, useCallback } from "react";
import { App } from "obsidian";
import IntelligencePlugin from "../main";
import { LangChainChatMessage } from "../types";
import { CHATVIEW_WELCOME_MESSAGE } from "../constants";
import { parseFiltersFromPrompt } from "../parser";
import ChatHeader from "./components/ChatHeader";
import { ChatMessages, DisplayMessage } from "./components/ChatMessages";
import ChatControl from "./components/ChatControl";
import { StatusState, AgentStatus } from "./components/StatusMessage";

interface ChatViewProps {
	plugin: IntelligencePlugin;
	app: App;
}

function ChatView({ plugin, app }: ChatViewProps) {
	const [chatHistory, setChatHistory] = useState<LangChainChatMessage[]>([]);
	const [uiMessages, setUiMessages] = useState<DisplayMessage[]>([
		{
			id: crypto.randomUUID(),
			sender: "system",
			text: CHATVIEW_WELCOME_MESSAGE,
			timestamp: new Date(),
		},
		{
			id: crypto.randomUUID(),
			sender: "user",
			text: "What are the main themes in my notes about productivity?",
			timestamp: new Date(Date.now() - 300000), // 5 minutes ago
		},
		{
			id: crypto.randomUUID(),
			sender: "ai",
			text: "Based on your notes about productivity, I've identified several key themes:\n\n## Main Themes\n\n1. **Time Management** - Your notes frequently discuss techniques like the Pomodoro Technique and time blocking\n2. **Focus and Deep Work** - You've written extensively about creating distraction-free environments\n3. **Habit Formation** - Multiple notes cover building sustainable daily routines\n4. **Digital Minimalism** - Several entries explore reducing digital distractions\n\n### Referenced Notes\n- [[Productivity Systems]]\n- [[Deep Work Principles]]\n- [[Morning Routine Optimization]]\n\nWould you like me to elaborate on any of these themes or help you find specific notes on a particular aspect?",
			timestamp: new Date(Date.now() - 240000), // 4 minutes ago
		},
		{
			id: crypto.randomUUID(),
			sender: "user",
			text: "Can you find notes from last week about meeting notes?",
			timestamp: new Date(Date.now() - 180000), // 3 minutes ago
		},
		{
			id: crypto.randomUUID(),
			sender: "ai",
			text: "I found 3 meeting notes from last week:\n\n## Meeting Notes (Last Week)\n\n**1. Team Standup - January 15**\n- Discussed project timeline adjustments\n- Sprint planning for Q1 goals\n- Action items assigned\n\n**2. Client Review - January 17**\n- Feedback on current deliverables\n- Next milestone planning\n- Budget discussion\n\n**3. Strategy Session - January 19**\n- Long-term vision alignment\n- Resource allocation\n- Quarterly objectives\n\n### Quick Links\n- [[Team Standup 2024-01-15]]\n- [[Client Review Meeting 2024-01-17]]\n- [[Q1 Strategy Session 2024-01-19]]\n\nWould you like me to summarize the key points from any specific meeting?",
			timestamp: new Date(Date.now() - 120000), // 2 minutes ago
		},
		{
			id: crypto.randomUUID(),
			sender: "user",
			text: "Show me the action items from the team standup",
			timestamp: new Date(Date.now() - 60000), // 1 minute ago
		},
		{
			id: crypto.randomUUID(),
			sender: "ai",
			text: "Here are the action items from the Team Standup meeting on January 15:\n\n## Action Items\n\n### High Priority\n- [ ] **Sarah**: Complete API documentation by Friday\n- [ ] **Mike**: Review and merge feature branch #247\n- [ ] **Team**: Finalize sprint backlog items (due Wednesday)\n\n### Medium Priority\n- [ ] **Alex**: Update project timeline in Notion\n- [ ] **Sarah**: Schedule client demo for next week\n- [ ] **Mike**: Investigate performance bottleneck in user dashboard\n\n### Follow-up\n- [ ] **All**: Prepare individual progress reports for Friday\n- [ ] **Team Lead**: Send meeting summary to stakeholders\n\n*Last updated: January 15, 2024*\n\nNote: These items were extracted from [[Team Standup 2024-01-15]]. Would you like me to help track the completion status or find related notes?",
			timestamp: new Date(Date.now() - 30000), // 30 seconds ago
		},
	]);
	// The original status state
	const [statusState, setStatusState] = useState<StatusState>({
		status: 'idle',
		message: '',
		isVisible: false
	});

	const setStatus = useCallback((status: AgentStatus, message: string, isVisible = true) => {
		setStatusState({ status, message, isVisible });
	}, []);

	const clearStatus = useCallback(() => {
		setStatusState({ status: 'idle', message: '', isVisible: false });
	}, []);

	const addMessageToDisplay = useCallback(
		(message: { sender: "system" | "user" | "ai"; text: string }) => {
			const newMessage: DisplayMessage = {
				...message,
				id: crypto.randomUUID(),
				timestamp: new Date(),
			};
			setUiMessages((prev) => [...prev, newMessage]);
		},
		[]
	);

	const handleSendMessage = useCallback(
		async (
			rawInputText: string,
			_mode: "agent" | "chat",
			_ragEnabled: boolean
		) => {
			if (!rawInputText.trim()) return;
			// Step 1: Extract semantic query and metadata filters from the input text
			const { semanticQuery, metadataFilters } =
				parseFiltersFromPrompt(rawInputText);
			// Step 2: Add the user message to the display
			addMessageToDisplay({ sender: "user", text: rawInputText });
			// Step 3: Update chat history with the user message
			if (semanticQuery) {
				setChatHistory((prev) => [
					...prev,
					{ type: "human", content: semanticQuery },
				]);
			}
			// Step 4: Set status to thinking
			setStatus('thinking', 'AI is thinking...');
			// Step 5: Process the query with the intelligence service
			try {
				if (!plugin.settings.openAIApiKey) {
					clearStatus();
					addMessageToDisplay({
						sender: "system",
						text: "API Key not set. Please configure it in the plugin settings.",
					});
					return;
				}

				if (
					!plugin.intelligenceService ||
					!plugin.intelligenceService.getIsInitialized()
				) {
					clearStatus();
					addMessageToDisplay({
						sender: "system",
						text: "Intelligence service not initialized. Please wait or try re-initializing from plugin settings.",
					});
					return;
				}

				const historyForChain = semanticQuery
					? chatHistory.slice(0, -1)
					: [...chatHistory];

				// Update status to generating
				setStatus('generating', 'Generating response...');

				const aiResponseText =
					await plugin.intelligenceService.processQueryWithHistory(
						semanticQuery,
						historyForChain,
						metadataFilters
					);

				if (aiResponseText) {
					// Clear status before showing AI response
					clearStatus();
					addMessageToDisplay({
						sender: "ai",
						text: aiResponseText,
					});
					if (semanticQuery) {
						setChatHistory((prev) => [
							...prev,
							{ type: "ai", content: aiResponseText },
						]);
					}
				} else {
					clearStatus();
					addMessageToDisplay({
						sender: "system",
						text: "No specific answer generated.",
					});
				}
			} catch (error: unknown) {
				console.error("Error processing query in ChatView:", error);
				clearStatus();
				addMessageToDisplay({
					sender: "system",
					text: `An error occurred: ${
						error instanceof Error ? error.message : "Unknown error"
					}. Check the console for more details.`,
				});
			}
		},
		[chatHistory, plugin, addMessageToDisplay, setStatus, clearStatus]
	);

	const handleClearChat = useCallback(() => {
		setChatHistory([]);
		clearStatus();
		setUiMessages([
			{
				id: crypto.randomUUID(),
				sender: "system",
				text: "Chat cleared. Ask a new question or type filter keywords.",
				timestamp: new Date(),
			},
		]);
	}, [clearStatus]);

	const handleOpenTools = useCallback(() => {
		// Open plugin settings
		// Note: This would typically be handled by opening the settings modal
		console.log("Opening tools...");
	}, []);
	const handleOpenSettings = useCallback(() => {
		// Open plugin settings
		console.log("Opening settings...");
	}, []);

	return (
		<div className="h-full text-foreground bg-background text-sm">
			<div className="h-full flex flex-col bg-background text-foreground">
				{/* Header */}
				<ChatHeader
					onClearChat={handleClearChat}
					onOpenSettings={handleOpenSettings}
					isProcessing={statusState.isVisible}
				/>

				{/* Messages */}
				<ChatMessages
					messages={uiMessages}
					app={app}
					plugin={plugin}
					statusState={statusState}
				/>

				{/* Chat Control */}
				<div className="mt-2 border-t border-border bg-background">
					<ChatControl
						onSendMessage={handleSendMessage}
						isSending={statusState.isVisible}
						onOpenTools={handleOpenTools}
						app={app}
					/>
				</div>
			</div>
		</div>
	);
}

export default ChatView;
