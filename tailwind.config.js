/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '375px',   // iPhone SE
        'sm': '640px',   // iPad mini / large phones
        'md': '768px',   // iPad
        'lg': '1024px',  // iPad Pro / desktop
        'xl': '1280px',  // large desktop
      },
      colors: {
        accent: '#FF5C00',
      },
      fontFamily: {
        sans:     ['"Plus Jakarta Sans"', 'DM Sans', 'system-ui', 'sans-serif'],
        display:  ['Syne', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      maxWidth: {
        content: '520px',
        barber:  '720px',
      },
    },
  },
  plugins: [],
}
