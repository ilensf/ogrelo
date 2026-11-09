export type Dieta = 'vegano' | 'vegetariano' | 'carta-vegana' | 'buenas-opciones' | 'alguna-opcion';
export type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
/** Franja horaria ["HH:MM", "HH:MM"]. Si el cierre es menor que la apertura, cruza la medianoche. */
export type Franja = [string, string];
export type Servicio =
  | 'terraza' | 'para-llevar' | 'domicilio' | 'pet-friendly' | 'sin-gluten' | 'accesible' | 'wifi';

export interface Valoracion {
  fuente: string;
  nota: number;
  max: number;
  resenas?: number;
}

export interface Restaurante {
  id: string;
  nombre: string;
  /** Clave de ciudades.json. */
  ciudad: string;
  dieta: Dieta;
  cocina: string[];
  /** Clave de barrios.json, o null en las ciudades sin barrios definidos. */
  barrio: string | null;
  direccion: string;
  coords: { lat: number; lng: number; exactas: boolean } | null;
  telefono: string | null;
  web: string | null;
  carta: string | null;
  /** null si aún no se conoce. */
  precio: 1 | 2 | 3 | null;
  precioNota: string | null;
  horario: Partial<Record<Dia, Franja[]>>;
  resumen: string;
  destacados: string[];
  servicios: Servicio[];
  valoraciones: Valoracion[];
  enlaces: { happycow?: string };
  /** Ficha preparada a partir de fuentes web y aún sin confirmar con el local. No se muestra en la web. */
  borrador?: boolean;
}

export interface Ciudad {
  nombre: string;
  provincia: string;
  centro: { lat: number; lng: number };
  gtfs: { url: string; fuente: Record<'es' | 'gl', string> } | null;
}

export interface Barrio {
  nombre: string;
  aparcamiento: { dificultad: 1 | 2 | 3; nota: string; parkings: string[] };
}

export interface ParadaCercana {
  nombre: string;
  distancia: number; // metros
  lineas: string[];
}

export interface Transporte {
  generado: string | null;
  /** Fuente de los datos de bus de cada ciudad. */
  fuentes: Record<string, string>;
  restaurantes: Record<string, { paradas: ParadaCercana[]; lineas: string[] }>;
}

/** Restaurante listo para pintar: con ciudad, barrio, aparcamiento y bus ya resueltos. */
export interface RestauranteVista extends Restaurante {
  ciudadNombre: string;
  barrioNombre: string | null;
  aparcamiento: Barrio['aparcamiento'] | null;
  bus: { paradas: ParadaCercana[]; lineas: string[] } | null;
  enlaceMaps: string;
}
