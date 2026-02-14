/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      serif: ['Outfit', 'ui-serif', 'Georgia', 'serif'],
      mono: ['ui-monospace', 'monospace'],
      heading: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {},
  },
  plugins: [],
}
