/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          tint: "var(--accent-tint)",
          fg: "var(--accent-fg)",
        },
        positive: {
          DEFAULT: "var(--positive)",
          tint: "var(--positive-tint)",
          border: "color-mix(in srgb, var(--positive) 22%, transparent)",
        },
        negative: {
          DEFAULT: "var(--negative)",
          tint: "var(--negative-tint)",
          border: "color-mix(in srgb, var(--negative) 22%, transparent)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          tint: "var(--warning-tint)",
          border: "color-mix(in srgb, var(--warning) 22%, transparent)",
        },
        pending: {
          DEFAULT: "var(--pending)",
          tint: "var(--pending-tint)",
          border: "color-mix(in srgb, var(--pending) 22%, transparent)",
        },
        info: {
          DEFAULT: "var(--info)",
          tint: "var(--info-tint)",
          border: "color-mix(in srgb, var(--info) 22%, transparent)",
        },
        
        // Backward compatibility
        sidebar: "var(--sidebar-bg)",
        card: "var(--card-bg)",
        textPrimary: "var(--text)",
        textSecondary: "var(--text-secondary)",
        textMuted: "var(--text-muted)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        full: "var(--r-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ['var(--font)', 'sans-serif'],
      },
      animation: {
        fade: "fl-fade var(--dur-base) var(--ease-out) both",
        rise: "fl-rise var(--dur-base) var(--ease-out) both",
        scale: "fl-scale-in var(--dur-base) var(--ease-out) both",
      },
      transitionTimingFunction: {
        "out": "var(--ease-out)",
        "in": "var(--ease-in)",
      },
      transitionDuration: {
        "fast": "var(--dur-fast)",
        "base": "var(--dur-base)",
        "slow": "var(--dur-slow)",
      }
    },
  },
  plugins: [],
};
