import React, {
	useState,
	useCallback,
} from "react";
import { App } from "obsidian";
import IntelligencePlugin from "../main";
import { LangChainChatMessage } from "../types";
import { CHATVIEW_WELCOME_MESSAGE } from "../constants";
import { parseFiltersFromPrompt } from "../parser";
import ChatHeader from "./components/ChatHeader";
import { ChatMessages, DisplayMessage } from "./components/ChatMessages";
import ChatControl from "./components/ChatControl";

interface ChatViewProps {
	plugin: IntelligencePlugin;
	app: App;
}

const ChatViewComponent: React.FC<ChatViewProps> = ({
	plugin,
	app,
}) => {
	const [chatHistory, setChatHistory] = useState<LangChainChatMessage[]>([]);
	const [uiMessages, setUiMessages] = useState<DisplayMessage[]>([
		{
			id: crypto.randomUUID(),
			sender: "system",
			text: CHATVIEW_WELCOME_MESSAGE,
			timestamp: new Date(),
		},
	]);
	const [isThinking, setIsThinking] = useState(false);

	const addMessageToDisplay = useCallback((message: { sender: "system" | "user" | "ai"; text: string }) => {
		const newMessage: DisplayMessage = {
			...message,
			id: crypto.randomUUID(),
			timestamp: new Date(),
		};
		setUiMessages((prev) => [...prev, newMessage]);
	}, []);

	const handleSendMessage = useCallback(async (
		rawInputText: string,
		mode: "agent" | "chat",
		ragEnabled: boolean
	) => {
		if (!rawInputText.trim()) return;

		const { semanticQuery, metadataFilters } =
			parseFiltersFromPrompt(rawInputText);

		addMessageToDisplay({ sender: "user", text: rawInputText });

		if (semanticQuery) {
			setChatHistory((prev) => [
				...prev,
				{ type: "human", content: semanticQuery },
			]);
		}

		setIsThinking(true);

		try {
			if (!plugin.settings.openAIApiKey) {
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
				addMessageToDisplay({
					sender: "system",
					text: "Intelligence service not initialized. Please wait or try re-initializing from plugin settings.",
				});
				return;
			}

			const historyForChain = semanticQuery
				? chatHistory.slice(0, -1)
				: [...chatHistory];

			const aiResponseText =
				await plugin.intelligenceService.processQueryWithHistory(
					semanticQuery,
					historyForChain,
					metadataFilters
				);

			if (aiResponseText) {
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
				addMessageToDisplay({
					sender: "system",
					text: "No specific answer generated. If you used filters, please check if any notes matched your criteria.",
				});
			}
		} catch (error: unknown) {
			console.error("Error processing query in ChatView:", error);
			addMessageToDisplay({
				sender: "system",
				text: `An error occurred: ${
					error instanceof Error ? error.message : "Unknown error"
				}. Check the console for more details.`,
			});
		} finally {
			setIsThinking(false);
		}
	}, [chatHistory, plugin, addMessageToDisplay]);

	const handleClearChat = useCallback(() => {
		setChatHistory([]);
		setUiMessages([
			{
				id: crypto.randomUUID(),
				sender: "system",
				text: "Chat cleared. Ask a new question or type filter keywords.",
				timestamp: new Date(),
			},
		]);
	}, []);

	const handleOpenSettings = useCallback(() => {
		// Open plugin settings
		// Note: This would typically be handled by opening the settings modal
		console.log("Opening settings...");
	}, []);

	return (
		<div className="h-full text-foreground bg-background text-ui-small">
			<div className="h-full flex flex-col bg-background text-foreground">
				{/* Header */}
				<ChatHeader
					onClearChat={handleClearChat}
					onOpenSettings={handleOpenSettings}
					isProcessing={isThinking}
				/>

				{/* Messages */}
				<ChatMessages
					messages={uiMessages}
					app={app}
					plugin={plugin}
					isThinking={isThinking}
				/>

				{/* Chat Control */}
				<div className="mt-2 border-t border-border bg-background">
					<ChatControl
						onSendMessage={handleSendMessage}
						isSending={isThinking}
						onOpenSettings={handleOpenSettings}
						app={app}
					/>
				</div>
			</div>
		</div>
	);
};

export default ChatViewComponent;
