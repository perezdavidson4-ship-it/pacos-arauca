import { getFirebase, spanishError, saveProfile, readOrders } from "./firebase-service.js";
import { siteUrl } from "./firebase-config.js";
import { CATALOG } from "./catalog.js";

let currentUser = null;
let profile = null;
let openModal;
let notifyProfile;
let readyPromise;
let refreshGeneration = 0;
let busyCount = 0;
let registrationProfile = null;
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat("es-CO", {style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
const say = message => { $("#account-feedback").textContent = message; };
export function getSession() { return {user:currentUser,profile}; }
export function accountReady() {
  if (!readyPromise) {
    readyPromise = startSession().catch(error => {readyPromise=null;say(spanishError(error));throw error;});
    readyPromise.catch(()=>{});
  }
  return readyPromise;
}
export function showAccount() { openModal($("#account-dialog")); }

function cooldownKey() { return "pacos-verification-" + currentUser?.uid; }
function remainingSeconds() {
  try { return Math.max(0, Math.ceil((Number(localStorage.getItem(cooldownKey())) - Date.now()) / 1000)) || 0; } catch {return 0;}
}
function setCooldown() { try {localStorage.setItem(cooldownKey(), String(Date.now()+60000));} catch {} }
function renderSession() {
  $("#account-enter").hidden = !!currentUser;
  $("#account-menu").hidden = !currentUser;
  $("#account-name").textContent = profile?.name || currentUser?.displayName || "Mi cuenta";
  $("#account-auth-forms").hidden = !!currentUser;
  $("#account-signed-in").hidden = !currentUser;
  $("#account-email").textContent = currentUser?.email || "";
  $("#account-verification").hidden = !currentUser || currentUser.emailVerified;
  $("#checkout-account-note").textContent = !currentUser ? "Ingresa a tu cuenta para guardar y enviar tu pedido." : currentUser.emailVerified ? "Tu correo está verificado. Guardaremos tu solicitud antes de abrir WhatsApp." : "Verifica tu correo antes de enviar el pedido. Puedes reenviar el correo o comprobar la verificación desde tu cuenta.";
  const remaining = remainingSeconds();
  $("#account-resend").disabled = busyCount > 0 || remaining > 0;
  $("#account-resend").textContent = remaining ? `Reenviar en ${remaining} s` : "Reenviar correo";
  if (currentUser) {
    $("#profile-form").elements.name.value = profile?.name || currentUser.displayName || "";
    $("#profile-form").elements.phone.value = profile?.phone || "";
    $("#profile-form").elements.address.value = profile?.address || "";
  }
}
function updateBusy() {
  const busy = busyCount > 0;
  $("#account-dialog").setAttribute("aria-busy", String(busy));
  document.querySelectorAll("[data-account-action]").forEach(button => button.disabled = busy);
  $("#account-loading").hidden = !busy;
  $("#account-resend").disabled = busy || remainingSeconds() > 0;
}
async function perform(action) {
  if (busyCount) return;
  busyCount++; updateBusy(); say("");
  try { await action(); } catch (error) { say(spanishError(error)); }
  finally {busyCount--; updateBusy();}
}
async function readProfile(user) {
  const {db, dbSDK} = await getFirebase();
  const snapshot = await dbSDK.getDoc(dbSDK.doc(db,"users",user.uid));
  if(snapshot.exists()) return snapshot.data();
  const values = registrationProfile?.email === user.email ? registrationProfile : {name:user.displayName || user.email?.split("@")[0] || "Mi cuenta",email:user.email,phone:"",address:""};
  await saveProfile(values,user.uid);
  return values;
}
async function startSession() {
  const {auth,authSDK}=await getFirebase();
  return new Promise((resolve,reject)=>{
    let first=true;
    authSDK.onAuthStateChanged(auth,async user=>{
      const generation=++refreshGeneration;
      const nextProfile=user ? await readProfile(user).catch(()=>registrationProfile?.email===user.email ? registrationProfile : {name:user.displayName || user.email?.split("@")[0] || "Mi cuenta",email:user.email,phone:"",address:""}) : null;
      if(generation!==refreshGeneration)return;
      currentUser=user;profile=nextProfile;renderSession();notifyProfile(user,profile);
      if(!user){$("#history-list").replaceChildren();$("#history-dialog").close();$("#profile-form").reset();}
      if(first){first=false;resolve();}
    },reject);
  });
}
function chooseTab(name, moveFocus=false) {
  for (const tab of document.querySelectorAll("[data-auth-tab]")) {
    const selected = tab.dataset.authTab === name;
    tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    $("#"+tab.getAttribute("aria-controls")).hidden = !selected;
    if (selected && moveFocus) tab.focus();
  }
  say("");
}
export async function refreshVerification() {
  await accountReady();
  const {auth, authSDK} = await getFirebase();
  const user = auth.currentUser;
  if (!user) return false;
  await authSDK.reload(user); await authSDK.getIdToken(user, true);
  if (auth.currentUser?.uid !== user.uid) return false;
  currentUser = user; renderSession();
  return user.emailVerified;
}

async function showHistory() {
  openModal($("#history-dialog"));
  const status=$("#history-status"); const list=$("#history-list");
  list.replaceChildren(); status.textContent="Cargando tus pedidos…";
  $("#history-dialog").setAttribute("aria-busy","true");
  const uid=currentUser?.uid;
  try {
    const orders=await readOrders();
    if(currentUser?.uid!==uid)return;
    status.textContent=orders.length ? "Tus últimas 50 solicitudes. Confirma cada pedido con el restaurante por WhatsApp." : "Todavía no tienes pedidos guardados.";
    for(const order of orders){
      const article=document.createElement("article");article.className="history-order";
      const heading=document.createElement("h3");heading.textContent="Pedido "+order.id.slice(-8).toUpperCase();
      const date=document.createElement("p");date.className="muted";
      date.textContent=order.createdAt?.toDate ? new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Bogota"}).format(order.createdAt.toDate()) : "Fecha pendiente";
      const items=document.createElement("ul");
      order.products.forEach((key,index)=>{
        const [productId,variantId]=key.split(":");const product=CATALOG.find(p=>p.id===productId);const variant=product?.variants.find(v=>v.id===variantId);
        const item=document.createElement("li");item.textContent=`${order.quantities[index]} × ${product?.name || productId}${variant?.label ? " ("+variant.label+")" : ""} · ${money(order.unitPrices[index]*order.quantities[index])}`;items.append(item);
      });
      const total=document.createElement("strong");total.textContent="Total solicitado: "+money(order.total);
      const delivery=document.createElement("p");delivery.textContent=order.delivery==="domicilio" ? "Domicilio · "+order.address : "Recoger en el local";
      const state=document.createElement("p");state.className="account-notice";state.textContent="Pendiente de confirmación por WhatsApp";
      article.append(heading,date,items,total,delivery,state);list.append(article);
    }
  } catch(error){status.textContent=spanishError(error);}
  finally{$("#history-dialog").setAttribute("aria-busy","false");}
}

export function initializeAccount({openDialog,onProfile}) {
  openModal=openDialog; notifyProfile=onProfile;
  $("#account-enter").addEventListener("click",showAccount);
  $("#checkout-account-button").addEventListener("click",showAccount);
  document.querySelectorAll("[data-auth-tab]").forEach(tab=>{
    tab.addEventListener("click",()=>chooseTab(tab.dataset.authTab));
    tab.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();const tabs=[...document.querySelectorAll("[data-auth-tab]")];
      const index=event.key==="Home" ? 0 : event.key==="End" ? tabs.length-1 : (tabs.indexOf(tab)+(event.key==="ArrowRight" ? 1 : -1)+tabs.length)%tabs.length;
      chooseTab(tabs[index].dataset.authTab,true);
    });
  });
  $("#account-login-form").addEventListener("submit",event=>{event.preventDefault();perform(async()=>{
    await accountReady();const {auth,authSDK}=await getFirebase();const form=event.target;
    await authSDK.signInWithEmailAndPassword(auth,form.elements.email.value.trim(),form.elements.password.value);
    form.elements.password.value="";say("Ingresaste a tu cuenta.");
  });});
  $("#account-register-form").addEventListener("submit",event=>{event.preventDefault();perform(async()=>{
    const form=event.target;
    const name=form.elements.name.value.trim(), phone=form.elements.phone.value.replace(/\D/g,"");
    if(!name || phone.replace(/\D/g,"").length<10 || phone.replace(/\D/g,"").length>15){say("Escribe tu nombre y un celular de 10 a 15 dígitos.");return;}
    await accountReady();const {auth,authSDK}=await getFirebase();
    registrationProfile={name,email:form.elements.email.value.trim(),phone,address:""};
    let credential;
    try{credential=await authSDK.createUserWithEmailAndPassword(auth,registrationProfile.email,form.elements.password.value);}catch(error){registrationProfile=null;throw error;}
    form.elements.password.value="";
    await authSDK.updateProfile(credential.user,{displayName:name});
    currentUser=credential.user;profile={name,email:credential.user.email,phone,address:""};
    renderSession();notifyProfile(currentUser,profile);
    // Enviar la verificación incluso si el perfil encuentra un fallo de red.
    let verificationSent=false;
    try {await authSDK.sendEmailVerification(credential.user,{url:siteUrl});setCooldown();verificationSent=true;}
    catch(error){say("La cuenta fue creada. "+spanishError(error)+" Usa «Reenviar correo».");}
    try {await saveProfile(profile);}catch(error){say("La cuenta fue creada. No pudimos guardar tus datos todavía; vuelve a guardarlos desde Mi cuenta.");return;}
    registrationProfile=null;
    if(verificationSent)say("Cuenta creada. Revisa tu correo (incluido spam) y verifica la dirección antes de enviar pedidos.");
    renderSession();
  });});
  $("#account-google").addEventListener("click",()=>perform(async()=>{
    await accountReady();const {auth,authSDK}=await getFirebase();
    const provider=new authSDK.GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    await authSDK.signInWithPopup(auth,provider);say("Ingresaste con Google. Completa tus datos de entrega al pedir.");
  }));
  $("#account-reset").addEventListener("click",()=>perform(async()=>{
    const email=$("#account-login-form").elements.email;
    if(!email.reportValidity() || !email.value.trim()){say("Escribe tu correo en la pestaña Ingresar para recuperar la contraseña.");email.focus();return;}
    const {auth,authSDK}=await getFirebase();await authSDK.sendPasswordResetEmail(auth,email.value.trim(),{url:siteUrl});
    say("Si existe una cuenta con ese correo, recibirás instrucciones para recuperar la contraseña. Revisa también spam.");
  }));
  $("#account-resend").addEventListener("click",()=>perform(async()=>{
    if(remainingSeconds())return;
    const {auth,authSDK}=await getFirebase();
    if(!auth.currentUser || auth.currentUser.emailVerified)return;
    setCooldown();await authSDK.sendEmailVerification(auth.currentUser,{url:siteUrl});
    say("Correo reenviado. Revisa tu bandeja de entrada y spam.");
  }));
  $("#account-check-verification").addEventListener("click",()=>perform(async()=>say(await refreshVerification() ? "Correo verificado. Ya puedes enviar pedidos." : "El correo aún no está verificado. Abre el enlace del correo y vuelve a comprobar.")));
  $("#profile-form").addEventListener("submit",event=>{event.preventDefault();perform(async()=>{
    const form=event.target;const values={name:form.elements.name.value.trim(),phone:form.elements.phone.value.replace(/\D/g,""),address:form.elements.address.value.trim()};
    const digits=values.phone.replace(/\D/g,"");if(!values.name || digits.length<10 || digits.length>15){say("Escribe tu nombre y un celular de 10 a 15 dígitos.");return;}
    await saveProfile(values);profile={...profile,...values};notifyProfile(currentUser,profile);renderSession();say("Tus datos fueron guardados.");
  });});
  document.querySelectorAll("[data-logout]").forEach(button=>button.addEventListener("click",()=>perform(async()=>{
    const {auth,authSDK}=await getFirebase();await authSDK.signOut(auth);$("#account-menu").open=false;say("Cerraste tu sesión.");
  })));
  $("#account-edit-profile").addEventListener("click",()=>{$("#account-menu").open=false;showAccount();});
  document.querySelectorAll("[data-history]").forEach(button=>button.addEventListener("click",()=>{$("#account-menu").open=false;showHistory();}));
  $("#history-refresh").addEventListener("click",showHistory);
  document.addEventListener("click",event=>{if(!event.target.closest("#account-menu"))$("#account-menu").open=false;});
  $("#account-menu").addEventListener("keydown",event=>{if(event.key==="Escape"){$("#account-menu").open=false;$("#account-menu summary").focus();}});
  setInterval(()=>{
    const remaining=remainingSeconds();$("#account-resend").disabled=busyCount>0 || remaining>0;$("#account-resend").textContent=remaining ? `Reenviar en ${remaining} s` : "Reenviar correo";
  },1000);
  renderSession();return accountReady();
}
