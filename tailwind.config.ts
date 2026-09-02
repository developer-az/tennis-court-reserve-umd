import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        terp: {
          red: "#E03A3E",
          gold: "#FFD520",
          black: "#151515",
          gray: "#707372",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
