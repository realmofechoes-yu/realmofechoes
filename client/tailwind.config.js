/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#121212',
          surface: '#1e1e24',
          border: '#333333'
        },
        primary: {
          DEFAULT: '#9d4edd',
          hover: '#7b2cbf'
        },
        health: '#e63946',
        mana: '#4cc9f0',
        stamina: '#ffd166',
        gold: '#ffb703'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'serif']
      }
    },
  },
  plugins: [],
}
