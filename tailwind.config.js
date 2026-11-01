/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './constants.tsx',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Jost', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Utilities resolve to the same PS2 blue ramp as the CSS tokens, so the
      // interface never drifts into Tailwind's default blue.
      colors: {
        blue: {
          50: '#f4f9ff',
          100: '#dcecff',
          200: '#c3d8f6',
          300: '#93b4dd',
          400: '#6ea8ff',
          500: '#4f8ae0',
          600: '#3c6fbd',
          700: '#2d5596',
          800: '#1f3d70',
          900: '#12294c',
          950: '#081326',
        },
        cyan: {
          200: '#bfe6ff',
          300: '#9bd9ff',
          400: '#6ec6ff',
        },
      },
    },
  },
  plugins: [],
};
