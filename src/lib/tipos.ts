export type Dieta = 'vegano' | 'vegetariano' | 'carta-vegana' | 'opciones';
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
  dieta: Dieta;
  cocina: string[];
  barrio: string;
  direccion: string;
  coords: { lat: number; lng: number; exactas: boolean } | null;
  telefono: string | null;
  web: string | null;
  carta: string | null;
  precio: 1 | 2 | 3;
  precioNota: string | null;
  horario: Partial<Record<Dia, Franja[]>>;
  resumen: string;
  destacados: string[];
  servicios: Servicio[];
  valoraciones: Valoracion[];
  enlaces: { happycow?: string };
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
  fuente: string | null;
  restaurantes: Record<string, { paradas: ParadaCercana[]; lineas: string[] }>;
}

/** Restaurante listo para pintar: con barrio, aparcamiento y bus ya resueltos. */
export interface RestauranteVista extends Restaurante {
  barrioNombre: string;
  aparcamiento: Barrio['aparcamiento'];
  bus: { paradas: ParadaCercana[]; lineas: string[] } | null;
  enlaceMaps: string;
}
