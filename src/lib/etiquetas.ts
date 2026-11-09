import type { Dia, Dieta, Servicio } from './tipos';

/** Orden de los tipos de sitio, de más a menos vegetal. Los textos están en src/i18n. */
export const DIETAS: Dieta[] = ['vegano', 'vegetariano', 'carta-vegana', 'buenas-opciones', 'alguna-opcion'];

/** Hojas llenas del medidor para cada tipo de sitio. */
export const NIVEL_DIETA: Record<Dieta, 1 | 2 | 3 | 4> = {
  vegano: 4,
  vegetariano: 4,
  'carta-vegana': 3,
  'buenas-opciones': 2,
  'alguna-opcion': 1,
};

export const SERVICIOS: Servicio[] = ['terraza', 'para-llevar', 'domicilio', 'pet-friendly', 'sin-gluten', 'accesible', 'wifi'];

export const DIAS: Dia[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
