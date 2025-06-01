module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Obsidian-specific color variables
        'accent': 'var(--interactive-accent)',
        'accent-hover': 'var(--interactive-accent-hover)',
        'background-primary': 'var(--background-primary)',
        'background-secondary': 'var(--background-secondary)',
        'background-modifier-border': 'var(--background-modifier-border)',
        'text-normal': 'var(--text-normal)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
      }
    },
  },
  plugins: [],
}
