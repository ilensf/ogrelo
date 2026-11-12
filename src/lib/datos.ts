import restaurantesJson from '../data/restaurantes.json';
import restaurantesGlJson from '../data/restaurantes.gl.json';
import barriosJson from '../data/barrios.json';
import barriosGlJson from '../data/barrios.gl.json';
import ciudadesJson from '../data/ciudades.json';
import transporteJson from '../data/transporte.json';
import type { Idioma } from '../i18n';
import { esTienda } from './etiquetas';
import type { Barrio, Ciudad, Dieta, Restaurante, RestauranteVista, Transporte } from './tipos';

const restaurantes = restaurantesJson as Restaurante[];
const barrios = barriosJson as Record<string, Barrio>;
const ciudades = ciudadesJson as Record<string, Ciudad>;
const transporte = transporteJson as unknown as Transporte;

/** Traducciones al gallego; lo que falte se muestra en castellano, el idioma de los datos. */
const restaurantesGl = restaurantesGlJson as Record<string, Partial<Pick<Restaurante, 'resumen' | 'destacados' | 'precioNota'>>>;
const barriosGl = barriosGlJson as Record<string, { nombre: string; nota: string }>;

const ORDEN_DIETA: Record<Dieta, number> = {
  vegano: 0,
  vegetariano: 1,
  'carta-vegana': 2,
  'buenas-opciones': 3,
  'alguna-opcion': 4,
  'tienda-vegana': 5,
  'tienda-opciones': 6,
};

function enlaceGoogleMaps(r: Restaurante): string {
  const q = encodeURIComponent(`${r.nombre}, ${r.direccion}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Todos los restaurantes en el idioma pedido, o solo los de una ciudad. */
export function obtenerRestaurantes(idioma: Idioma, ciudad?: string): RestauranteVista[] {
  return restaurantes
    .filter((r) => !ciudad || r.ciudad === ciudad)
    .map((r) => {
      const c = ciudades[r.ciudad];
      if (!c) throw new Error(`Ciudad desconocida "${r.ciudad}" en ${r.id}`);
      const barrio = r.barrio ? barrios[r.barrio] : null;
      if (r.barrio && !barrio) throw new Error(`Barrio desconocido "${r.barrio}" en ${r.id}`);
      const barrioGl = idioma === 'gl' && r.barrio ? barriosGl[r.barrio] : undefined;
      return {
        ...r,
        ...(idioma === 'gl' ? restaurantesGl[r.id] : undefined),
        ciudadNombre: c.nombre,
        barrioNombre: barrioGl?.nombre ?? barrio?.nombre ?? null,
        aparcamiento: barrio ? { ...barrio.aparcamiento, nota: barrioGl?.nota ?? barrio.aparcamiento.nota } : null,
        bus: transporte.restaurantes[r.id] ?? null,
        enlaceMaps: enlaceGoogleMaps(r),
      };
    })
    .sort((a, b) => ORDEN_DIETA[a.dieta] - ORDEN_DIETA[b.dieta] || a.nombre.localeCompare(b.nombre, idioma));
}

/** Ciudades con algún restaurante, por orden alfabético. */
export function obtenerCiudades(): { id: string; nombre: string; total: number }[] {
  return Object.entries(ciudades)
    .map(([id, c]) => ({ id, nombre: c.nombre, total: restaurantes.filter((r) => r.ciudad === id && !esTienda(r.dieta)).length }))
    .filter((c) => c.total > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'gl'));
}

/** Fuente de los datos de bus de una ciudad, o null si aún no los tiene. */
export function fuenteTransporte(ciudad: string, idioma: Idioma): string | null {
  const fuente = transporte.fuentes[ciudad];
  if (!fuente) return null;
  return ciudades[ciudad].gtfs?.fuente[idioma] ?? fuente;
}

export function formatearTelefono(tel: string): string {
  const d = tel.replace(/^\+34/, '');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : tel;
}
