// Comprueba que restaurantes.json es coherente antes de compilar.
// Uso: npm run data:validar
import { readFileSync } from 'node:fs';

const leer = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const restaurantes = leer('../src/data/restaurantes.json');
const barrios = leer('../src/data/barrios.json');
const ciudades = leer('../src/data/ciudades.json');

const DIETAS = ['vegano', 'vegetariano', 'carta-vegana', 'buenas-opciones', 'alguna-opcion'];
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const SERVICIOS = ['terraza', 'para-llevar', 'domicilio', 'pet-friendly', 'sin-gluten', 'accesible', 'wifi'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Distancia máxima al centro de su ciudad: detecta direcciones mal geocodificadas.
const RADIO_CIUDAD_KM = 25;

function distanciaKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const errores = [];
const ids = new Set();

for (const r of restaurantes) {
  const e = (msg) => errores.push(`${r.id ?? '(sin id)'}: ${msg}`);
  if (!/^[a-z0-9-]+$/.test(r.id ?? '')) e('id debe ser kebab-case');
  if (ids.has(r.id)) e('id repetido');
  ids.add(r.id);
  for (const campo of ['nombre', 'direccion', 'resumen']) if (!r[campo]) e(`falta ${campo}`);
  if (!DIETAS.includes(r.dieta)) e(`dieta desconocida "${r.dieta}"`);
  const ciudad = ciudades[r.ciudad];
  if (!ciudad) e(`ciudad desconocida "${r.ciudad}"`);
  if (r.barrio !== null && !barrios[r.barrio]) e(`barrio desconocido "${r.barrio}"`);
  if (![1, 2, 3, null].includes(r.precio)) e('precio debe ser 1, 2, 3 o null');
  if (r.telefono && !/^\+\d{11,12}$/.test(r.telefono)) e(`teléfono con formato raro: ${r.telefono}`);
  for (const url of [r.web, r.carta, r.enlaces?.happycow]) if (url && !/^https:\/\//.test(url)) e(`URL no https: ${url}`);
  for (const s of r.servicios ?? []) if (!SERVICIOS.includes(s)) e(`servicio desconocido "${s}"`);
  if (r.coords && ciudad && distanciaKm(r.coords, ciudad.centro) > RADIO_CIUDAD_KM) {
    e(`coordenadas a más de ${RADIO_CIUDAD_KM} km de ${ciudad.nombre}`);
  }
  for (const [dia, franjas] of Object.entries(r.horario ?? {})) {
    if (!DIAS.includes(dia)) e(`día desconocido "${dia}"`);
    for (const f of franjas) if (f.length !== 2 || !HORA.test(f[0]) || !HORA.test(f[1])) e(`franja inválida en ${dia}: ${f}`);
  }
  for (const v of r.valoraciones ?? []) if (v.nota > v.max) e(`nota ${v.nota} mayor que el máximo ${v.max}`);
}

const sinCoords = restaurantes.filter((r) => !r.coords).map((r) => r.id);
const aprox = restaurantes.filter((r) => r.coords && !r.coords.exactas).length;
const borradores = restaurantes.filter((r) => r.borrador).map((r) => r.id);

// Traducciones al gallego: las que falten se muestran en castellano.
const gl = leer('../src/data/restaurantes.gl.json');
const sinGallego = restaurantes.filter((r) => !gl[r.id]?.resumen).map((r) => r.id);
const huerfanos = Object.keys(gl).filter((id) => !ids.has(id));
for (const id of huerfanos) errores.push(`${id}: traducción de un restaurante que no existe`);
for (const r of restaurantes) {
  if (gl[r.id] && (gl[r.id].destacados?.length ?? r.destacados.length) !== r.destacados.length) errores.push(`${r.id}: destacados con distinto número en gallego`);
}

if (errores.length) {
  console.error(`✗ ${errores.length} problema(s) en los datos:\n  ${errores.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${restaurantes.length} restaurantes válidos.`);
if (sinCoords.length) console.log(`  · Sin coordenadas (${sinCoords.length}): ${sinCoords.join(', ')}`);
if (aprox) console.log(`  · Con coordenadas aproximadas: ${aprox}. Ejecuta \`npm run data:geocodificar\` para afinarlas.`);
if (borradores.length) console.log(`  · Sin confirmar con el local (${borradores.length}): ${borradores.join(', ')}`);
if (sinGallego.length) console.log(`  · Sin traducir al gallego (${sinGallego.length}): ${sinGallego.join(', ')}`);
