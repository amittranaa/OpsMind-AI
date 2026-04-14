/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: "#0f172a",
          panel: "#111c34",
          panelAlt: "#14213d",
          indigo: "#6366f1",
          green: "#22c55e",
          purple: "#a855f7",
        },
      },
      boxShadow: {
        card: "0 10px 30px rgba(2, 6, 23, 0.35)",
      },
      borderRadius: {
        xl2: "1rem",
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-in",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
