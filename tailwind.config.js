/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/**/*.scss"
  ],
  prefix: 'tw-', // Prevent conflicts with Obsidian styles
  corePlugins: {
    preflight: false, // Disable reset to preserve Obsidian styles
  },
  theme: {
    extend: {
      colors: {
        // Map Obsidian CSS variables to Tailwind
        'obsidian': {
          'bg-primary': 'var(--background-primary)',
          'bg-secondary': 'var(--background-secondary)',
          'bg-secondary-alt': 'var(--background-secondary-alt)',
          'bg-modifier-border': 'var(--background-modifier-border)',
          'bg-modifier-border-hover': 'var(--background-modifier-border-hover)',
          'bg-modifier-hover': 'var(--background-modifier-hover)',
          'bg-modifier-accent': 'var(--background-modifier-accent)',
          'text-normal': 'var(--text-normal)',
          'text-muted': 'var(--text-muted)',
          'text-faint': 'var(--text-faint)',
          'text-on-accent': 'var(--text-on-accent)',
          'text-error': 'var(--text-error)',
          'interactive-accent': 'var(--interactive-accent)',
        }
      },
      borderRadius: {
        'obsidian-s': 'var(--radius-s)',
        'obsidian-m': 'var(--radius-m)', 
        'obsidian-l': 'var(--radius-l)',
      },
      boxShadow: {
        'obsidian-s': 'var(--shadow-s)',
        'obsidian-l': 'var(--shadow-l)',
      },
      fontSize: {
        'obsidian-ui-medium': 'var(--font-ui-medium)',
      },
      spacing: {
        'obsidian-xs': '4px',
        'obsidian-sm': '8px',
        'obsidian-md': '12px',
        'obsidian-lg': '16px',
        'obsidian-xl': '24px',
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
}