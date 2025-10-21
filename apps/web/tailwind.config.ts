import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/layout/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F4C81",
          dark: "#0B365F"
        },
        secondary: "#F2A900",
        accent: "#2EBFA5",
        warning: "#F5B13D",
        error: "#D64545"
      },
      fontFamily: {
        sans: ["Pretendard", "Noto Sans KR", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
