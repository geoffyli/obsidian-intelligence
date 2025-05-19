// import { CustomModel } from "@/aiParams";
// import { DEFAULT_INLINE_EDIT_COMMANDS } from "@/commands/constants";
// import { type CopilotSettings } from "@/settings/model";
import { v4 as uuidv4 } from "uuid";
// import { ChainType } from "./chainFactory";

export const BREVILABS_API_BASE_URL = "https://api.brevilabs.com/v1";
export const USER_SENDER = "user";
export const AI_SENDER = "ai";
export const DEFAULT_SYSTEM_PROMPT = `You are Obsidian Copilot, a helpful assistant that integrates AI to Obsidian note-taking.
  1. Never mention that you do not have access to something. Always rely on the user provided context.
  2. Always answer to the best of your knowledge. If you are unsure about something, say so and ask the user to provide more context.
  3. If the user mentions "note", it most likely means an Obsidian note in the vault, not the generic meaning of a note.
  4. If the user mentions "@vault", it means the user wants you to search the Obsidian vault for information relevant to the query. The search results will be provided to you in the context along with the user query, read it carefully and answer the question based on the information provided. If there's no relevant information in the vault, just say so.
  5. If the user mentions any other tool with the @ symbol, check the context for their results. If nothing is found, just ignore the @ symbol in the query.
  6. Always use $'s instead of \\[ etc. for LaTeX equations.
  7. When showing note titles, use [[title]] format and do not wrap them in \` \`.
  8. When showing **Obsidian internal** image links, use ![[link]] format and do not wrap them in \` \`.
  9. When showing **web** image links, use ![link](url) format and do not wrap them in \` \`.
  10. When generating a table, use compact formatting without excessive whitespace.
  11. Always respond in the language of the user's query.
  12. Do NOT mention the additional context provided such as getCurrentTime and getTimeRangeMs if it's irrelevant to the user message.`;

export const QUERY_GENERATION_PROMPT = `Given the above conversation, generate a search query to look up in order to get information relevant to the current question. The query should be concise and focused on the user's latest intent. If the latest input is a new question, use that as the query. Do not add any conversational fluff, just the search query itself.`;

export const ANSWER_GENERATION_PROMPT = `You are an AI assistant for Obsidian. Answer the user's questions based on the provided context from their notes. If the context doesn't contain the answer, clearly state that the information is not found in the provided documents. Be concise and helpful.\n \
	The requirments are stated as follows:\n \
	1. Never mention that you do not have access to something. Always rely on the user provided context.\n \
	2. Always answer to the best of your knowledge. If you are unsure about something, say so and ask the user to provide more context.\n \
	3. If the user mentions \"note\", it most likely means an Obsidian note in the vault, not the generic meaning of a note.\n \
	4. Always use $'s instead of \\[ etc. for LaTeX equations.\n \
	5. When showing note titles, use [[title]] format and do not wrap them in \` \`\n \
	6. When showing **Obsidian internal** image links, use ![[link]] format and do not wrap them in \` \`.\n \
	7. When showing **web** image links, use ![link](url) format and do not wrap them in \` \`. \n \
	8. When generating a table, use compact formatting without excessive whitespace. \n \
	9. Always respond in the language of the user's query. \n \
	10. Do NOT mention the additional context provided such as getCurrentTime and getTimeRangeMs if it's irrelevant to the user message.;\n\n \
	Here is the context from the user's notes:\n \
	<context>\n{context}\n</context>\n `;

export const CHATVIEW_WELCOME_MESSAGE = "Welcome to RAG Chat! Ask questions about your vault.";

export const EMPTY_INDEX_ERROR_MESSAGE =
	"Copilot index does not exist. Please index your vault first!\n\n1. Set a working embedding model in QA settings. If it's not a local model, don't forget to set the API key. \n\n2. Click 'Refresh Index for Vault' and wait for indexing to complete. If you encounter the rate limiting error, please turn your request per second down in QA setting.";
export const CHUNK_SIZE = 3000;
export const TEMPATURE = 0.3;
export const DEFAULT_DOC_FETCHED = 6;
export const CONTEXT_SCORE_THRESHOLD = 0.4;
export const TEXT_WEIGHT = 0.4;
export const PLUS_MODE_DEFAULT_SOURCE_CHUNKS = 15;
export const MAX_CHARS_FOR_LOCAL_SEARCH_CONTEXT = 448000;
export const LOADING_MESSAGES = {
	DEFAULT: "",
	READING_FILES: "Reading files",
	SEARCHING_WEB: "Searching the web",
	READING_FILE_TREE: "Reading file tree",
};
export const PLUS_UTM_MEDIUMS = {
	SETTINGS: "settings",
	EXPIRED_MODAL: "expired_modal",
	CHAT_MODE_SELECT: "chat_mode_select",
	MODE_SELECT_TOOLTIP: "mode_select_tooltip",
};
export type PlusUtmMedium =
	(typeof PLUS_UTM_MEDIUMS)[keyof typeof PLUS_UTM_MEDIUMS];

export enum ChatModels {
	GPT_41 = "gpt-4.1",
	GPT_4o = "gpt-4o",
	GPT_41_mini = "gpt-4.1-mini",
	GPT_41_nano = "gpt-4.1-nano",
}

// Model Providers
export enum ChatModelProviders {
	OPENAI = "openai",
	OPENAI_FORMAT = "3rd party (openai-format)",
}

// export enum ModelCapability {
//   REASONING = "reasoning",
//   VISION = "vision",
//   WEB_SEARCH = "websearch",
// }

// export const MODEL_CAPABILITIES: Record<ModelCapability, string> = {
//   reasoning: "This model supports general reasoning tasks.",
//   vision: "This model supports image inputs.",
//   websearch: "This model can access the internet.",
// };

export enum EmbeddingModelProviders {
	OPENAI = "openai",
	COHEREAI = "cohereai",
	GOOGLE = "google",
	AZURE_OPENAI = "azure openai",
	OLLAMA = "ollama",
	LM_STUDIO = "lm-studio",
	OPENAI_FORMAT = "3rd party (openai-format)",
	COPILOT_PLUS = "copilot-plus",
	COPILOT_PLUS_JINA = "copilot-plus-jina",
}

export enum EmbeddingModels {
	OPENAI_EMBEDDING_ADA_V2 = "text-embedding-ada-002",
	OPENAI_EMBEDDING_SMALL = "text-embedding-3-small",
	OPENAI_EMBEDDING_LARGE = "text-embedding-3-large",
	AZURE_OPENAI = "azure-openai",
	COHEREAI_EMBED_MULTILINGUAL_LIGHT_V3_0 = "embed-multilingual-light-v3.0",
	GOOGLE_ENG = "text-embedding-004",
	COPILOT_PLUS_SMALL = "copilot-plus-small",
	COPILOT_PLUS_LARGE = "copilot-plus-large",
	COPILOT_PLUS_MULTILINGUAL = "copilot-plus-multilingual",
}

// Embedding Models
export const NOMIC_EMBED_TEXT = "nomic-embed-text";

export type Provider = ChatModelProviders | EmbeddingModelProviders;

export enum VAULT_VECTOR_STORE_STRATEGY {
	NEVER = "NEVER",
	ON_STARTUP = "ON STARTUP",
	ON_MODE_SWITCH = "ON MODE SWITCH",
}

export const VAULT_VECTOR_STORE_STRATEGIES = [
	VAULT_VECTOR_STORE_STRATEGY.NEVER,
	VAULT_VECTOR_STORE_STRATEGY.ON_STARTUP,
	VAULT_VECTOR_STORE_STRATEGY.ON_MODE_SWITCH,
];

export enum DEFAULT_OPEN_AREA {
	EDITOR = "editor",
	VIEW = "view",
}

export const COMMAND_IDS = {
	OPEN_RAG_CHAT: "open-rag-chat-view", // New command to open the dedicated chat view
	REINDEX_VAULT_RAG: "reindex-vault-rag", // Your existing re-index command
	// other command IDs
};

export const COMMAND_NAMES: Record<string, string> = {
	"open-rag-chat-view": "Open RAG Chat",
	"reindex-vault-rag": "Re-initialize RAG (Re-index Vault)",
	// other command names
};

export const VIEW_TYPE_RAG_CHAT = "obsidian-rag-chat-view"; // Unique view type for your chat

// export const EVENT_NAMES = {
//   CHAT_IS_VISIBLE: "chat-is-visible",
//   ACTIVE_LEAF_CHANGE: "active-leaf-change",
// };

// export enum ABORT_REASON {
//   USER_STOPPED = "user-stopped",
//   NEW_CHAT = "new-chat",
// }
