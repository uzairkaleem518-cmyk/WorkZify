/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Baloo 2'", "sans-serif"],
        body: ["Inter", "-apple-system", "sans-serif"],
        urdu: ["'Noto Nastaliq Urdu'", "serif"],
      },
      colors: {
        // Truck-art inspired palette: teal (primary), marigold (accent/available),
        // rani-pink (highlight). Each has a CSS-variable-driven surface set so
        // light/dark mode share the same token names (see index.css).
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surface2: "rgb(var(--color-surface-2) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",

        teal: {
          50: "#eafaf9", 100: "#cdf2ef", 300: "#63c3bd", 400: "#3aa9a2",
          500: "#0E7C86", 600: "#0b6670", 700: "#095259",
        },
        marigold: {
          50: "#fff8ec", 100: "#ffedc7", 300: "#f7c46b", 400: "#f4ba52",
          500: "#F2A93B", 600: "#d68d21", 700: "#a86c15",
        },
        rani: {
          50: "#fdf0f5", 100: "#fbd7e4", 300: "#ec7fa5", 400: "#e15589",
          500: "#D6336C", 600: "#b12457", 700: "#8a1c44",
        },
      },
      boxShadow: {
        stamp: "0 1px 0 rgba(0,0,0,0.04), 0 6px 16px -4px rgba(14, 124, 134, 0.18)",
        "stamp-dark": "0 1px 0 rgba(0,0,0,0.2), 0 6px 20px -4px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};