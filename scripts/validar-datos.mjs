// Comprueba que restaurantes.json es coherente antes de compilar.
// Uso: npm run data:validar
import { readFileSync } from 'node:fs';

const leer = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const restaurantes = leer('../src/data/restaurantes.json');
const barrios = leer('../src/data/barrios.json');

const DIETAS = ['vegano', 'vegetariano', 'carta-vegana', 'opciones'];
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const SERVICIOS = ['terraza', 'para-llevar', 'domicilio', 'pet-friendly', 'sin-gluten', 'accesible', 'wifi'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Caja aproximada del término municipal de A Coruña
const CAJA = { latMin: 43.32, latMax: 43.4, lngMin: -8.47, lngMax: -8.36 };

const errores = [];
const ids = new Set();

for (const r of restaurantes) {
  const e = (msg) => errores.push(`${r.id ?? '(sin id)'}: ${msg}`);
  if (!/^[a-z0-9-]+$/.test(r.id ?? '')) e('id debe ser kebab-case');
  if (ids.has(r.id)) e('id repetido');
  ids.add(r.id);
  for (const campo of ['nombre', 'direccion', 'resumen']) if (!r[campo]) e(`falta ${campo}`);
  if (!DIETAS.includes(r.dieta)) e(`dieta desconocida "${r.dieta}"`);
  if (!barrios[r.barrio]) e(`barrio desconocido "${r.barrio}"`);
  if (![1, 2, 3].includes(r.precio)) e('precio debe ser 1, 2 o 3');
  if (r.telefono && !/^\+\d{11,12}$/.test(r.telefono)) e(`teléfono con formato raro: ${r.telefono}`);
  for (const url of [r.web, r.carta, r.enlaces?.happycow]) if (url && !/^https:\/\//.test(url)) e(`URL no https: ${url}`);
  for (const s of r.servicios ?? []) if (!SERVICIOS.includes(s)) e(`servicio desconocido "${s}"`);
  if (r.coords) {
    const { lat, lng } = r.coords;
    if (lat < CAJA.latMin || lat > CAJA.latMax || lng < CAJA.lngMin || lng > CAJA.lngMax) e('coordenadas fuera de A Coruña');
  }
  for (const [dia, franjas] of Object.entries(r.horario ?? {})) {
    if (!DIAS.includes(dia)) e(`día desconocido "${dia}"`);
    for (const f of franjas) if (f.length !== 2 || !HORA.test(f[0]) || !HORA.test(f[1])) e(`franja inválida en ${dia}: ${f}`);
  }
  for (const v of r.valoraciones ?? []) if (v.nota > v.max) e(`nota ${v.nota} mayor que el máximo ${v.max}`);
}

const sinCoords = restaurantes.filter((r) => !r.coords).map((r) => r.id);
const aprox = restaurantes.filter((r) => r.coords && !r.coords.exactas).length;

if (errores.length) {
  console.error(`✗ ${errores.length} problema(s) en los datos:\n  ${errores.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${restaurantes.length} restaurantes válidos.`);
if (sinCoords.length) console.log(`  · Sin coordenadas (${sinCoords.length}): ${sinCoords.join(', ')}`);
if (aprox) console.log(`  · Con coordenadas aproximadas: ${aprox}. Ejecuta \`npm run data:geocodificar\` para afinarlas.`);
