import { App } from "obsidian";

export interface ObsidianMemoryStoreConfig {
	dataDir: string;
	fileName?: string;
}

/**
 * Obsidian-compatible memory store that uses the file system
 * Replaces LibSQL storage with JSON file storage
 */
export class ObsidianMemoryStore {
	private app: App;
	private dataPath: string;
	private cache: Record<string, any> = {};
	private initialized = false;

	constructor(app: App, config: ObsidianMemoryStoreConfig) {
		this.app = app;
		this.dataPath = `${config.dataDir}/${config.fileName || 'memory.json'}`;
	}

	/**
	 * Initialize the storage system
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			await this.loadData();
			this.initialized = true;
			console.log("ObsidianMemoryStore initialized successfully");
		} catch (error) {
			console.error("Failed to initialize ObsidianMemoryStore:", error);
			throw error;
		}
	}

	/**
	 * Get a value by key
	 */
	async get(key: string): Promise<any> {
		if (!this.initialized) {
			await this.initialize();
		}
		return this.cache[key];
	}

	/**
	 * Set a value by key
	 */
	async set(key: string, value: any): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
		
		this.cache[key] = value;
		await this.saveData();
	}

	/**
	 * Delete a value by key
	 */
	async delete(key: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		delete this.cache[key];
		await this.saveData();
	}

	/**
	 * Get all keys
	 */
	async keys(): Promise<string[]> {
		if (!this.initialized) {
			await this.initialize();
		}
		return Object.keys(this.cache);
	}

	/**
	 * Check if key exists
	 */
	async has(key: string): Promise<boolean> {
		if (!this.initialized) {
			await this.initialize();
		}
		return key in this.cache;
	}

	/**
	 * Clear all data
	 */
	async clear(): Promise<void> {
		this.cache = {};
		await this.saveData();
	}

	/**
	 * Get all entries
	 */
	async entries(): Promise<[string, any][]> {
		if (!this.initialized) {
			await this.initialize();
		}
		return Object.entries(this.cache);
	}

	/**
	 * Load data from file system
	 */
	private async loadData(): Promise<void> {
		try {
			// Ensure the data directory exists
			const dataDir = this.dataPath.substring(0, this.dataPath.lastIndexOf('/'));
			if (!(await this.app.vault.adapter.exists(dataDir))) {
				await this.app.vault.adapter.mkdir(dataDir);
			}

			// Try to read existing data
			if (await this.app.vault.adapter.exists(this.dataPath)) {
				const content = await this.app.vault.adapter.read(this.dataPath);
				this.cache = JSON.parse(content);
			} else {
				this.cache = {};
			}
		} catch (error) {
			console.warn("Failed to load memory data, starting with empty cache:", error);
			this.cache = {};
		}
	}

	/**
	 * Save data to file system
	 */
	private async saveData(): Promise<void> {
		try {
			await this.app.vault.adapter.write(
				this.dataPath, 
				JSON.stringify(this.cache, null, 2)
			);
		} catch (error) {
			console.error("Failed to save memory data:", error);
			throw error;
		}
	}

	/**
	 * Close/cleanup the storage
	 */
	async close(): Promise<void> {
		// Ensure final save
		if (this.initialized) {
			await this.saveData();
		}
		this.initialized = false;
	}

	/**
	 * Get storage statistics
	 */
	getStats(): { totalKeys: number; filePath: string } {
		return {
			totalKeys: Object.keys(this.cache).length,
			filePath: this.dataPath,
		};
	}
}