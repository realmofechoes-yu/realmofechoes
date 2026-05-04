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
          bg: '#05050A', // Even darker for better contrast
          surface: '#11111A',
          border: '#2A2A3D',
          hover: '#1A1A28'
        },
        primary: {
          DEFAULT: '#9d4edd',
          hover: '#7b2cbf',
          glow: 'rgba(157, 78, 221, 0.4)'
        },
        health: {
          DEFAULT: '#e63946',
          glow: 'rgba(230, 57, 70, 0.4)'
        },
        mana: {
          DEFAULT: '#4cc9f0',
          glow: 'rgba(76, 201, 240, 0.4)'
        },
        gold: {
          DEFAULT: '#ffb703',
          bright: '#ffbe0b',
          dim: '#a07830',
          glow: 'rgba(255, 183, 3, 0.4)'
        },
        class: {
          warrior: '#ff4d4d',
          mage: '#8c52ff',
          ranger: '#2ed573'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
        title: ['Cinzel', 'serif'] // A classic fantasy font fallback
      },
      boxShadow: {
        'glow-gold': '0 0 15px rgba(255, 183, 3, 0.3)',
        'glow-primary': '0 0 15px rgba(157, 78, 221, 0.3)',
        'glow-health': '0 0 15px rgba(230, 57, 70, 0.3)',
        'glow-mana': '0 0 15px rgba(76, 201, 240, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-panel': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))'
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
