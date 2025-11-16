import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class', // Use class-based dark mode (but we won't add the class)
  // This prevents Tailwind from using media queries for dark mode
};

export default config;

