/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        guardian: {
          bg: "#0b0e17",
          panel: "#121729",
          border: "#232a44",
          blue: "#4f6df5",
          purple: "#8b5cf6",
          accent: "#38bdf8",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};
