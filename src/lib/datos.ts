import restaurantesJson from '../data/restaurantes.json';
import barriosJson from '../data/barrios.json';
import transporteJson from '../data/transporte.json';
import type { Barrio, Restaurante, RestauranteVista, Transporte } from './tipos';

const restaurantes = restaurantesJson as Restaurante[];
const barrios = barriosJson as Record<string, Barrio>;
const transporte = transporteJson as unknown as Transporte;

function enlaceGoogleMaps(r: Restaurante): string {
  const q = encodeURIComponent(`${r.nombre}, ${r.direccion}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function obtenerRestaurantes(): RestauranteVista[] {
  return restaurantes
    .map((r) => {
      const barrio = barrios[r.barrio];
      if (!barrio) throw new Error(`Barrio desconocido "${r.barrio}" en ${r.id}`);
      return {
        ...r,
        barrioNombre: barrio.nombre,
        aparcamiento: barrio.aparcamiento,
        bus: transporte.restaurantes[r.id] ?? null,
        enlaceMaps: enlaceGoogleMaps(r),
      };
    })
    .sort((a, b) => {
      const orden = { vegano: 0, vegetariano: 1, 'carta-vegana': 2, opciones: 3 };
      return orden[a.dieta] - orden[b.dieta] || a.nombre.localeCompare(b.nombre, 'es');
    });
}

export function infoTransporte() {
  return { generado: transporte.generado, fuente: transporte.fuente };
}

export function formatearTelefono(tel: string): string {
  const d = tel.replace(/^\+34/, '');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : tel;
}
