/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lumina: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9', // Sky Blue
          600: '#0284c7',
          900: '#0c4a6e',
        },
        accent: {
          pink: '#f472b6',
          purple: '#c084fc',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1))',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};
