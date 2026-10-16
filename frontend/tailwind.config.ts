import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0B1210",
          900: "#11201A",
          800: "#16261F",
        },
        ink: {
          100: "#F3F6F4",
          300: "#B8C7C0",
          400: "#8FA79C",
          500: "#6E8A7E",
          600: "#546E62",
        },
        emerald: {
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
        },
        status: {
          nominal: "#34D399",
          advisory: "#F5A524",
          critical: "#F2545B",
          renewable: "#38BDF8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
