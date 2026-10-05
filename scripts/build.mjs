import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
execFileSync(process.execPath,[fileURLToPath(new URL('sync-menu.mjs',import.meta.url))],{stdio:'inherit'});
execFileSync(process.execPath,[fileURLToPath(new URL('sync-rules.mjs',import.meta.url))],{stdio:'inherit'});
const publicDir=new URL('public/',root);
fs.mkdirSync(publicDir,{recursive:true});
// Lista explícita: las credenciales CLI, respaldos y archivos de desarrollo no se publican.
for(const name of ['index.html','style.css','script.js','catalog.js','account.js','firebase-service.js','firebase-config.js'])fs.copyFileSync(new URL(name,root),new URL(name,publicDir));
console.log('Sitio preparado en public/.');
