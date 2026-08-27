// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Poppins",
      cssVariable: "--font-poppins",
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    },
  ],
});
