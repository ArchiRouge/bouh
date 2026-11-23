/* Construit une version solo autonome (un seul fichier HTML) pour l'aperçu web. */
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'client');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const inline = f => '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>';
html = html.replace('<script src="seed-save.js"></script>', '');
html = html.replace('<script src="config.js"></script>', '<script>window.ETHERIA_CONFIG = { server: null };</script>');
for (const f of ['core.js', 'assets.js', 'steps.js', 'game.js']) html = html.replace(`<script src="${f}"></script>`, inline(f));
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'etheria-preview.html'), html);
console.log('dist/etheria-preview.html', (html.length / 1024).toFixed(0) + ' Ko');
