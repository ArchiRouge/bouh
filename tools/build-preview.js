/* Construit une version solo autonome (un seul fichier HTML) pour l'aperçu web. */
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'client');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const inline = f => '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>';
html = html.replace('<script src="seed-save.js"></script>', '');
html = html.replace('<script src="config.js"></script>', '<script>window.ETHERIA_CONFIG = { server: null };</script>');
for (const f of ['content.js', 'core.js', 'sprites.js', 'assets.js', 'steps.js']) html = html.replace(`<script src="${f}"></script>`, inline(f));
html = html.replace('<script src="persist.js"></script>', inline('game.js')); // persist.js ne sert que dans l'app iOS
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'pixels-worlds-preview.html'), html);
console.log('dist/pixels-worlds-preview.html', (html.length / 1024).toFixed(0) + ' Ko');
