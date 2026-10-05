import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=http.createServer((request,response)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname); } catch { response.writeHead(400);response.end();return; }
  const name=pathname==='/' ? 'index.html' : pathname.slice(1);
  // Solo los archivos públicos de la raíz; nunca .git, notas ni respaldos.
  if (!/^[a-zA-Z0-9-]+\.(html|css|js|png|jpg|webp|ico|svg)$/.test(name)) {response.writeHead(404);response.end();return;}
  try {
    const body=fs.readFileSync(path.join(root,name));
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.svg':'image/svg+xml'};
    response.setHeader('Content-Type',types[path.extname(name)]);
    response.setHeader('Cache-Control','no-store');response.end(body);
  } catch {response.writeHead(404);response.end();}
});
server.listen(3000,'127.0.0.1',()=>console.log('Paco’s: http://localhost:3000 (Ctrl+C para cerrar)'));
