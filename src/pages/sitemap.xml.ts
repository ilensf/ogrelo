import type { APIRoute } from 'astro';
import { IDIOMAS, raizIdioma } from '../i18n';
import { obtenerCiudades, obtenerRestaurantes } from '../lib/datos';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const rutas = [
    '',
    'acerca/',
    ...obtenerCiudades().map((c) => `${c.id}/`),
    ...obtenerRestaurantes('gl').map((r) => `restaurante/${r.id}/`),
  ];
  const urls = IDIOMAS.flatMap((i) => rutas.map((r) => `  <url><loc>${new URL(raizIdioma(base, i) + r, site).href}</loc></url>`)).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
