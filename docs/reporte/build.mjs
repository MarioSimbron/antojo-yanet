/**
 * Builds the project report PDF: injects the repository's SVG diagrams into the HTML,
 * paginates it with Paged.js inside headless Microsoft Edge, prints it to PDF and
 * saves a PNG of every page for visual review.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2];
const salidaPdf = process.argv[3];
const dirPaginas = path.join(aqui, 'paginas');

/**
 * Replaces every <!--SVG:name--> marker with the inline SVG from docs/decisiones.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} html - Report HTML with markers.
 * @returns {string} HTML with the diagrams inlined.
 */
function insertarDiagramas(html) {
  return html.replace(/<!--SVG:(\w+)-->/g, (_, nombre) =>
    fs.readFileSync(path.join(repo, 'docs', 'decisiones', `${nombre}.svg`), 'utf8'));
}

const polyfill = fs.readFileSync(path.join(aqui, 'node_modules/pagedjs/dist/paged.polyfill.js'), 'utf8');
// A replacer function, not a string: the library contains "$&" and "$`" sequences that
// String.replace would otherwise expand and corrupt.
const html = insertarDiagramas(fs.readFileSync(path.join(aqui, 'reporte.html'), 'utf8')).replace(
  '</head>',
  () => `<script>window.PagedConfig = { after: () => { window.__listo = true; } };</script>\n<script>${polyfill}</script>\n</head>`,
);
const armado = path.join(aqui, 'armado.html');
fs.writeFileSync(armado, html);

const navegador = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--no-first-run'],
});
const pagina = await navegador.newPage();
pagina.on('console', (m) => { if (['error', 'warn'].includes(m.type())) console.log(`[pagina ${m.type()}] ${m.text()}`); });
pagina.on('pageerror', (e) => console.log(`[pagina excepcion] ${e.message}`));
await pagina.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 1.5 });
await pagina.goto(pathToFileURL(armado).href, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__listo === true, { timeout: 120000 });

const total = await pagina.$$eval('.pagedjs_page', (p) => p.length);
fs.rmSync(dirPaginas, { recursive: true, force: true });
fs.mkdirSync(dirPaginas);
const hojas = await pagina.$$('.pagedjs_page');
for (let i = 0; i < hojas.length; i++) {
  await hojas[i].screenshot({ path: path.join(dirPaginas, `p${String(i + 1).padStart(2, '0')}.png`) });
}

await pagina.pdf({ path: salidaPdf, printBackground: true, preferCSSPageSize: true });
await navegador.close();
console.log(`PDF: ${salidaPdf} (${total} paginas)`);
