/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0b0c10",
          card: "rgba(22, 24, 37, 0.7)",
          purple: "#7b2cbf",
          indigo: "#4361ee",
          emerald: "#06d6a0",
          rose: "#ef476f",
          amber: "#ffd166"
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
