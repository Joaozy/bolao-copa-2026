/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Garante que o Tailwind olhe para todos os arquivos dentro de src
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    
    // Fallbacks para caso você tenha arquivos na raiz
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}