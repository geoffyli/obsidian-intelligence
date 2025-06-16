// Safety Manager for handling approval workflows and risk assessment
import { Notice } from "obsidian";
import {
	RiskAssessment,
	ApprovalRequest,
	ApprovalResult,
	FileChange,
	SafetyConfig,
	SafetyError,
} from "../agents/types";

/**
 * Safety Manager that implements Claude-Code like safety and approval system
 * Initially requires approval for all file modifications, with session-based auto-approval
 */
export class SafetyManager {
	private isInitialized = false;
	private pendingApprovals: Map<string, ApprovalRequest> = new Map();
	private approvalHistory: Map<string, ApprovalResult> = new Map();
	private sessionAutoApproval = false;
	private approvedOperationTypes: Set<string> = new Set();
	private maxAutoApprovals: number;
	private sessionTimeout: number;
	private sessionStartTime: Date;

	constructor(private config: SafetyConfig) {
		this.maxAutoApprovals = config.maxAutoApprovals || 10;
		this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
		this.sessionStartTime = new Date();
	}

	/**
	 * Initialize the safety manager
	 */
	async initialize(): Promise<void> {
		this.isInitialized = true;
		console.log("Safety manager initialized");

		// Reset session state
		this.resetSession();
	}

	/**
	 * Assess risk of a file operation
	 */
	async assessRisk(changes: FileChange[]): Promise<RiskAssessment> {
		if (!this.isInitialized) {
			throw new Error("Safety manager not initialized");
		}

		let maxRisk: "low" | "medium" | "high" = "low";
		let requiresApproval = false;
		let previewRequired = false;
		let reasoning = "";

		for (const change of changes) {
			const changeRisk = this.assessChangeRisk(change);

			if (
				changeRisk.level === "high" ||
				(changeRisk.level === "medium" && maxRisk === "low")
			) {
				maxRisk = changeRisk.level;
			}

			if (changeRisk.requiresApproval) {
				requiresApproval = true;
			}

			if (changeRisk.previewRequired) {
				previewRequired = true;
			}

			reasoning += changeRisk.reasoning + " ";
		}

		// Check if session auto-approval is enabled and applicable
		if (
			requiresApproval &&
			this.sessionAutoApproval &&
			this.isOperationAutoApproved(changes)
		) {
			requiresApproval = false;
			reasoning += "Auto-approved based on session settings. ";
		}

		return {
			level: maxRisk,
			requiresApproval,
			previewRequired,
			reasoning: reasoning.trim(),
			rollbackPlan: this.generateRollbackPlan(changes),
		};
	}

	/**
	 * Request approval for a risky operation
	 */
	async requestApproval(
		changes: FileChange[],
		riskAssessment: RiskAssessment,
		timeout: number = 30000
	): Promise<ApprovalResult> {
		const requestId = this.generateRequestId();

		const request: ApprovalRequest = {
			id: requestId,
			operation: this.summarizeOperation(changes),
			riskLevel: riskAssessment.level,
			previewData: {
				operationType: changes[0]?.changeType || "unknown",
				affectedFiles: changes.map((c) => c.filePath),
				changes,
				riskLevel: riskAssessment.level,
			},
			timeout,
		};

		this.pendingApprovals.set(requestId, request);

		try {
			// Display approval request in console and UI
			console.log("\n" + "=".repeat(80));
			console.log("⚠️  APPROVAL REQUIRED FOR FILE OPERATION");
			console.log("=".repeat(80));
			console.log(`Operation: ${request.operation}`);
			console.log(`Risk Level: ${request.riskLevel.toUpperCase()}`);
			console.log(`Reasoning: ${riskAssessment.reasoning}`);
			console.log("");
			console.log("Files to be affected:");
			for (const change of changes) {
				console.log(
					`  ${change.changeType.toUpperCase()}: ${change.filePath}`
				);
			}
			console.log("");
			console.log("To proceed with this operation:");
			console.log(
				'1. Type "approve" in the chat to approve this specific operation'
			);
			console.log(
				'2. Type "auto-approve" to enable auto-approval for this session'
			);
			console.log('3. Type "cancel" to cancel the operation');
			console.log("=".repeat(80));

			// Show notice in Obsidian
			new Notice(
				`⚠️ Approval required for ${request.operation}. Check console for details.`,
				10000
			);

			// Wait for approval (this is a simplified implementation)
			// In a real implementation, this would integrate with the chat system
			const result = await this.waitForApproval(requestId, timeout);

			// Store approval history
			this.approvalHistory.set(requestId, result);

			// Update session settings if requested
			if (result.approved && result.allowFutureAuto) {
				this.enableSessionAutoApproval();
			}

			return result;
		} finally {
			this.pendingApprovals.delete(requestId);
		}
	}

	/**
	 * Approve a pending operation
	 */
	async approvePendingOperation(
		requestId: string,
		allowFutureAuto: boolean = false
	): Promise<ApprovalResult> {
		const request = this.pendingApprovals.get(requestId);
		if (!request) {
			throw new Error(
				`No pending approval request found with ID: ${requestId}`
			);
		}

		const result: ApprovalResult = {
			approved: true,
			reason: "User approved",
			allowFutureAuto,
		};

		console.log(`✅ Operation approved: ${request.operation}`);

		if (allowFutureAuto) {
			this.enableSessionAutoApproval();
		}

		return result;
	}

	/**
	 * Cancel a pending operation
	 */
	async cancelPendingOperation(
		requestId: string,
		reason?: string
	): Promise<ApprovalResult> {
		const request = this.pendingApprovals.get(requestId);
		if (!request) {
			throw new Error(
				`No pending approval request found with ID: ${requestId}`
			);
		}

		const result: ApprovalResult = {
			approved: false,
			reason: reason || "User cancelled",
		};

		console.log(`❌ Operation cancelled: ${request.operation}`);
		if (reason) {
			console.log(`Reason: ${reason}`);
		}

		return result;
	}

	/**
	 * Enable session-based auto-approval
	 */
	enableSessionAutoApproval(): void {
		this.sessionAutoApproval = true;
		this.sessionStartTime = new Date();

		console.log("🔓 Auto-approval enabled for this session");
		console.log(
			"File modifications will be automatically approved until you restart or disable auto-approval"
		);

		new Notice("Auto-approval enabled for this session", 5000);
	}

	/**
	 * Disable session-based auto-approval
	 */
	disableSessionAutoApproval(): void {
		this.sessionAutoApproval = false;
		this.approvedOperationTypes.clear();

		console.log("🔒 Auto-approval disabled");
		new Notice("Auto-approval disabled", 3000);
	}

	/**
	 * Check if session auto-approval is enabled
	 */
	isSessionAutoApprovalEnabled(): boolean {
		// Check if session has timed out
		if (this.sessionAutoApproval && this.hasSessionTimedOut()) {
			this.disableSessionAutoApproval();
			return false;
		}

		return this.sessionAutoApproval;
	}

	/**
	 * Get safety status
	 */
	getSafetyStatus(): {
		initialized: boolean;
		sessionAutoApproval: boolean;
		sessionTimeRemaining: number;
		pendingApprovals: number;
		approvalHistory: number;
	} {
		return {
			initialized: this.isInitialized,
			sessionAutoApproval: this.sessionAutoApproval,
			sessionTimeRemaining: this.getSessionTimeRemaining(),
			pendingApprovals: this.pendingApprovals.size,
			approvalHistory: this.approvalHistory.size,
		};
	}

	/**
	 * Get pending approval requests
	 */
	getPendingApprovals(): ApprovalRequest[] {
		return Array.from(this.pendingApprovals.values());
	}

	/**
	 * Cleanup safety manager
	 */
	async cleanup(): Promise<void> {
		this.pendingApprovals.clear();
		this.approvalHistory.clear();
		this.sessionAutoApproval = false;
		this.approvedOperationTypes.clear();
		this.isInitialized = false;

		console.log("Safety manager cleaned up");
	}

	/**
	 * Assess risk of a single file change
	 */
	private assessChangeRisk(change: FileChange): RiskAssessment {
		let level: "low" | "medium" | "high" = "low";
		let requiresApproval = true; // Always require approval initially
		let reasoning = "";

		switch (change.changeType) {
			case "delete":
				level = "high";
				reasoning = "File deletion is irreversible and high risk.";
				break;

			case "modify":
				level = "medium";
				reasoning = "File modification changes existing content.";

				// Check for large modifications
				if (change.oldContent && change.newContent) {
					const oldLines = change.oldContent.split("\n").length;
					const newLines = change.newContent.split("\n").length;
					const changeRatio =
						Math.abs(newLines - oldLines) / oldLines;

					if (changeRatio > 0.5) {
						level = "high";
						reasoning =
							"Large modification detected (>50% change in content).";
					}
				}
				break;

			case "create":
				level = "low";
				reasoning = "File creation is generally safe.";

				// Check if file already exists
				if (change.oldContent) {
					level = "medium";
					reasoning = "File creation would overwrite existing file.";
				}
				break;
		}

		return {
			level,
			requiresApproval,
			previewRequired: level !== "low",
			reasoning,
		};
	}

	/**
	 * Check if operation is auto-approved
	 */
	private isOperationAutoApproved(changes: FileChange[]): boolean {
		if (!this.sessionAutoApproval) {
			return false;
		}

		// Check if session has timed out
		if (this.hasSessionTimedOut()) {
			this.disableSessionAutoApproval();
			return false;
		}

		// For now, auto-approve all operations if session auto-approval is enabled
		// Can be enhanced with more granular control
		return true;
	}

	/**
	 * Generate rollback plan
	 */
	private generateRollbackPlan(changes: FileChange[]): string {
		const rollbackSteps = changes.map((change) => {
			switch (change.changeType) {
				case "create":
					return `Delete created file: ${change.filePath}`;
				case "modify":
					return `Restore original content of: ${change.filePath}`;
				case "delete":
					return `Restore deleted file: ${change.filePath} (if backup available)`;
				default:
					return `Reverse operation for: ${change.filePath}`;
			}
		});

		return rollbackSteps.join("; ");
	}

	/**
	 * Summarize operation for display
	 */
	private summarizeOperation(changes: FileChange[]): string {
		if (changes.length === 1) {
			const change = changes[0];
			return `${change.changeType} ${change.filePath}`;
		}

		const types = changes.map((c) => c.changeType);
		const uniqueTypes = Array.from(new Set(types));

		return `${uniqueTypes.join("/")} ${changes.length} files`;
	}

	/**
	 * Generate unique request ID
	 */
	private generateRequestId(): string {
		return `approval_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;
	}

	/**
	 * Wait for approval (simplified implementation)
	 */
	private async waitForApproval(
		requestId: string,
		timeout: number
	): Promise<ApprovalResult> {
		// This is a simplified implementation
		// In a real scenario, this would integrate with the chat system
		// For now, return a default result
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					approved: false,
					reason: "Timeout - no response received",
				});
			}, timeout);
		});
	}

	/**
	 * Check if session has timed out
	 */
	private hasSessionTimedOut(): boolean {
		const now = new Date();
		const sessionAge = now.getTime() - this.sessionStartTime.getTime();
		return sessionAge > this.sessionTimeout;
	}

	/**
	 * Get remaining session time in milliseconds
	 */
	private getSessionTimeRemaining(): number {
		if (!this.sessionAutoApproval) {
			return 0;
		}

		const now = new Date();
		const sessionAge = now.getTime() - this.sessionStartTime.getTime();
		return Math.max(0, this.sessionTimeout - sessionAge);
	}

	/**
	 * Reset session state
	 */
	private resetSession(): void {
		this.sessionAutoApproval = false;
		this.approvedOperationTypes.clear();
		this.sessionStartTime = new Date();
		this.pendingApprovals.clear();
	}
}
