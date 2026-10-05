import fs from 'node:fs';
import { CATALOG } from '../catalog.js';
const products = CATALOG.flatMap(p => p.variants.map(v => p.id + ':' + v.id));
const prices = [...new Set(CATALOG.flatMap(p => p.variants.map(v => v.price)))];
const quantities = Array.from({length:99},(_,i)=>i+1);
const upperBound = CATALOG.reduce((sum,p)=>sum+p.variants.reduce((n,v)=>n+v.price*99,0),0);
const rules = `// Generado con npm run sync:menu. Fuente del catálogo: catalog.js.
// Las solicitudes son presupuestos del cliente; el restaurante confirma el valor.
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function owner(uid) { return signedIn() && request.auth.uid == uid; }
    function shortText(value, max) { return value is string && value.size() <= max; }
    function validProfile(d) {
      return d.keys().hasAll(['name','email','phone','address','createdAt'])
        && d.keys().hasOnly(['name','email','phone','address','createdAt'])
        && shortText(d.name,80) && d.name.size() > 0
        && shortText(d.email,254) && d.email == request.auth.token.email
        && d.phone is string && (d.phone == '' || d.phone.matches('^[0-9]{10,15}$'))
        && shortText(d.address,180) && d.createdAt is timestamp;
    }
    function validOrder(d) {
      return d.keys().hasAll(['uid','products','quantities','unitPrices','subtotal','deliveryCost','total','customer','phone','delivery','address','zone','payment','notes','status','createdAt'])
        && d.keys().hasOnly(['uid','products','quantities','unitPrices','subtotal','deliveryCost','total','customer','phone','delivery','address','zone','payment','notes','status','createdAt'])
        && d.uid == request.auth.uid
        && d.products is list && d.products.size() > 0 && d.products.size() <= ${products.length}
        && d.products.toSet().size() == d.products.size()
        && d.products.toSet().difference(${JSON.stringify(products)}.toSet()).size() == 0
        && d.quantities is list && d.quantities.size() == d.products.size()
        && d.quantities.toSet().difference(${JSON.stringify(quantities)}.toSet()).size() == 0
        && d.unitPrices is list && d.unitPrices.size() == d.products.size()
        && d.unitPrices.toSet().difference(${JSON.stringify(prices)}.toSet()).size() == 0
        && d.subtotal is int && d.subtotal > 0 && d.subtotal <= ${upperBound}
        && d.deliveryCost is int && d.total is int && d.total == d.subtotal + d.deliveryCost
        && shortText(d.customer,80) && d.customer.size() > 0
        && d.phone is string && d.phone.matches('^[0-9]{10,15}$')
        && d.delivery in ['domicilio','recoger']
        && shortText(d.address,180)
        && ((d.delivery == 'domicilio' && d.address.size() > 0 && d.zone in ['urbano','fuera']
          && d.deliveryCost == (d.zone == 'urbano' ? 5000 : 6000))
          || (d.delivery == 'recoger' && d.address == '' && d.zone == '' && d.deliveryCost == 0))
        && d.payment in ['Efectivo','Transferencia (Nequi, Bre-B o Daviplata)']
        && shortText(d.notes,500)
        && d.status == 'pendiente_confirmacion'
        && d.createdAt is timestamp && d.createdAt == request.time;
    }
    match /users/{uid} {
      allow get: if owner(uid);
      allow create: if owner(uid) && validProfile(request.resource.data) && request.resource.data.createdAt == request.time;
      allow update: if owner(uid) && validProfile(request.resource.data)
        && request.resource.data.createdAt == resource.data.createdAt;
      allow list, delete: if false;
    }
    match /orders/{orderId} {
      // Una transacción puede comprobar que el ID nuevo no existe.
      allow get: if signedIn() && (resource == null || resource.data.uid == request.auth.uid);
      allow list: if signedIn() && resource.data.uid == request.auth.uid && request.query.limit <= 50;
      allow create: if signedIn() && request.auth.token.email_verified == true && validOrder(request.resource.data);
      allow update, delete: if false;
    }
    // Solo esta colección contiene contenido público autorizado al publicar una reseña.
    function validReview(d) {
      return d.keys().hasAll(['uid','name','text','rating','photo','createdAt','updatedAt'])
        && d.keys().hasOnly(['uid','name','text','rating','photo','createdAt','updatedAt'])
        && d.uid == request.auth.uid
        && shortText(d.name,50) && d.name.size() >= 2
        && shortText(d.text,700) && d.text.size() >= 10
        && d.rating is int && d.rating >= 1 && d.rating <= 5
        && shortText(d.photo,88000)
        && (d.photo == '' || d.photo.matches('^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'))
        && d.createdAt is timestamp && d.updatedAt is timestamp
        && d.updatedAt == request.time;
    }
    match /reviews/{uid} {
      allow get: if true;
      allow list: if request.query.limit <= 12;
      allow create: if owner(uid) && request.auth.token.email_verified == true
        && validReview(request.resource.data) && request.resource.data.createdAt == request.time;
      allow update: if owner(uid) && request.auth.token.email_verified == true
        && validReview(request.resource.data) && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if owner(uid);
    }
    match /{document=**} { allow read, write: if false; }
  }
}
`;
fs.writeFileSync(new URL('../firestore.rules',import.meta.url),rules);
console.log('Reglas sincronizadas con ' + products.length + ' opciones del menú.');
