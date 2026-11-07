import type { APIRoute } from 'astro';
import { obtenerRestaurantes } from '../lib/datos';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const rutas = ['', 'acerca/', ...obtenerRestaurantes().map((r) => `restaurante/${r.id}/`)];
  const urls = rutas.map((r) => `  <url><loc>${new URL(base + r, site).href}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
