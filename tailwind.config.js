// tailwind.config.js
import colors from "tailwindcss/colors"; // Keep if you use default Tailwind colors elsewhere

/** @type {import("tailwindcss").Config} */
module.exports = {
	important: ".obsidian-intelligence", // Scope styles to your plugin
	content: [
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/styles/tailwind.css",
		// add other paths as needed
	],
	darkMode: "class", // Assuming Obsidian handles dark mode via a class on the body or a parent element
	plugins: [],
	theme: {
		// --- Centralized Color Palette ---
		// This 'colors' object is the single source of truth for your semantic and custom colors.
		colors: {
			inherit: "inherit",
			current: "currentColor",
			transparent: "transparent",
			black: "#000000",
			white: "var(--text-white)", // Or specific white like #FFFFFF if --text-white isn't always pure white

			// Shadcn UI Semantic Colors - Mapped to Obsidian CSS Variables
			// These are crucial for shadcn components to pick up Obsidian's theme.
			background: "var(--background-primary)", // Main background of components/plugin area
			foreground: "var(--text-normal)", // Default text color

			primary: "var(--interactive-accent)", // Primary interactive elements (e.g., button background)
			"primary-foreground": "var(--text-on-accent)", // Text on primary elements

			secondary: "var(--background-secondary)", // Secondary elements (e.g., card background)
			"secondary-foreground": "var(--text-normal)", // Text on secondary elements

			muted: "var(--background-modifier-hover)", // Muted elements or backgrounds
			"muted-foreground": "var(--text-muted)", // Text for muted elements

			accent: "var(--text-accent)", // Accent color (can be same as primary or different)
			"accent-foreground": "var(--text-on-accent)", // Text on accent-colored elements

			destructive: "var(--text-error)", // Destructive actions (e.g., delete button background)
			// Consider var(--color-red) if --text-error is not suitable for backgrounds
			"destructive-foreground": "var(--text-on-accent)", // Text on destructive elements (ensure good contrast)
			// Might need to be var(--text-white) or var(--text-normal) depending on --text-error's color

			border: "var(--background-modifier-border)", // Default border color
			input: "var(--background-modifier-border)", // Input border color (can be more specific if needed, e.g., var(--background-form-field-border))
			ring: "var(--interactive-accent)", // Focus ring color (often same as primary)

			// --- Obsidian Specific Colors (from your original config) ---
			// These are your detailed mappings to Obsidian's theme.
			// Keep them if you use these specific names directly in your classes.
			base: {
				"00": "var(--color-base-00)",
				"05": "var(--color-base-05)",
				10: "var(--color-base-10)",
				20: "var(--color-base-20)",
				25: "var(--color-base-25)",
				30: "var(--color-base-30)",
				35: "var(--color-base-35)",
				40: "var(--color-base-40)",
				50: "var(--color-base-50)",
				60: "var(--color-base-60)",
				70: "var(--color-base-70)",
				100: "var(--color-base-100)",
			},
			red: "var(--color-red)",
			"red-rgb": "rgba(var(--color-red-rgb), <alpha-value>)",
			orange: "var(--color-orange)",
			"orange-rgb": "rgba(var(--color-orange-rgb), <alpha-value>)",
			yellow: "var(--color-yellow)",
			"yellow-rgb": "rgba(var(--color-yellow-rgb), <alpha-value>)",
			green: "var(--color-green)",
			"green-rgb": "rgba(var(--color-green-rgb), <alpha-value>)",
			cyan: "var(--color-cyan)",
			"cyan-rgb": "rgba(var(--color-cyan-rgb), <alpha-value>)",
			blue: "var(--color-blue)",
			"blue-rgb": "rgba(var(--color-blue-rgb), <alpha-value>)",
			purple: "var(--color-purple)",
			"purple-rgb": "rgba(var(--color-purple-rgb), <alpha-value>)",
			pink: "var(--color-pink)",
			"pink-rgb": "rgba(var(--color-pink-rgb), <alpha-value>)",
			gray: "var(--color-gray)", // This is a generic gray, consider using 'muted' or specific base colors for UI.
			"mono-rgb": {
				0: "rgba(var(--mono-rgb-0), <alpha-value>)",
				100: "rgba(var(--mono-rgb-100), <alpha-value>)",
			},
			caret: "var(--caret-color)",
			icon: {
				DEFAULT: "var(--icon-color)",
				hover: "var(--icon-color-hover)",
				active: "var(--icon-color-active)",
				focused: "var(--icon-color-focused)",
			},
			// Specific text colors from your original textColor, if still needed directly
			// and not covered by semantic 'foreground', 'primary-foreground', etc.
		},

		// --- Theme Sections (backgroundColor, textColor, etc.) ---
		// These sections should primarily extend the 'colors' palette defined above.
		backgroundColor: (theme) => ({
			...theme("colors"), // Inherit all colors from the main 'colors' palette
			// Add any *additional* specific background colors here if they aren't in the main palette
			// e.g., 'obsidian-primary-alt-bg': 'var(--background-primary-alt)',
			// Your specific modifier/interactive/dropdown backgrounds:
			"modifier-hover": "var(--background-modifier-hover)", // Covered by 'muted'
			"modifier-active-hover": "var(--background-modifier-active-hover)",
			"modifier-error": "var(--background-modifier-error)",
			"modifier-error-rgb":
				"rgba(var(--background-modifier-error-rgb), <alpha-value>)",
			"modifier-error-hover": "var(--background-modifier-error-hover)",
			"modifier-success": "var(--background-modifier-success)",
			"modifier-success-rgb":
				"rgba(var(--background-modifier-success-rgb), <alpha-value>)",
			"modifier-message": "var(--background-modifier-message)",
			"modifier-form-field": "var(--background-form-field)",

			"interactive-normal": "var(--interactive-normal)",
			"interactive-hover": "var(--interactive-hover)",
			"interactive-accent": "var(--interactive-accent)", // Covered by 'primary' and 'ring'
			"interactive-accent-hsl":
				"hsl(var(--interactive-accent-hsl), <alpha-value>)",
			"interactive-accent-hover": "var(--interactive-accent-hover)",

			"dropdown-default": "var(--dropdown-background)",
			"dropdown-blend": "var(--dropdown-background-blend-mode)",
			"dropdown-hover": "var(--dropdown-background-hover)",

			"callout-warning-bg": "rgba(var(--callout-warning), <alpha-value>)", // Renamed for clarity
			"overlay-bg": "#000000", // Renamed for clarity
			"toggle-thumb-bg": "var(--toggle-thumb-color)", // Renamed for clarity
		}),
		textColor: (theme) => ({
			...theme("colors"), // Inherit all colors from the main 'colors' palette
			// Add any *additional* specific text colors here
			"text-normal": "var(--text-normal)",
			"text-muted": "var(--text-muted)", // Covered by 'muted-foreground'
			"text-faint": "var(--text-faint)",
			"text-on-accent": "var(--text-on-accent)", // Covered by 'primary-foreground', 'accent-foreground'
			"text-on-accent-inverted": "var(--text-on-accent-inverted)",
			"text-success": "var(--text-success)",
			"text-warning": "var(--text-warning)",
			"text-error": "var(--text-error)", // Covered by 'destructive' (for bg) or use for text specifically
			"text-accent": "var(--text-accent)", // Covered by 'accent' (for bg) or use for text specifically
			"text-accent-hover": "var(--text-accent-hover)",
			"text-selection": "var(--text-selection)",
			"text-highlight-bg": "var(--text-highlight-bg)",
			"text-callout-warning":
				"rgba(var(--callout-warning), <alpha-value>)", // Renamed for clarity
			"text-white": "var(--text-white)", // Covered by 'white'
			"text-model-capabilities-green": "var(--color-green)", // Renamed for clarity
			"text-model-capabilities-blue": "var(--color-blue)", // Renamed for clarity
		}),
		borderColor: (theme) => ({
			...theme("colors"), // Inherit all colors from the main 'colors' palette
			DEFAULT: theme("colors.border", "currentColor"), // Default border color
			// Add any *additional* specific border colors here
			"border-hover": "var(--background-modifier-border-hover)",
			"border-focus": "var(--background-modifier-border-focus)",
			"interactive-accent-border": "var(--interactive-accent)", // Renamed for clarity, covered by 'ring' or 'primary'
		}),
		ringColor: (theme) => ({
			...theme("colors"), // Inherit all colors from the main 'colors' palette
			DEFAULT: theme("colors.ring", "currentColor"), // Default ring color
		}),
		ringOffsetColor: (theme) => ({
			...theme("colors"),
			DEFAULT: theme("colors.background", "#ffffff"), // Default ring offset (usually background color)
			// Explicitly 'ring' if you defined a specific 'ring' offset color in theme.colors
			// 'ring-offset-specific': 'var(--interactive-accent)', // Example if needed
		}),

		// --- Structural Theme Values (Spacing, Radius, Fonts, etc.) ---
		// These are generally well-defined from your original config.
		borderRadius: {
			DEFAULT: "var(--radius-m)", // Default for 'rounded' class
			sm: "var(--radius-s)",
			md: "var(--radius-m)",
			lg: "var(--radius-l)",
			xl: "var(--radius-xl)",
			"clickable-icon": "var(--clickable-icon-radius)",
			full: "9999px", // Often useful for pills or circular elements
		},
		borderWidth: {
			DEFAULT: "var(--border-width)",
			0: "0",
			2: "2px",
			4: "4px",
			8: "8px", // Common utilities
		},
		zIndex: {
			0: "0",
			10: "10",
			20: "20",
			30: "30",
			40: "40",
			50: "50",
			auto: "auto",
			// Obsidian layers (good to keep for context or direct use)
			cover: "var(--layer-cover)",
			sidedock: "var(--layer-sidedock)",
			"status-bar": "var(--layer-status-bar)",
			popover: "var(--layer-popover)",
			slides: "var(--layer-slides)",
			modal: "var(--layer-modal)",
			notice: "var(--layer-notice)",
			menu: "var(--layer-menu)",
			tooltip: "var(--layer-tooltip)",
			"dragged-item": "var(--layer-dragged-item)",
		},
		fontWeight: {
			thin: "var(--font-thin)",
			extralight: "var(--font-extralight)",
			light: "var(--font-light)",
			normal: "var(--font-normal)",
			medium: "var(--font-medium)",
			semibold: "var(--font-semibold)",
			bold: "var(--font-bold)",
			extrabold: "var(--font-extrabold)",
			black: "var(--font-black)",
		},
		// 'extend' is used to add to existing Tailwind defaults or your own base theme.
		// If you are defining a whole scale (like fontSize), you can define it directly under 'theme'.
		extend: {
			// If you want to keep Tailwind's default spacing scale and add to it:
			spacing: {
				1: "var(--size-4-1)",
				2: "var(--size-4-2)",
				3: "var(--size-4-3)",
				4: "var(--size-4-4)",
				5: "var(--size-4-5)",
				5.5: "calc(var(--size-4-5) + 2px)",
				6: "var(--size-4-6)",
				// You can add more specific named spacings if needed
				// e.g., 'sidebar-width': '250px',
			},
			cursor: {
				DEFAULT: "var(--cursor)",
				auto: "var(--cursor)", // Redundant with DEFAULT if same value
				pointer: "var(--cursor-link)",
			},
			fontSize: {
				// Extending default font sizes
				text: "var(--font-text-size)",
				smallest: "var(--font-smallest)",
				smaller: "var(--font-smaller)",
				small: "var(--font-small)",
				"ui-smaller": "var(--font-ui-smaller)",
				"ui-small": "var(--font-ui-small)",
				"ui-medium": "var(--font-ui-medium)",
				"ui-larger": "var(--font-ui-larger)",
			},
			strokeWidth: {
				icon: "var(--icon-stroke)",
				"icon-xs": "var(--icon-xs-stroke-width)",
				"icon-s": "var(--icon-s-stroke-width)",
				"icon-m": "var(--icon-m-stroke-width)",
				"icon-l": "var(--icon-l-stroke-width)",
				"icon-xl": "var(--icon-xl-stroke-width)",
			},
			lineHeight: {
				normal: "var(--line-height-normal)",
				tight: "var(--line-height-tight)",
			},
			size: {
				// For width/height utilities like w-icon, h-icon
				icon: "var(--icon-size)",
				"icon-xs": "var(--icon-xs)",
				"icon-s": "var(--icon-s)",
				"icon-m": "var(--icon-m)",
				"icon-l": "var(--icon-l)",
				"icon-xl": "var(--icon-xl)",
				checkbox: "var(--checkbox-size)",
			},
			opacity: {
				icon: "var(--icon-opacity)",
				"icon-hover": "var(--icon-opacity-hover)",
				"icon-active": "var(--icon-opacity-active)",
			},
			// Add animations and keyframes if needed for shadcn components or custom elements
			// keyframes: {
			//  "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
			//  "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
			// },
			// animation: {
			//  "accordion-down": "accordion-down 0.2s ease-out",
			//  "accordion-up": "accordion-up 0.2s ease-out",
			// },
		},
		corePlugins: {
			preflight: false, // Correct for Obsidian plugins
		},
	},
};
