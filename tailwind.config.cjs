/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,svelte,ts}', // <- include all Svelte files
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms')],
};
