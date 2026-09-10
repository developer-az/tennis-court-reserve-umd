import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F4F1EA",
        mute: "#9AA397",
        line: "rgba(244,241,234,0.12)",
        court: {
          bg: "#0E1411",
          raised: "#151C18",
          soft: "#1B241F",
        },
        terp: {
          red: "#E03A3E",
          gold: "#F0C419",
          black: "#0E1411",
          gray: "#707372",
        },
        open: "#3FA56A",
        full: "#C45B5E",
        soon: "#D4A017",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        lift: "0 18px 50px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(240,196,25,0.25)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.45s ease-out both",
        "rise-delay": "rise 0.55s ease-out 0.08s both",
        fade: "fade 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
