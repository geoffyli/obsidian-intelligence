# Obsidian Intelligence

Obsidian Intelligence is an advanced AI-powered plugin for Obsidian, providing multi-agent chat, semantic search, code refactoring, and safety validation features. It is built on a modern, Mastra-native orchestrator and agent system, supporting persistent memory and vector search for your notes.

## Features

-   Multi-agent architecture: Supervisor, Research, Refactoring, and Safety agents
-   Semantic search and knowledge retrieval across your vault
-   Code analysis and refactoring suggestions
-   Safety validation for destructive operations
-   Persistent memory and vector store (LibSQL-based)
-   Modern, extensible TypeScript codebase
-   Ribbon icon, chat view, and settings tab integration

## Architecture (2025+)

**This plugin now uses a Mastra-native orchestrator and agent registration system.**

-   All legacy code (`IntelligenceService`, `MastraMultiAgentSystem`, etc.) has been removed.
-   Agent creation and registration is handled in [`src/mastra/index.ts`](src/mastra/index.ts) using inlined factory functions.
-   The orchestrator is created via `createMastraWithAgents`, which wires up memory, vector store, and all agents.
-   UI and plugin commands interact with the orchestrator through a unified service interface.

### Example: Creating a Mastra Instance with Agents

```ts
import { createMastraWithAgents, vectorStore, memoryStore } from "./mastra";
import { app } from "obsidian";
import { MastraVectorStore } from "./mastra/agents/vectorstore/MastraVectorStore";

const myVectorStore = new MastraVectorStore({ ... });
const mastraWithAgents = createMastraWithAgents({
  app,
  vector: vectorStore, // LibSQLVector instance
  vectorStore: myVectorStore, // Your wrapper for agent/tool wiring
  // Optionally pass memoryConfig and safetyConfig
});
```

## How to use

-   Clone this repo.
-   Make sure your NodeJS is at least v16 (`node --version`).
-   `npm i` or `yarn` to install dependencies.
-   `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

-   Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Contributing & Development

-   See [`src/mastra/index.ts`](src/mastra/index.ts) for agent and orchestrator setup.
-   UI code is in [`src/ui/`](src/ui/).
-   All agent logic is now Mastra-native and extensible.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
	"fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
	"fundingUrl": {
		"Buy Me a Coffee": "https://buymeacoffee.com",
		"GitHub Sponsor": "https://github.com/sponsors",
		"Patreon": "https://www.patreon.com/"
	}
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
