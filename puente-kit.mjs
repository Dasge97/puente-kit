// Mantiene en marcha el Puente de Browser Eye como servicio del Kit y escribe su estado.json.
// Sin dependencias: solo Node 24.
//
// Uso:
//   node puente-kit.mjs           Arranca y vigila el Puente (lo que lanza el Kit).
//   node puente-kit.mjs pair      Muestra un código para emparejar la extensión.
//   node puente-kit.mjs status    Estado del Puente.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(DIR, 'puente-kit.log');
const ESTADO_RUTA = path.join(DIR, 'estado-ruta.txt');
const RUTA_PUENTE = path.join(DIR, 'ruta-puente.txt');
const INTERVALO_MS = 30_000;

// bridge.mjs de claude-browser-eye-extension. Por defecto, el repositorio clonado al lado.
function rutaPuente() {
  if (process.env.BROWSER_EYE_BRIDGE) return path.resolve(process.env.BROWSER_EYE_BRIDGE);
  if (existsSync(RUTA_PUENTE)) {
    const ruta = readFileSync(RUTA_PUENTE, 'utf8').trim();
    if (ruta) return path.resolve(DIR, ruta);
  }
  return path.resolve(DIR, '..', 'claude-browser-eye-extension', 'apps', 'bridge', 'dist', 'bridge.mjs');
}

function log(texto) {
  const linea = `${new Date().toISOString()} ${texto}\n`;
  try {
    if (existsSync(LOG) && statSync(LOG).size > 512 * 1024) renameSync(LOG, `${LOG}.1`);
    appendFileSync(LOG, linea);
  } catch {
    // Un fallo de log no para el servicio.
  }
}

// estado.json para KitDani, escrito de forma atómica. Sin estado-ruta.txt no se escribe nada.
function escribirEstado(estado, mensaje, indicadores = []) {
  let destino;
  try {
    destino = readFileSync(ESTADO_RUTA, 'utf8').trim();
  } catch {
    return;
  }
  if (!destino) return;
  const ahora = new Date();
  const zona = -ahora.getTimezoneOffset();
  const local = new Date(ahora.getTime() + zona * 60_000).toISOString().slice(0, 19);
  const signo = zona >= 0 ? '+' : '-';
  const offset = `${signo}${String(Math.floor(Math.abs(zona) / 60)).padStart(2, '0')}:${String(Math.abs(zona) % 60).padStart(2, '0')}`;
  const datos = { estado, actualizado: `${local}${offset}`, mensaje, indicadores: indicadores.slice(0, 6) };
  try {
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(`${destino}.tmp`, `${JSON.stringify(datos, null, 2)}\n`);
    renameSync(`${destino}.tmp`, destino);
  } catch (error) {
    log(`No se pudo escribir estado.json: ${error.message}`);
  }
}

function consultarEstado(puente) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [puente, 'status', '--json'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let salida = '';
    proc.stdout.on('data', (trozo) => (salida += trozo));
    proc.once('error', () => resolve({ running: false, reason: 'spawn_failed' }));
    proc.once('exit', () => {
      try {
        resolve(JSON.parse(salida.trim().split('\n').pop() ?? '{}'));
      } catch {
        resolve({ running: false, reason: 'invalid_output' });
      }
    });
  });
}

async function vigilar() {
  const puente = rutaPuente();
  let hijo = null;
  let ultimoCodigo = null;
  let espera = 5_000;
  let proximoIntento = 0;
  let parando = false;

  const lanzar = () => {
    if (!existsSync(puente)) return;
    log(`Arrancando el Puente: ${puente}`);
    hijo = spawn(process.execPath, [puente, 'start'], { windowsHide: true, stdio: 'ignore', cwd: DIR });
    const este = hijo;
    // Revisión temprana para que el Kit vea el estado real sin esperar al siguiente ciclo.
    setTimeout(() => void revisar(), 2_000);
    hijo.once('exit', (codigo) => {
      if (hijo === este) hijo = null;
      ultimoCodigo = codigo;
      if (parando) return;
      // 3: ya hay otro Puente en el puerto (por ejemplo, el que arrancó un cliente MCP). No se pelea con él.
      // 2: el puerto lo usa otro programa. Se reintenta con calma.
      espera = codigo === 3 || codigo === 2 ? 60_000 : Math.min(espera * 2, 60_000);
      proximoIntento = Date.now() + espera;
      log(`El Puente terminó con código ${codigo}. Siguiente intento en ${Math.round(espera / 1000)} s.`);
      void revisar();
    });
  };

  const revisar = async () => {
    if (!existsSync(puente)) {
      escribirEstado('error', `No se encuentra bridge.mjs en ${puente}. Compila claude-browser-eye-extension con pnpm build.`);
      return;
    }
    const estado = await consultarEstado(puente);
    if (!estado.running) {
      if (!hijo && Date.now() >= proximoIntento) lanzar();
      const motivo =
        ultimoCodigo === 2
          ? 'El puerto del Puente lo usa otro programa. Cambia BROWSER_EYE_PORT.'
          : 'El Puente no está en marcha. Se está reintentando.';
      escribirEstado(hijo ? 'aviso' : 'error', hijo ? 'Arrancando el Puente.' : motivo);
      return;
    }
    if (hijo) espera = 5_000;
    const extension = !estado.paired ? 'Sin emparejar' : estado.extensionConnected ? 'Conectada' : 'Desconectada';
    const indicadores = [
      { etiqueta: 'Puerto', valor: String(estado.port) },
      { etiqueta: 'Extensión', valor: extension },
      { etiqueta: 'Clientes MCP', valor: String(estado.clients) },
      { etiqueta: 'Tareas activas', valor: String(estado.tasks) },
      { etiqueta: 'Arrancado por', valor: hijo ? 'Este servicio' : 'Otro proceso' },
    ];
    if (!estado.paired) {
      escribirEstado('aviso', 'Puente en marcha. Falta emparejar la extensión: usa la acción «Código de emparejamiento».', indicadores);
    } else if (!estado.extensionConnected) {
      escribirEstado('aviso', 'Puente en marcha. La extensión no está conectada (¿Chrome cerrado?).', indicadores);
    } else {
      escribirEstado('ok', `Puente en marcha en el puerto ${estado.port}. Extensión conectada.`, indicadores);
    }
  };

  const terminar = () => {
    parando = true;
    hijo?.kill();
    escribirEstado('parado', 'Servicio detenido.');
    process.exit(0);
  };
  process.on('SIGINT', terminar);
  process.on('SIGTERM', terminar);

  log('Servicio iniciado.');
  await revisar();
  setInterval(() => void revisar(), INTERVALO_MS);
}

function reenviar(argumentos) {
  const puente = rutaPuente();
  if (!existsSync(puente)) {
    process.stderr.write(`No se encuentra bridge.mjs en ${puente}.\n`);
    process.exit(1);
  }
  const proc = spawn(process.execPath, [puente, ...argumentos], { stdio: 'inherit' });
  proc.once('exit', (codigo) => process.exit(codigo ?? 0));
}

const [orden] = process.argv.slice(2);
if (orden === 'pair' || orden === 'status') reenviar([orden]);
else if (orden === undefined) await vigilar();
else {
  process.stderr.write('Uso: node puente-kit.mjs [pair|status]\n');
  process.exit(1);
}
