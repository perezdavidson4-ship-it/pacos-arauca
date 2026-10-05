import { before, after, beforeEach, test } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { CATALOG } from '../catalog.js';
let env;
const projectId='demo-pacos-arauca';
const user=(uid='alice',verified=true)=>env.authenticatedContext(uid,{email:uid+'@example.test',email_verified:verified}).firestore();
const profile=()=>({name:'Ana Prueba',email:'alice@example.test',phone:'3132009287',address:'Dirección ficticia de prueba',createdAt:serverTimestamp()});
const first=CATALOG[0];
const order=()=>({uid:'alice',products:[first.id+':'+first.variants[0].id],quantities:[2],unitPrices:[first.variants[0].price],subtotal:first.variants[0].price*2,deliveryCost:5000,total:first.variants[0].price*2+5000,customer:'Ana Prueba',phone:'3132009287',delivery:'domicilio',address:'Dirección ficticia de prueba',zone:'urbano',payment:'Efectivo',notes:'Sin cebolla',status:'pendiente_confirmacion',createdAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(()=>env.clearFirestore());
after(()=>env?.cleanup());
test('Invitados no leen ni crean perfiles o pedidos',async()=>{
  const db=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db,'users','alice')));await assertFails(setDoc(doc(db,'users','alice'),profile()));
  await assertFails(getDoc(doc(db,'orders','missing')));await assertFails(setDoc(doc(db,'orders','order1'),order()));
});
test('Cada usuario crea y actualiza solo su perfil, conservando fecha y correo',async()=>{
  const db=user();const ref=doc(db,'users','alice');
  await assertSucceeds(setDoc(ref,profile()));await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref,{address:'Otra dirección ficticia'}));
  await assertFails(updateDoc(ref,{email:'other@example.test'}));
  await assertFails(updateDoc(ref,{createdAt:serverTimestamp()}));
  await assertFails(getDoc(doc(user('bob'),'users','alice')));
  await assertFails(setDoc(doc(user('bob'),'users','alice'),profile()));
  await assertFails(getDocs(collection(db,'users')));await assertFails(deleteDoc(ref));
});
test('Perfil sin correo verificado permitido; perfil con campos inválidos denegado',async()=>{
  const ref=doc(user('alice',false),'users','alice');await assertSucceeds(setDoc(ref,profile()));
  for(const changes of [{name:''},{phone:123},{phone:'123'},{address:'x'.repeat(181)},{admin:true}])await assertFails(setDoc(ref,{...profile(),...changes}));
});
test('Pedido requiere verificación y UID propio',async()=>{
  await assertFails(setDoc(doc(user('alice',false),'orders','order1'),order()));
  await assertFails(setDoc(doc(user('bob'),'orders','order1'),order()));
  await assertSucceeds(setDoc(doc(user(),'orders','order1'),order()));
});
test('Transacción puede consultar un ID nuevo y luego leer su pedido propio',async()=>{
  const ref=doc(user(),'orders','order1');await assertSucceeds(getDoc(ref));
  await assertSucceeds(setDoc(ref,order()));await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(user('bob'),'orders','order1')));
});
test('Historial exige UID propio y límite; no puede listar todos los pedidos',async()=>{
  const db=user();await setDoc(doc(db,'orders','order1'),order());
  await assertSucceeds(getDocs(query(collection(db,'orders'),where('uid','==','alice'),orderBy('createdAt','desc'),limit(50))));
  await assertFails(getDocs(query(collection(db,'orders'),where('uid','==','bob'),limit(50))));
  await assertFails(getDocs(query(collection(db,'orders'),limit(50))));
  await assertFails(getDocs(query(collection(db,'orders'),where('uid','==','alice'),limit(51))));
});
test('Pedidos no pueden cambiarse ni borrarse desde el cliente',async()=>{
  const ref=doc(user(),'orders','order1');await setDoc(ref,order());
  await assertFails(updateDoc(ref,{status:'confirmado'}));await assertFails(updateDoc(ref,{total:1}));await assertFails(deleteDoc(ref));
});
test('Valida todas las cantidades, productos y precios, incluyendo entradas posteriores',async()=>{
  const db=user();let i=0;
  const invalid=[{products:[]},{products:['inventado:v1']},{products:[order().products[0],order().products[0]],quantities:[1,1],unitPrices:[order().unitPrices[0],order().unitPrices[0]]},{quantities:[0]},{quantities:[100]},{quantities:[1.5]},{quantities:['2']},{unitPrices:[-1]},{unitPrices:[1]},{unitPrices:['10000']},{quantities:[2,1]},{products:{id:'x'}},{subtotal:-1},{total:1}];
  for(const changes of invalid)await assertFails(setDoc(doc(db,'orders','bad'+i++),{...order(),...changes}));
  const second=CATALOG[1];
  await assertFails(setDoc(doc(db,'orders','bad-later'),{...order(),products:[order().products[0],second.id+':'+second.variants[0].id],quantities:[2,'1'],unitPrices:[order().unitPrices[0],second.variants[0].price]}));
});
test('Valida entrega, contacto, notas, campos extra y fecha del servidor',async()=>{
  const db=user();let i=0;
  for(const changes of [{delivery:'otro'},{address:''},{zone:'otra'},{deliveryCost:0,total:order().subtotal},{phone:'123'},{phone:3132009287},{notes:'x'.repeat(501)},{customer:''},{admin:true},{createdAt:new Date(0)},{status:'pagado'},{payment:'tarjeta'}])await assertFails(setDoc(doc(db,'orders','bad'+i++),{...order(),...changes}));
  await assertSucceeds(setDoc(doc(db,'orders','pickup'),{...order(),delivery:'recoger',address:'',zone:'',deliveryCost:0,total:order().subtotal}));
});
test('Carrito completo con 174 opciones válidas no pierde funcionalidad',async()=>{
  const options=CATALOG.flatMap(p=>p.variants.map(v=>({key:p.id+':'+v.id,price:v.price})));
  const subtotal=options.reduce((sum,p)=>sum+p.price,0);
  await assertSucceeds(setDoc(doc(user(),'orders','full-cart'),{...order(),products:options.map(p=>p.key),quantities:options.map(()=>1),unitPrices:options.map(p=>p.price),subtotal,total:subtotal+5000}));
});

const review=()=>({uid:'alice',name:'Ana Prueba',text:'Una experiencia de prueba local.',rating:4,photo:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
test('Reseñas públicas con consultas limitadas; datos privados siguen cerrados',async()=>{
  await setDoc(doc(user(),'reviews','alice'),review());const guest=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(guest,'reviews','alice')));
  await assertSucceeds(getDocs(query(collection(guest,'reviews'),orderBy('updatedAt','desc'),limit(12))));
  await assertFails(getDocs(collection(guest,'reviews')));await assertFails(getDocs(query(collection(guest,'reviews'),limit(13))));
  await assertFails(getDoc(doc(guest,'users','alice')));await assertFails(getDoc(doc(guest,'orders','missing')));
});
test('Reseñas: solo correo verificado, una por UID, edición y borrado propios',async()=>{
  const ref=doc(user(),'reviews','alice');
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'reviews','alice'),review()));
  await assertFails(setDoc(doc(user('alice',false),'reviews','alice'),review()));
  await assertFails(setDoc(doc(user(),'reviews','other-id'),review()));await assertSucceeds(setDoc(ref,review()));
  await assertSucceeds(updateDoc(ref,{text:'Comentario editado en prueba.',rating:5,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('bob'),'reviews','alice'),{text:'Texto ajeno de prueba.',updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(doc(user('bob'),'reviews','alice')));await assertSucceeds(deleteDoc(ref));
});
test('Reseñas: valida estrellas, nombres, comentario, foto y ausencia de datos privados',async()=>{
  const ref=doc(user(),'reviews','alice');
  for(const changes of [{rating:0},{rating:6},{rating:2.5},{rating:'5'},{name:'A'},{name:'x'.repeat(51)},{text:'corto'},{text:'x'.repeat(701)},{photo:'https://example.test/photo.jpg'},{photo:'data:image/svg+xml;base64,AAAA'},{photo:'data:image/jpeg;base64,'+'A'.repeat(88000)},{email:'private@example.test'},{phone:'3132009287'},{uid:'bob'},{createdAt:new Date(0)},{updatedAt:new Date(0)}])await assertFails(setDoc(ref,{...review(),...changes}));
  await assertSucceeds(setDoc(ref,{...review(),photo:'data:image/jpeg;base64,/9j/AAAA=='}));
  await assertFails(updateDoc(ref,{createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
});
