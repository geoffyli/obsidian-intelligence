import React, { createContext, ReactNode } from "react";
import { App } from "obsidian";
import { SharedState } from "./SharedState";

/**
 * Context for the SharedState instance
 */
export const SharedStateContext = createContext<SharedState | null>(null);

/**
 * Context for the Obsidian App instance
 */
export const AppContext = createContext<App | null>(null);

/**
 * Context for event targets (for plugin-wide events)
 */
export const EventTargetContext = createContext<EventTarget | null>(null);

interface ProvidersProps {
	children: ReactNode;
	sharedState: SharedState;
	app: App;
	eventTarget?: EventTarget;
}

/**
 * Combined provider component that wraps all contexts
 */
export function Providers({ children, sharedState, app, eventTarget }: ProvidersProps) {
	return (
		<AppContext.Provider value={app}>
			<SharedStateContext.Provider value={sharedState}>
				<EventTargetContext.Provider value={eventTarget || null}>
					{children}
				</EventTargetContext.Provider>
			</SharedStateContext.Provider>
		</AppContext.Provider>
	);
}

/**
 * Hook to access the Obsidian App instance
 */
export function useApp() {
	const app = React.useContext(AppContext);
	if (!app) {
		throw new Error("useApp must be used within an AppContext provider");
	}
	return app;
}

/**
 * Hook to access the event target
 */
export function useEventTarget() {
	const eventTarget = React.useContext(EventTargetContext);
	return eventTarget;
}