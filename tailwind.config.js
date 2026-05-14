/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f1a',
        card: 'rgba(255,255,255,0.03)',
        'card-border': 'rgba(255,255,255,0.06)',
        flash: '#3b82f6',
        pro: '#8b5cf6',
        accent: '#f59e0b',
        success: '#22c55e',
        danger: '#ef4444',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
