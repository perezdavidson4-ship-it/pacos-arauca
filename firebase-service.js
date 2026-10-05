import { firebaseConfig } from "./firebase-config.js";

let sdkPromise;
export function getFirebase() {
  if (!sdkPromise) sdkPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js")
  ]).then(([appSDK, authSDK, dbSDK]) => {
    const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
    const auth = authSDK.getAuth(app);
    auth.languageCode = "es";
    return { auth, db: dbSDK.getFirestore(app), authSDK, dbSDK };
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}

export function spanishError(error) {
  const messages = {
    "auth/email-already-in-use": "Este correo ya está registrado. Ingresa o recupera tu contraseña.",
    "auth/invalid-email": "Escribe un correo electrónico válido.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/password-does-not-meet-requirements": "La contraseña debe tener al menos 8 caracteres.",
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/invalid-login-credentials": "El correo o la contraseña no son correctos.",
    "auth/user-not-found": "El correo o la contraseña no son correctos.",
    "auth/wrong-password": "El correo o la contraseña no son correctos.",
    "auth/user-disabled": "Esta cuenta está deshabilitada. Contacta al restaurante.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos antes de intentar de nuevo.",
    "auth/network-request-failed": "No se pudo conectar. Revisa tu conexión e intenta de nuevo.",
    "auth/popup-closed-by-user": "Se cerró el acceso con Google. Puedes intentarlo de nuevo.",
    "auth/cancelled-popup-request": "El acceso con Google fue cancelado.",
    "auth/popup-blocked": "El navegador bloqueó Google. Permite ventanas emergentes para este sitio e intenta de nuevo.",
    "auth/unauthorized-domain": "Este dominio aún no está habilitado para ingresar. Contacta al restaurante.",
    "auth/account-exists-with-different-credential": "Este correo usa otro método de acceso. Ingresa con el método con el que creaste la cuenta.",
    "permission-denied": "No se pudo guardar. Comprueba tu sesión y la verificación del correo e intenta de nuevo.",
    "unavailable": "El servicio no está disponible. Conservamos tu carrito; intenta de nuevo.",
    "failed-precondition": "El servicio todavía necesita configuración. Intenta más tarde.",
    "app/unverified": "Verifica tu correo antes de enviar un pedido.",
    "app/signed-out": "Ingresa a tu cuenta antes de enviar un pedido."
  };
  return messages[error?.code] || "No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.";
}

export async function saveProfile(values, expectedUid) {
  const {auth, db, dbSDK} = await getFirebase();
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw {code:"app/signed-out"};
  const ref = dbSDK.doc(db, "users", user.uid);
  await dbSDK.runTransaction(db, async transaction => {
    const previous = await transaction.get(ref);
    transaction.set(ref, {
      name: values.name.trim(), email: user.email,
      phone: values.phone.replace(/\D/g, ""), address: values.address.trim(),
      createdAt: previous.exists() ? previous.data().createdAt : dbSDK.serverTimestamp()
    });
  });
}

export async function storeOrder(id, values, expectedUid) {
  const {auth, authSDK, db, dbSDK} = await getFirebase();
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw {code:"app/signed-out"};
  await authSDK.reload(user);
  await authSDK.getIdToken(user, true);
  if (!user.emailVerified) throw {code:"app/unverified"};
  if (auth.currentUser?.uid !== user.uid) throw {code:"app/signed-out"};
  const ref = dbSDK.doc(db, "orders", id);
  await dbSDK.runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      if (existing.data().uid !== user.uid) throw {code:"permission-denied"};
      return; // Reintento de la misma solicitud: conserva su ID y evita duplicarla.
    }
    transaction.set(ref, {...values, uid:user.uid, status:"pendiente_confirmacion", createdAt:dbSDK.serverTimestamp()});
  });
  return id;
}

export async function readOrders() {
  const {auth, db, dbSDK} = await getFirebase();
  if (!auth.currentUser) throw {code:"app/signed-out"};
  const uid = auth.currentUser.uid;
  const query = dbSDK.query(dbSDK.collection(db, "orders"), dbSDK.where("uid", "==", uid), dbSDK.orderBy("createdAt", "desc"), dbSDK.limit(50));
  const results = await dbSDK.getDocs(query);
  if (auth.currentUser?.uid !== uid) return [];
  return results.docs.map(doc => ({id:doc.id,...doc.data()}));
}
