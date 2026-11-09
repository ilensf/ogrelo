import { es, type Textos } from './es';
import { gl } from './gl';

export type Idioma = 'gl' | 'es';
export type { Textos };

export const IDIOMAS: Idioma[] = ['gl', 'es'];
export const IDIOMA_DEFECTO: Idioma = 'gl';

const TEXTOS: Record<Idioma, Textos> = { gl, es };

export const textos = (idioma: Idioma): Textos => TEXTOS[idioma];

/** Raíz de las URLs de un idioma: el idioma por defecto no lleva prefijo. */
export const raizIdioma = (base: string, idioma: Idioma): string =>
  idioma === IDIOMA_DEFECTO ? base : `${base}${idioma}/`;

export const etiquetaCocina = (t: Textos, cocina: string): string => {
  const c = t.cocinas[cocina] ?? cocina;
  return c[0].toUpperCase() + c.slice(1);
};
