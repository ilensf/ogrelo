import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

// https://docs.astro.build/
export default defineConfig({
  integrations: [vue()],
  // Dominio de producción (sirve para el sitemap y las URLs canónicas).
  site: 'https://ogrelo.es',
});
