// Calcula las paradas de bus urbano y las líneas que hay cerca de cada restaurante,
// a partir del GTFS oficial de cada ciudad que lo tenga en src/data/ciudades.json.
//
// Uso:
//   npm run data:transporte                                   todas las ciudades con GTFS
//   npm run data:transporte -- --ciudad vigo                  solo una ciudad
//   npm run data:transporte -- --ciudad vigo ruta/gtfs.zip    usa un ZIP que ya tengas
//
// Los feeds también están en el Punto de Acceso Nacional (nap.transportes.gob.es, requiere registro
// gratuito). Si una descarga falla, se conservan los datos anteriores de esa ciudad.
//
// Resultado: src/data/transporte.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import AdmZip from 'adm-zip';

const RADIO_M = 400; // distancia máxima en línea recta
const MAX_PARADAS = 3; // paradas que mostramos por restaurante

const leer = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ciudades = leer('../src/data/ciudades.json');
const restaurantes = leer('../src/data/restaurantes.json');
const anterior = leer('../src/data/transporte.json');

const args = process.argv.slice(2);
const iCiudad = args.indexOf('--ciudad');
const soloCiudad = iCiudad >= 0 ? args[iCiudad + 1] : null;
const rutaLocal = args.find((a, i) => !a.startsWith('--') && i !== iCiudad + 1);
if (soloCiudad && !ciudades[soloCiudad]) throw new Error(`Ciudad desconocida: ${soloCiudad}`);
if (rutaLocal && !soloCiudad) throw new Error('Para usar un ZIP local indica también --ciudad');

async function cargarZip(gtfs) {
  if (rutaLocal) {
    if (!existsSync(rutaLocal)) throw new Error(`No existe ${rutaLocal}`);
    return { zip: new AdmZip(rutaLocal), fuente: gtfs?.fuente.es ?? `GTFS local (${rutaLocal})` };
  }
  console.log(`Descargando ${gtfs.url} …`);
  const res = await fetch(gtfs.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { zip: new AdmZip(Buffer.from(await res.arrayBuffer())), fuente: gtfs.fuente.es };
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

/** Paradas del feed con las líneas que pasan por cada una. */
function leerParadas(zip) {
  const archivo = (n) => {
    const e = zip.getEntry(n);
    if (!e) throw new Error(`El GTFS no tiene ${n}`);
    return e.getData().toString('utf8');
  };
  const paradas = new Map();
  for (const s of leerCsv(archivo('stops.txt'))) {
    if (s.location_type && s.location_type !== '0') continue;
    paradas.set(s.stop_id, { nombre: s.stop_name, lat: Number(s.stop_lat), lng: Number(s.stop_lon), lineas: new Set() });
  }
  const nombreLinea = new Map();
  for (const r of leerCsv(archivo('routes.txt'))) nombreLinea.set(r.route_id, r.route_short_name || r.route_long_name);
  const lineaDeViaje = new Map();
  for (const t of leerCsv(archivo('trips.txt'))) lineaDeViaje.set(t.trip_id, nombreLinea.get(t.route_id));
  for (const st of leerCsv(archivo('stop_times.txt'))) {
    const p = paradas.get(st.stop_id);
    const l = lineaDeViaje.get(st.trip_id);
    if (p && l) p.lineas.add(l);
  }
  return paradas;
}

function paradasCercanas(coords, paradas) {
  const cercanas = [...paradas.values()]
    .filter((p) => p.lineas.size > 0)
    .map((p) => ({ ...p, distancia: Math.round(distanciaM(coords, p)) }))
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
  return {
    paradas: elegidas.map((p) => ({ nombre: p.nombre, distancia: p.distancia, lineas: [...p.lineas].sort(ordenarLineas) })),
    lineas: [...vistas].sort(ordenarLineas),
  };
}

const salida = {
  _info: 'Generado por `npm run data:transporte`. No editar a mano.',
  generado: new Date().toISOString(),
  fuentes: { ...anterior.fuentes },
  restaurantes: { ...anterior.restaurantes },
};

for (const [id, ciudad] of Object.entries(ciudades)) {
  if (soloCiudad ? id !== soloCiudad : !ciudad.gtfs) continue;
  const locales = restaurantes.filter((r) => r.ciudad === id && r.coords);
  if (locales.length === 0) continue;
  try {
    const { zip, fuente } = await cargarZip(ciudad.gtfs);
    const paradas = leerParadas(zip);
    for (const r of locales) {
      salida.restaurantes[r.id] = paradasCercanas(r.coords, paradas);
      console.log(`${r.id.padEnd(30)} ${salida.restaurantes[r.id].lineas.join(', ') || `(ninguna parada en ${RADIO_M} m)`}`);
    }
    salida.fuentes[id] = fuente;
    console.log(`${ciudad.nombre}: ${paradas.size} paradas en el feed.\n`);
  } catch (err) {
    console.error(`✗ ${ciudad.nombre}: ${err.message}. Se conservan sus datos anteriores.`);
  }
}

writeFileSync(new URL('../src/data/transporte.json', import.meta.url), JSON.stringify(salida, null, 2) + '\n');
console.log('Guardado en src/data/transporte.json');
