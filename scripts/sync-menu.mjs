import fs from 'node:fs';
import { CATALOG, CATEGORIES } from '../catalog.js';
const url = new URL('../index.html', import.meta.url);
let html = fs.readFileSync(url, 'utf8');
const pattern = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
const match = html.match(pattern);
const schema = JSON.parse(match[2]);
schema.hasMenu.hasMenuSection = CATEGORIES.map(category => ({'@type':'MenuSection',name:category,hasMenuItem:CATALOG.filter(p => p.category === category).map(p => ({'@type':'MenuItem',name:p.name,description:p.description,...(p.image ? {image:p.image} : {}),offers:p.variants.map(v => ({'@type':'Offer',name:v.label || p.name,price:v.price,priceCurrency:'COP'}))}))}));
html = html.replace(pattern, (_, start, body, end) => start + '\n' + JSON.stringify(schema).replace(/</g, '\\u003c') + '\n' + end);
for (const category of CATEGORIES) {
  const count = CATALOG.filter(p => p.category === category).length;
  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const card = new RegExp('(<button[^>]*data-category-open="' + escaped + '"[\s\S]*?<\/button>)');
  html = html.replace(card, text => text.replace(/aria-label="[^"]*"/, 'aria-label="Ver ' + category + ': ' + count + ' productos"').replace(/<span>\d+ productos<\/span>/, '<span>' + count + ' productos</span>'));
}
fs.writeFileSync(url, html);
console.log('JSON-LD y contadores actualizados: ' + CATALOG.length + ' productos.');
