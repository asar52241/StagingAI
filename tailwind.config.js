/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Avenir Next"', '"SF Pro Text"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 22px 45px -26px rgba(15, 23, 42, 0.32)",
        panel: "0 14px 28px -20px rgba(15, 23, 42, 0.3)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(1200px 420px at 0% -10%, rgba(14, 165, 233, 0.14), transparent 55%), radial-gradient(900px 340px at 100% -20%, rgba(56, 189, 248, 0.16), transparent 58%)",
      },
    },
  },
  plugins: [],
};
