/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['var(--font-questrial)', 'Questrial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      serif: ['var(--font-questrial)', 'Questrial', 'ui-serif', 'Georgia', 'serif'],
      mono: ['ui-monospace', 'monospace'],
      heading: ['var(--font-space-grotesk)', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        'brand-dark': '#14151c',
        'brand-blue': '#69a3ff',
        'brand-gray': '#f2f4f7',
        'brand-anthracite': '#1e1d2c',
      },
    },
  },
  plugins: [],
}
