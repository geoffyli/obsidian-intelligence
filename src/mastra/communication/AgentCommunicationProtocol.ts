// Inter-agent communication protocol for multi-agent collaboration
import { AgentInteraction } from "../planning/types";
import { MastraMemoryManager } from "../memory/MastraMemoryManager";

export type MessageType = "request" | "response" | "notification" | "error" | "assistance_request" | "capability_query";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface AgentMessage {
	id: string;
	type: MessageType;
	fromAgent: string;
	toAgent: string | "broadcast"; // "broadcast" for all agents
	subject: string;
	content: string;
	priority: Priority;
	timestamp: Date;
	conversationId: string;
	taskId?: string;
	requiresResponse: boolean;
	metadata: Record<string, any>;
	expiresAt?: Date;
}

export interface AssistanceRequest extends AgentMessage {
	type: "assistance_request";
	requestedCapabilities: string[];
	context: Record<string, any>;
	urgency: "low" | "medium" | "high";
	timeoutMs: number;
}

export interface CapabilityQuery extends AgentMessage {
	type: "capability_query";
	requestedCapabilities: string[];
	responseTimeout: number;
}

export interface MessageResponse {
	messageId: string;
	fromAgent: string;
	content: string;
	success: boolean;
	metadata: Record<string, any>;
	timestamp: Date;
}

export interface AgentCapabilityInfo {
	agentId: string;
	capabilities: string[];
	specializations: string[];
	currentLoad: number;
	maxConcurrentTasks: number;
	averageResponseTime: number;
	isAvailable: boolean;
	lastSeen: Date;
}

export class AgentCommunicationProtocol {
	private memoryManager: MastraMemoryManager;
	private messageHandlers: Map<string, Map<MessageType, (message: AgentMessage) => Promise<MessageResponse | void>>> = new Map();
	private agentCapabilities: Map<string, AgentCapabilityInfo> = new Map();
	private pendingRequests: Map<string, { resolve: (response: MessageResponse) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();
	private messageQueue: Map<string, AgentMessage[]> = new Map(); // Agent ID -> Messages
	private isInitialized = false;

	constructor(memoryManager: MastraMemoryManager) {
		this.memoryManager = memoryManager;
	}

	/**
	 * Initialize the communication protocol
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Ensure memory manager is ready
			if (!this.memoryManager.isReady()) {
				await this.memoryManager.initialize();
			}

			this.isInitialized = true;
			console.log("AgentCommunicationProtocol initialized successfully");
		} catch (error) {
			console.error("Failed to initialize communication protocol:", error);
			throw error;
		}
	}

	/**
	 * Register an agent with the communication system
	 */
	registerAgent(agentId: string, capabilities: AgentCapabilityInfo): void {
		this.agentCapabilities.set(agentId, {
			...capabilities,
			lastSeen: new Date()
		});
		
		// Initialize message queue for the agent
		if (!this.messageQueue.has(agentId)) {
			this.messageQueue.set(agentId, []);
		}
		
		// Initialize message handlers for the agent
		if (!this.messageHandlers.has(agentId)) {
			this.messageHandlers.set(agentId, new Map());
		}

		console.log(`Agent ${agentId} registered with communication protocol`);
	}

	/**
	 * Register a message handler for an agent
	 */
	registerMessageHandler(
		agentId: string, 
		messageType: MessageType, 
		handler: (message: AgentMessage) => Promise<MessageResponse | void>
	): void {
		const agentHandlers = this.messageHandlers.get(agentId) || new Map();
		agentHandlers.set(messageType, handler);
		this.messageHandlers.set(agentId, agentHandlers);
	}

	/**
	 * Send a message between agents
	 */
	async sendMessage(message: Omit<AgentMessage, "id" | "timestamp">): Promise<string> {
		if (!this.isInitialized) {
			throw new Error("Communication protocol not initialized");
		}

		const fullMessage: AgentMessage = {
			...message,
			id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date()
		};

		try {
			// Store message in memory
			await this.storeMessage(fullMessage);

			// Handle broadcast messages
			if (fullMessage.toAgent === "broadcast") {
				await this.handleBroadcastMessage(fullMessage);
			} else {
				// Add to target agent's queue
				await this.queueMessageForAgent(fullMessage.toAgent, fullMessage);
				
				// Try immediate delivery
				await this.deliverMessage(fullMessage);
			}

			return fullMessage.id;
		} catch (error) {
			console.error("Failed to send message:", error);
			throw error;
		}
	}

	/**
	 * Send an assistance request to find capable agents
	 */
	async requestAssistance(request: Omit<AssistanceRequest, "id" | "timestamp" | "type">): Promise<MessageResponse[]> {
		if (!this.isInitialized) {
			throw new Error("Communication protocol not initialized");
		}

		// Find agents with required capabilities
		const capableAgents = this.findCapableAgents(request.requestedCapabilities);
		
		if (capableAgents.length === 0) {
			throw new Error(`No agents found with required capabilities: ${request.requestedCapabilities.join(", ")}`);
		}

		const responses: MessageResponse[] = [];
		const promises = capableAgents.map(async (agentId) => {
			const assistanceMessage: AssistanceRequest = {
				...request,
				id: `assist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type: "assistance_request",
				toAgent: agentId,
				timestamp: new Date()
			};

			try {
				const response = await this.sendAndWaitForResponse(assistanceMessage, request.timeoutMs);
				if (response) {
					responses.push(response);
				}
			} catch (error) {
				console.warn(`Assistant request to ${agentId} failed:`, error);
			}
		});

		await Promise.allSettled(promises);
		return responses;
	}

	/**
	 * Send a message and wait for response
	 */
	async sendAndWaitForResponse(message: Omit<AgentMessage, "id" | "timestamp">, timeoutMs = 30000): Promise<MessageResponse | null> {
		if (!message.requiresResponse) {
			await this.sendMessage(message);
			return null;
		}

		return new Promise(async (resolve, reject) => {
			const messageId = await this.sendMessage(message);
			
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(messageId);
				reject(new Error(`Message timeout: ${messageId}`));
			}, timeoutMs);

			this.pendingRequests.set(messageId, {
				resolve,
				reject,
				timeout
			});
		});
	}

	/**
	 * Respond to a message
	 */
	async respondToMessage(originalMessageId: string, response: Omit<MessageResponse, "timestamp">): Promise<void> {
		const fullResponse: MessageResponse = {
			...response,
			timestamp: new Date()
		};

		try {
			// Store response
			await this.storeResponse(originalMessageId, fullResponse);

			// Check if there's a pending request waiting for this response
			const pendingRequest = this.pendingRequests.get(originalMessageId);
			if (pendingRequest) {
				clearTimeout(pendingRequest.timeout);
				this.pendingRequests.delete(originalMessageId);
				pendingRequest.resolve(fullResponse);
			}
		} catch (error) {
			console.error("Failed to respond to message:", error);
			throw error;
		}
	}

	/**
	 * Get pending messages for an agent
	 */
	async getPendingMessages(agentId: string): Promise<AgentMessage[]> {
		return this.messageQueue.get(agentId) || [];
	}

	/**
	 * Mark messages as processed
	 */
	async markMessagesProcessed(agentId: string, messageIds: string[]): Promise<void> {
		const queue = this.messageQueue.get(agentId) || [];
		const filteredQueue = queue.filter(msg => !messageIds.includes(msg.id));
		this.messageQueue.set(agentId, filteredQueue);
	}

	/**
	 * Find agents with specific capabilities
	 */
	findCapableAgents(requiredCapabilities: string[]): string[] {
		const capableAgents: string[] = [];

		for (const [agentId, info] of this.agentCapabilities.entries()) {
			if (!info.isAvailable) continue;

			const hasCapabilities = requiredCapabilities.every(required => 
				info.capabilities.some(cap => cap.toLowerCase().includes(required.toLowerCase())) ||
				info.specializations.some(spec => spec.toLowerCase().includes(required.toLowerCase()))
			);

			if (hasCapabilities) {
				capableAgents.push(agentId);
			}
		}

		// Sort by current load (prefer less busy agents)
		return capableAgents.sort((a, b) => {
			const loadA = this.agentCapabilities.get(a)?.currentLoad || 0;
			const loadB = this.agentCapabilities.get(b)?.currentLoad || 0;
			return loadA - loadB;
		});
	}

	/**
	 * Update agent availability and load
	 */
	updateAgentStatus(agentId: string, updates: Partial<AgentCapabilityInfo>): void {
		const existing = this.agentCapabilities.get(agentId);
		if (existing) {
			this.agentCapabilities.set(agentId, {
				...existing,
				...updates,
				lastSeen: new Date()
			});
		}
	}

	/**
	 * Get agent capabilities information
	 */
	getAgentCapabilities(agentId?: string): AgentCapabilityInfo[] {
		if (agentId) {
			const info = this.agentCapabilities.get(agentId);
			return info ? [info] : [];
		}
		return Array.from(this.agentCapabilities.values());
	}

	/**
	 * Store message in memory
	 */
	private async storeMessage(message: AgentMessage): Promise<void> {
		try {
			const interaction: AgentInteraction = {
				id: message.id,
				fromAgent: message.fromAgent,
				toAgent: message.toAgent === "broadcast" ? undefined : message.toAgent,
				type: this.mapMessageTypeToInteractionType(message.type),
				content: message.content,
				timestamp: message.timestamp,
				taskId: message.taskId || "communication",
				metadata: {
					subject: message.subject,
					priority: message.priority,
					requiresResponse: message.requiresResponse,
					...message.metadata
				}
			};

			await this.memoryManager.storeAgentInteraction(interaction);
		} catch (error) {
			console.error("Failed to store message:", error);
			// Don't throw - message delivery is more important than storage
		}
	}

	/**
	 * Store response in memory
	 */
	private async storeResponse(messageId: string, response: MessageResponse): Promise<void> {
		try {
			const interaction: AgentInteraction = {
				id: `response_${response.messageId}`,
				fromAgent: response.fromAgent,
				type: "response",
				content: response.content,
				timestamp: response.timestamp,
				taskId: "communication",
				metadata: {
					originalMessageId: messageId,
					success: response.success,
					...response.metadata
				}
			};

			await this.memoryManager.storeAgentInteraction(interaction);
		} catch (error) {
			console.error("Failed to store response:", error);
		}
	}

	/**
	 * Handle broadcast messages
	 */
	private async handleBroadcastMessage(message: AgentMessage): Promise<void> {
		const allAgents = Array.from(this.agentCapabilities.keys());
		const deliveryPromises = allAgents
			.filter(agentId => agentId !== message.fromAgent) // Don't send to sender
			.map(agentId => this.queueMessageForAgent(agentId, { ...message, toAgent: agentId }));
		
		await Promise.allSettled(deliveryPromises);
	}

	/**
	 * Queue message for an agent
	 */
	private async queueMessageForAgent(agentId: string, message: AgentMessage): Promise<void> {
		const queue = this.messageQueue.get(agentId) || [];
		
		// Check for duplicates
		if (!queue.find(msg => msg.id === message.id)) {
			queue.push(message);
			
			// Sort by priority and timestamp
			queue.sort((a, b) => {
				const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
				const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
				if (priorityDiff !== 0) return priorityDiff;
				return a.timestamp.getTime() - b.timestamp.getTime();
			});
			
			this.messageQueue.set(agentId, queue);
		}
	}

	/**
	 * Attempt to deliver message immediately
	 */
	private async deliverMessage(message: AgentMessage): Promise<void> {
		try {
			const agentHandlers = this.messageHandlers.get(message.toAgent);
			if (!agentHandlers) {
				console.warn(`No handlers registered for agent: ${message.toAgent}`);
				return;
			}

			const handler = agentHandlers.get(message.type);
			if (!handler) {
				console.warn(`No handler for message type ${message.type} on agent ${message.toAgent}`);
				return;
			}

			const response = await handler(message);
			
			// If message requires response and handler provided one
			if (message.requiresResponse && response) {
				await this.respondToMessage(message.id, response);
			}
			
			// Remove from queue after successful delivery
			await this.markMessagesProcessed(message.toAgent, [message.id]);
			
		} catch (error) {
			console.error(`Failed to deliver message ${message.id}:`, error);
			// Message remains in queue for retry
		}
	}

	/**
	 * Map message type to interaction type
	 */
	private mapMessageTypeToInteractionType(messageType: MessageType): "request" | "response" | "notification" | "error" {
		switch (messageType) {
			case "request":
			case "assistance_request":
			case "capability_query":
				return "request";
			case "response":
				return "response";
			case "error":
				return "error";
			case "notification":
			default:
				return "notification";
		}
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		// Clear all pending requests
		for (const [messageId, pendingRequest] of this.pendingRequests.entries()) {
			clearTimeout(pendingRequest.timeout);
			pendingRequest.reject(new Error("Communication protocol shutting down"));
		}
		this.pendingRequests.clear();

		// Clear message queues
		this.messageQueue.clear();
		
		// Clear handlers
		this.messageHandlers.clear();
		
		// Clear capabilities
		this.agentCapabilities.clear();
		
		this.isInitialized = false;
		console.log("AgentCommunicationProtocol cleaned up successfully");
	}
}
