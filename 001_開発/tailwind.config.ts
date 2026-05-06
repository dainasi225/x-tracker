import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        x: {
          black: "#000000",
          dark: "#15202b",
          blue: "#1d9bf0",
          gray: "#71767b",
          border: "#2f3336",
        },
      },
    },
  },
  plugins: [],
};

export default config;
