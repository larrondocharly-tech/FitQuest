import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        quest: {
          bg: '#0a0f1f',
          card: '#121a31',
          accent: '#7c3aed'
        }
      }
    }
  },
  plugins: []
};

export default config;
