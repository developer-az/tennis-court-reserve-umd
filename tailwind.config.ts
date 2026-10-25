import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        terp: {
          red: "#E03A3E",
          gold: "#FFD520",
          black: "#1A1A1A",
          gray: "#707372",
        },
        paper: "#f3efe6",
        ink: "#1c1916",
        line: "#e4d9c8",
        card: "#fffdf8",
        open: "#e5f4ec",
        full: "#fde8e8",
        soon: "#fff4dc",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-sans)",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
