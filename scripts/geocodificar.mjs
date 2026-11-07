// Afina las coordenadas de los restaurantes que no las tienen o las tienen aproximadas,
// usando Nominatim (OpenStreetMap). Respeta su política de uso: 1 petición por segundo
// y un User-Agent que identifique la aplicación.
//
// Uso:  npm run data:geocodificar            (solo los que faltan o son aproximados)
//       npm run data:geocodificar -- --todos (todos)
//
// Revisa siempre el resultado en el mapa: Nominatim acierta la calle, pero el número de portal
// no siempre está en OpenStreetMap. Cuando solo encuentra la calle, el script deja `exactas: false`.
import { readFileSync, writeFileSync } from 'node:fs';

const RUTA = new URL('../src/data/restaurantes.json', import.meta.url);
const UA = 'veggiecoruna-guia/0.1 (proyecto personal)';
const todos = process.argv.includes('--todos');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const restaurantes = JSON.parse(readFileSync(RUTA, 'utf8'));
let cambios = 0;

for (const r of restaurantes) {
  if (!todos && r.coords?.exactas) continue;

  // Quitamos aclaraciones entre paréntesis para no confundir al geocodificador
  const direccion = r.direccion.replace(/\(.*?\)/g, '').replace(/\s+,/g, ',');
  const consulta = direccion.includes('Coruña') ? direccion : `${direccion}, A Coruña`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: consulta, format: 'jsonv2', limit: '1', countrycodes: 'es', addressdetails: '1' });

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const [hit] = await res.json();
    if (!hit) {
      console.log(`?  ${r.id}: sin resultado para "${consulta}"`);
    } else {
      const exactas = Boolean(hit.address?.house_number);
      r.coords = { lat: Number(Number(hit.lat).toFixed(6)), lng: Number(Number(hit.lon).toFixed(6)), exactas };
      cambios++;
      console.log(`${exactas ? '✓' : '~'}  ${r.id}: ${r.coords.lat}, ${r.coords.lng}${exactas ? '' : ' (solo la calle)'}`);
    }
  } catch (err) {
    console.log(`✗  ${r.id}: ${err.message}`);
  }
  await espera(1100);
}

writeFileSync(RUTA, JSON.stringify(restaurantes, null, 2) + '\n');
console.log(`\n${cambios} restaurantes actualizados en src/data/restaurantes.json`);
