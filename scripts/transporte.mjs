// Calcula las paradas de bus urbano y las líneas que hay cerca de cada restaurante,
// a partir del GTFS oficial de la Compañía de Tranvías de La Coruña.
//
// Uso:
//   npm run data:transporte                          descarga el GTFS de Mobility Database
//   npm run data:transporte -- ruta/al/gtfs.zip      usa un ZIP que ya tengas
//   npm run data:transporte -- --url https://…zip    otra URL de descarga
//
// El feed también está en el Punto de Acceso Nacional (nap.transportes.gob.es, requiere registro gratuito).
// Si la URL por defecto deja de funcionar, descarga el ZIP a mano y pásale la ruta.
//
// Resultado: src/data/transporte.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import AdmZip from 'adm-zip';

const URL_POR_DEFECTO = 'https://files.mobilitydatabase.org/mdb-2767/latest.zip';
const RADIO_M = 400; // distancia máxima en línea recta
const MAX_PARADAS = 3; // paradas que mostramos por restaurante

const args = process.argv.slice(2);
const iUrl = args.indexOf('--url');
const urlFeed = iUrl >= 0 ? args[iUrl + 1] : null;
const rutaLocal = args.find((a, i) => !a.startsWith('--') && (iUrl < 0 || i !== iUrl + 1));

async function cargarZip() {
  if (rutaLocal) {
    if (!existsSync(rutaLocal)) throw new Error(`No existe ${rutaLocal}`);
    return { zip: new AdmZip(rutaLocal), fuente: `GTFS local (${rutaLocal})` };
  }
  const url = urlFeed ?? URL_POR_DEFECTO;
  console.log(`Descargando ${url} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el GTFS (HTTP ${res.status}). Descárgalo a mano y pasa la ruta.`);
  return { zip: new AdmZip(Buffer.from(await res.arrayBuffer())), fuente: 'GTFS de la Compañía de Tranvías de La Coruña' };
}

/** CSV de GTFS: con comillas opcionales y BOM. Devuelve un iterador de objetos. */
function* leerCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const filas = texto.split(/\r?\n/);
  const separar = (linea) => {
    const out = [];
    let campo = '';
    let comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (comillas) {
        if (c === '"' && linea[i + 1] === '"') (campo += '"'), i++;
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ',') out.push(campo), (campo = '');
      else campo += c;
    }
    out.push(campo);
    return out;
  };
  const cab = separar(filas[0]).map((s) => s.trim());
  for (let i = 1; i < filas.length; i++) {
    if (!filas[i].trim()) continue;
    const v = separar(filas[i]);
    const o = {};
    cab.forEach((k, j) => (o[k] = v[j]?.trim() ?? ''));
    yield o;
  }
}

function distanciaM(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ordenarLineas = (a, b) => a.localeCompare(b, 'es', { numeric: true });

const { zip, fuente } = await cargarZip();
const archivo = (n) => {
  const e = zip.getEntry(n);
  if (!e) throw new Error(`El GTFS no tiene ${n}`);
  return e.getData().toString('utf8');
};

// stops
const paradas = new Map();
for (const s of leerCsv(archivo('stops.txt'))) {
  if (s.location_type && s.location_type !== '0') continue;
  paradas.set(s.stop_id, { nombre: s.stop_name, lat: Number(s.stop_lat), lng: Number(s.stop_lon), lineas: new Set() });
}
// routes -> nombre corto
const nombreLinea = new Map();
for (const r of leerCsv(archivo('routes.txt'))) nombreLinea.set(r.route_id, r.route_short_name || r.route_long_name);
// trips -> route
const lineaDeViaje = new Map();
for (const t of leerCsv(archivo('trips.txt'))) lineaDeViaje.set(t.trip_id, nombreLinea.get(t.route_id));
// stop_times -> qué líneas pasan por cada parada
for (const st of leerCsv(archivo('stop_times.txt'))) {
  const p = paradas.get(st.stop_id);
  const l = lineaDeViaje.get(st.trip_id);
  if (p && l) p.lineas.add(l);
}

const restaurantes = JSON.parse(readFileSync(new URL('../src/data/restaurantes.json', import.meta.url), 'utf8'));
const salida = {
  _info: 'Generado por `npm run data:transporte`. No editar a mano.',
  generado: new Date().toISOString(),
  fuente,
  restaurantes: {},
};

for (const r of restaurantes) {
  if (!r.coords) continue;
  const cercanas = [...paradas.values()]
    .filter((p) => p.lineas.size > 0)
    .map((p) => ({ ...p, distancia: Math.round(distanciaM(r.coords, p)) }))
    .filter((p) => p.distancia <= RADIO_M)
    .sort((a, b) => a.distancia - b.distancia);

  // Nos quedamos con las paradas más cercanas que aportan alguna línea nueva
  const elegidas = [];
  const vistas = new Set();
  for (const p of cercanas) {
    if ([...p.lineas].some((l) => !vistas.has(l))) {
      elegidas.push(p);
      p.lineas.forEach((l) => vistas.add(l));
    }
    if (elegidas.length >= MAX_PARADAS) break;
  }
  salida.restaurantes[r.id] = {
    paradas: elegidas.map((p) => ({ nombre: p.nombre, distancia: p.distancia, lineas: [...p.lineas].sort(ordenarLineas) })),
    lineas: [...vistas].sort(ordenarLineas),
  };
  console.log(`${r.id.padEnd(26)} ${salida.restaurantes[r.id].lineas.join(', ') || '(ninguna parada en ' + RADIO_M + ' m)'}`);
}

writeFileSync(new URL('../src/data/transporte.json', import.meta.url), JSON.stringify(salida, null, 2) + '\n');
console.log(`\nGuardado en src/data/transporte.json (${paradas.size} paradas en el feed).`);
