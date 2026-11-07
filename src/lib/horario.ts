import type { Dia, Franja } from './tipos';
import { DIAS } from './etiquetas';

const aMin = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

/** Hora local de A Coruña, sea cual sea la zona del navegador. */
export function ahoraEnCoruna(fecha = new Date()): { dia: Dia; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const wd = partes.find((p) => p.type === 'weekday')!.value; // Mon, Tue…
  const h = Number(partes.find((p) => p.type === 'hour')!.value);
  const m = Number(partes.find((p) => p.type === 'minute')!.value);
  const mapa: Record<string, Dia> = {
    Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab', Sun: 'dom',
  };
  return { dia: mapa[wd], minutos: h * 60 + m };
}

function diaAnterior(dia: Dia): Dia {
  return DIAS[(DIAS.indexOf(dia) + 6) % 7];
}

export type Estado =
  | { abierto: true; cierra: string }
  | { abierto: false; abre: string | null; diaAbre: Dia | null };

/** ¿Está abierto ahora? Tiene en cuenta franjas que cruzan la medianoche. */
export function estadoAhora(horario: Partial<Record<Dia, Franja[]>>, fecha = new Date()): Estado {
  const { dia, minutos } = ahoraEnCoruna(fecha);

  for (const [ini, fin] of horario[dia] ?? []) {
    const a = aMin(ini);
    const c = aMin(fin);
    const cruza = c <= a;
    if (minutos >= a && (cruza || minutos < c)) return { abierto: true, cierra: fin };
  }
  // Franjas de ayer que se alargan pasada la medianoche
  for (const [ini, fin] of horario[diaAnterior(dia)] ?? []) {
    const a = aMin(ini);
    const c = aMin(fin);
    if (c <= a && minutos < c) return { abierto: true, cierra: fin };
  }

  // Próxima apertura (hoy o en los próximos 7 días)
  const hoy = DIAS.indexOf(dia);
  for (let i = 0; i < 7; i++) {
    const d = DIAS[(hoy + i) % 7];
    const franjas = [...(horario[d] ?? [])].sort((x, y) => aMin(x[0]) - aMin(y[0]));
    for (const [ini] of franjas) {
      if (i > 0 || aMin(ini) > minutos) return { abierto: false, abre: ini, diaAbre: d };
    }
  }
  return { abierto: false, abre: null, diaAbre: null };
}

export function formatearFranjas(franjas: Franja[] | undefined): string {
  if (!franjas || franjas.length === 0) return 'Cerrado';
  return franjas.map(([a, c]) => `${a}–${c}`).join(' y ');
}
