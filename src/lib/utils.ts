import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Extend tailwind-merge to recognize Obsidian-specific classes
const customTwMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"text-color": [
				"text-normal", "text-muted", "text-faint",
				"text-accent", "text-accent-hover", "text-error",
				"text-selection", "text-on-accent", "text-success",
				"text-warning"
			],
			"font-size": [
				"text-smallest", "text-smaller", "text-small",
				"text-ui-smaller", "text-ui-small", "text-ui-medium", 
				"text-ui-larger"
			],
			"bg-color": [
				"bg-primary-alt", "bg-secondary-alt",
				"bg-modifier-hover", "bg-modifier-active-hover",
				"bg-modifier-border", "bg-modifier-border-hover",
				"bg-modifier-border-focus", "bg-modifier-error",
				"bg-modifier-error-hover", "bg-modifier-success",
				"bg-modifier-message", "bg-modifier-form-field"
			],
			"spacing": [
				"p-1", "p-2", "p-3", "p-4", "p-5", "p-6", "p-8", "p-12", "p-16",
				"m-1", "m-2", "m-3", "m-4", "m-5", "m-6", "m-8", "m-12", "m-16",
				"gap-1", "gap-2", "gap-3", "gap-4", "gap-5", "gap-6", "gap-8", "gap-12", "gap-16",
				"space-x-1", "space-x-2", "space-x-3", "space-x-4", "space-x-5", "space-x-6",
				"space-y-1", "space-y-2", "space-y-3", "space-y-4", "space-y-5", "space-y-6"
			],
			"radius": [
				"rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"
			]
		}
	}
})

export function cn(...inputs: ClassValue[]) {
	return customTwMerge(clsx(inputs))
}
