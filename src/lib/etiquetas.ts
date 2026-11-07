import type { Dia, Dieta, Servicio } from './tipos';

export const DIETAS: Record<Dieta, { nombre: string; corto: string; nivel: 1 | 2 | 3; descripcion: string }> = {
  vegano: {
    nombre: '100 % vegano',
    corto: 'Vegano',
    nivel: 3,
    descripcion: 'Todo lo que sirven es vegetal.',
  },
  vegetariano: {
    nombre: '100 % vegetariano',
    corto: 'Vegetariano',
    nivel: 3,
    descripcion: 'Sin carne ni pescado; puede llevar huevo o lácteos.',
  },
  'carta-vegana': {
    nombre: 'Carta vegetal amplia',
    corto: 'Carta vegetal',
    nivel: 2,
    descripcion: 'Sirven carne, pero buena parte de la carta es vegana o vegetariana.',
  },
  opciones: {
    nombre: 'Con opciones vegetales',
    corto: 'Opciones',
    nivel: 1,
    descripcion: 'Restaurante convencional con platos veganos o vegetarianos, o que se pueden adaptar.',
  },
};

export const SERVICIOS: Record<Servicio, string> = {
  terraza: 'Terraza',
  'para-llevar': 'Para llevar',
  domicilio: 'A domicilio',
  'pet-friendly': 'Admite perros',
  'sin-gluten': 'Sin gluten',
  accesible: 'Accesible',
  wifi: 'Wi-Fi',
};

export const PRECIOS: Record<1 | 2 | 3, string> = {
  1: 'Económico',
  2: 'Precio medio',
  3: 'Caro',
};

export const DIFICULTAD_APARCAR: Record<1 | 2 | 3, string> = {
  1: 'Fácil',
  2: 'Con paciencia',
  3: 'Difícil',
};

export const DIAS: Dia[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
export const NOMBRE_DIA: Record<Dia, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};
