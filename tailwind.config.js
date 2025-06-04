// tailwind.config.js
import tailwindcssAnimate from "tailwindcss-animate";
import containerQueries from "@tailwindcss/container-queries";
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette";

// Custom color opacity plugin as per Obsidian Copilot
function colorOpacityPlugin({ matchUtilities, theme }) {
	const colorEntries = flattenColorPalette(theme("colors"));
	
	matchUtilities(
		{
			"bg": (value) => ({
				backgroundColor: `color-mix(in srgb, ${value} calc(var(--tw-bg-opacity) * 100%), transparent)`,
			}),
			"text": (value) => ({
				color: `color-mix(in srgb, ${value} calc(var(--tw-text-opacity) * 100%), transparent)`,
			}),
			"border": (value) => ({
				borderColor: `color-mix(in srgb, ${value} calc(var(--tw-border-opacity) * 100%), transparent)`,
			}),
			"outline": (value) => ({
				outlineColor: `color-mix(in srgb, ${value} calc(var(--tw-outline-opacity) * 100%), transparent)`,
			}),
			"ring": (value) => ({
				"--tw-ring-color": `color-mix(in srgb, ${value} calc(var(--tw-ring-opacity) * 100%), transparent)`,
			}),
			"divide": (value) => ({
				"& > * + *": {
					borderColor: `color-mix(in srgb, ${value} calc(var(--tw-divide-opacity) * 100%), transparent)`,
				},
			}),
		},
		{
			values: colorEntries,
			type: "color",
			modifiers: {
				0: "0%",
				5: "5%",
				10: "10%",
				15: "15%",
				20: "20%",
				25: "25%",
				30: "30%",
				35: "35%",
				40: "40%",
				45: "45%",
				50: "50%",
				55: "55%",
				60: "60%",
				65: "65%",
				70: "70%",
				75: "75%",
				80: "80%",
				85: "85%",
				90: "90%",
				95: "95%",
				100: "100%",
			},
		}
	);
}

/** @type {import("tailwindcss").Config} */
module.exports = {
	content: [
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/styles/tailwind.css",
	],
	darkMode: ["class"],
	corePlugins: {
		preflight: false, // CRITICAL: Disable preflight to avoid Obsidian conflicts
	},
	plugins: [tailwindcssAnimate, containerQueries, colorOpacityPlugin],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			colors: {
				// Core semantic colors mapped to Obsidian CSS variables
				background: "var(--background-primary)",
				foreground: "var(--text-normal)",
				
				// shadcn/ui color scheme
				card: {
					DEFAULT: "var(--background-primary)",
					foreground: "var(--text-normal)",
				},
				popover: {
					DEFAULT: "var(--background-secondary)",
					foreground: "var(--text-normal)",
				},
				primary: {
					DEFAULT: "var(--interactive-accent)",
					foreground: "var(--text-on-accent)",
				},
				secondary: {
					DEFAULT: "var(--background-secondary)",
					foreground: "var(--text-normal)",
				},
				muted: {
					DEFAULT: "var(--background-modifier-hover)",
					foreground: "var(--text-muted)",
				},
				accent: {
					DEFAULT: "var(--text-accent)",
					foreground: "var(--text-on-accent)",
				},
				destructive: {
					DEFAULT: "var(--text-error)",
					foreground: "var(--text-on-accent)",
				},
				
				// UI element colors
				border: "var(--background-modifier-border)",
				input: "var(--background-modifier-form-field)",
				ring: "var(--interactive-accent)",
				
				// Obsidian semantic colors
				success: {
					DEFAULT: "var(--text-success)",
					background: "var(--background-modifier-success)",
				},
				warning: {
					DEFAULT: "var(--text-warning)",
					background: "var(--background-modifier-message)",
				},
				error: {
					DEFAULT: "var(--text-error)",
					background: "var(--background-modifier-error)",
				},
				
				// Base color palette
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
				
				// Obsidian color variables
				red: "var(--color-red)",
				orange: "var(--color-orange)",
				yellow: "var(--color-yellow)",
				green: "var(--color-green)",
				cyan: "var(--color-cyan)",
				blue: "var(--color-blue)",
				purple: "var(--color-purple)",
				pink: "var(--color-pink)",
			},
			backgroundColor: {
				// Extended Obsidian background variables
				"primary-alt": "var(--background-primary-alt)",
				"secondary-alt": "var(--background-secondary-alt)",
				"modifier-hover": "var(--background-modifier-hover)",
				"modifier-active-hover": "var(--background-modifier-active-hover)",
				"modifier-border": "var(--background-modifier-border)",
				"modifier-border-hover": "var(--background-modifier-border-hover)",
				"modifier-border-focus": "var(--background-modifier-border-focus)",
				"modifier-error": "var(--background-modifier-error)",
				"modifier-error-hover": "var(--background-modifier-error-hover)",
				"modifier-success": "var(--background-modifier-success)",
				"modifier-message": "var(--background-modifier-message)",
				"modifier-form-field": "var(--background-modifier-form-field)",
			},
			textColor: {
				// Extended Obsidian text colors
				normal: "var(--text-normal)",
				muted: "var(--text-muted)",
				faint: "var(--text-faint)",
				accent: "var(--text-accent)",
				"accent-hover": "var(--text-accent-hover)",
				"on-accent": "var(--text-on-accent)",
				error: "var(--text-error)",
				success: "var(--text-success)",
				warning: "var(--text-warning)",
				selection: "var(--text-selection)",
			},
			borderRadius: {
				lg: "var(--radius-l)",
				md: "var(--radius-m)",
				sm: "var(--radius-s)",
				xl: "var(--radius-xl)",
			},
			fontFamily: {
				sans: ["var(--font-interface)", "sans-serif"],
				mono: ["var(--font-monospace)", "monospace"],
			},
			fontSize: {
				// Obsidian font sizes
				smallest: "var(--font-smallest)",
				smaller: "var(--font-smaller)",
				small: "var(--font-small)",
				"ui-smaller": "var(--font-ui-smaller)",
				"ui-small": "var(--font-ui-small)",
				"ui-medium": "var(--font-ui-medium)",
				"ui-larger": "var(--font-ui-larger)",
			},
			spacing: {
				// Obsidian spacing scale
				1: "var(--size-4-1)",
				2: "var(--size-4-2)",
				3: "var(--size-4-3)",
				4: "var(--size-4-4)",
				5: "var(--size-4-5)",
				6: "var(--size-4-6)",
				8: "var(--size-4-8)",
				12: "var(--size-4-12)",
				16: "var(--size-4-16)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
};