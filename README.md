# Paco’s Burguer & Pizzas · Arauca

Página estática en HTML, CSS y JavaScript, sin frameworks. Carta de 103 productos y 174 opciones en nueve categorías, búsqueda, fichas accesibles, carrito persistente y solicitudes por WhatsApp. Incluye cuentas con Firebase Authentication, perfiles privados e historial en Firestore.

- Sitio: [pacos-arauca.web.app](https://pacos-arauca.web.app/)
- Código: [pacos-arauca en GitHub](https://github.com/perezdavidson4-ship-it/pacos-arauca)
- Firebase: proyecto existente `app-prueba-c6cd9` (APP PRUEBA), app web Paco’s Burguer & Pizzas.
- Hosting: sitio independiente `pacos-arauca`; Firestore Standard predeterminado, región permanente `nam5`, elegida por el propietario. Plan Spark.

## Ejecutar localmente

Requiere Node.js 22 o posterior. Para usar la página no necesitas instalar paquetes:

```powershell
npm run dev
```

Abre http://localhost:3000. Los módulos ES requieren HTTP; no abras index.html con doble clic. El acceso local utiliza el Firebase real configurado en `firebase-config.js`. Las pruebas automatizadas de reglas utilizan exclusivamente el proyecto ficticio `demo-pacos-arauca` y sus emuladores.

Firebase se importa desde el CDN oficial con una versión fija. La carta, búsqueda y carrito se inicializan antes de esperar su conexión. Si falla Firebase, el carrito sigue disponible y puedes reintentar el acceso.

## Mantener el menú

1. Edita `catalog.js`: nombre, descripción, categoría, URL de imagen y precios de variantes. Los precios son pesos colombianos enteros, sin separadores.
2. Conserva los `id` existentes de productos y variantes: identifican el carrito y el historial. Para un producto nuevo usa un ID único y al menos una variante con `id`, `label` y `price`.
3. Ejecuta `npm run sync:menu`. Actualiza JSON-LD, contadores de categorías y las opciones permitidas por las reglas de Firestore.
4. Revisa búsqueda, variantes, cantidades, domicilio y total con `npm run dev`. Las solicitudes anteriores conservan los importes guardados; las nuevas usan el catálogo actualizado.
5. Guarda y publica los cambios:

```powershell
git add catalog.js index.html firestore.rules
git commit -m "chore: actualizar carta de Paco’s"
git push origin main
npx firebase-tools deploy --only hosting,firestore --project app-prueba-c6cd9
```

El despliegue ejecuta la compilación estática y sincroniza nuevamente menú y reglas. Para categorías nuevas añade su nombre a `CATEGORIES` y su tarjeta accesible a `index.html`. Las fotos actuales se sirven desde pacosarauca.com; si añades archivos locales, inclúyelos expresamente en `scripts/build.mjs` para publicarlos.

## Cuentas y pedidos

El botón **Ingresar** abre un diálogo con Ingresar/Crear cuenta y acceso con Google. El registro solicita nombre, correo, celular y contraseña de al menos ocho caracteres. Firebase envía un correo de verificación. Hasta verificarlo, el usuario puede editar su cuenta y preparar el carrito, pero no guardar ni continuar el pedido a WhatsApp. **Ya verifiqué mi correo** recarga la cuenta y el token. El reenvío exige esperar 60 segundos; Firebase aplica además sus propios límites.

**Olvidé mi contraseña** utiliza el correo escrito en Ingresar. Se muestra una respuesta general para evitar revelar si una cuenta existe. Los errores y estados de carga están en español. Google proporciona una cuenta verificada; su teléfono y dirección pueden completarse en Mi cuenta o al pedir.

Al continuar con una cuenta verificada, se guarda el perfil y la solicitud en Firestore antes de abrir WhatsApp. Si falla el guardado no se abre el mensaje. Si el navegador bloquea la ventana, el diálogo muestra un enlace para abrirlo. Debes revisar y enviar el mensaje por WhatsApp; guardar la solicitud no confirma la preparación ni cobra dinero.

Cada solicitud comienza con estado `pendiente_confirmacion`. Un reintento del mismo carrito y datos conserva su ID para evitar duplicados. **Crear otra solicitud con este carrito** permite repetirla expresamente. **Mis pedidos** muestra las últimas 50 solicitudes propias, ordenadas por fecha, con precio guardado y total solicitado.

## Datos y reglas

- El carrito conserva `pacos-cart-v2` y cantidades de 1 a 99 por opción.
- Nombre, celular, dirección, entrega, zona, pago y notas se recuerdan en `pacos-checkout-v1:{uid}`. La copia anterior de invitado se migra al ingresar. Cerrar sesión limpia los campos visibles y conserva el carrito. **Olvidar mis datos** elimina esa copia local, no el perfil ni el historial en Firebase.
- `users/{uid}` guarda `name`, `email`, `phone`, `address`, `createdAt`. Cada usuario puede consultar y actualizar su propio perfil; el correo debe coincidir con su cuenta y la fecha de creación se conserva.
- `orders/{orderId}` guarda `uid`, `products` (IDs producto:variante), `quantities`, `unitPrices`, `subtotal`, `deliveryCost`, `total`, `customer`, `phone`, `delivery`, `address`, `zone`, `payment`, `notes`, `status`, `createdAt`.
- Las reglas deniegan acceso público, datos ajenos, campos extra, tipos o cantidades inválidas y pedidos sin correo verificado. Los clientes no pueden modificar o borrar solicitudes. El historial exige filtrar el UID propio y limitarse a 50 resultados.

Los importes son presupuestos enviados por el cliente y deben confirmarse con el restaurante. Las reglas validan opciones y precios permitidos, tipos, límites y la suma subtotal + domicilio, pero no recalculan cada línea ni su subtotal en un servidor. No uses estos documentos como cobros o facturas aprobadas; eso requiere una operación de servidor que calcule y confirme precios.

`firebase-config.js` contiene solamente identificadores públicos de la app web. La protección está en Authentication y las reglas; nunca añadas claves privadas, cuentas de servicio, tokens CLI ni archivos .env al repositorio. Las contraseñas las administra Firebase Authentication.

## Configurar Firebase en otro proyecto

1. Crea o selecciona un proyecto en [Firebase console](https://console.firebase.google.com/), registra una app web y copia su configuración pública a `firebase-config.js`.
2. En Authentication → Método de acceso, habilita Correo electrónico/contraseña y Google, con su correo de asistencia y nombre público.
3. En Authentication → Configuración → Política de contraseñas, activa Exigir aplicación y establece mínimo ocho caracteres.
4. En Dominios autorizados añade `localhost`, tu dominio de publicación y el dominio de `authDomain`. En este proyecto están `localhost`, `app-prueba-c6cd9.firebaseapp.com`, `app-prueba-c6cd9.web.app`, `pacos-arauca.web.app` y `pacos-arauca.firebaseapp.com`.
5. En Plantillas selecciona español (Latinoamérica). Personaliza remitente y asunto si la consola permite editarlos. **Limitación actual de APP PRUEBA:** Firebase aceptó español, pero rechazó el remitente/asunto personalizados y mostró que este proyecto no puede actualizar esas plantillas por ahora. Para habilitarlos sigue el enlace de [soporte de Firebase](https://firebase.google.com/support/troubleshooter/auth/email/help); después usa remitente Paco’s Burguer & Pizzas y asunto Verifica tu correo en Paco’s. No se ha enviado una solicitud de soporte automáticamente.
6. Crea Firestore Standard predeterminado en modo producción. Elige su región antes de crearlo. No actives reglas públicas.
7. Ajusta `.firebaserc`, el sitio de `firebase.json`, `siteUrl` de `firebase-config.js` y canonical/og:url/URL JSON-LD de `index.html` a tu proyecto y dominio.
8. Autentica la CLI y despliega:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore --project TU_PROJECT_ID
```

Se recomienda [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart) por su integración con Authentication y Firestore, HTTPS y dominios web.app. GitHub conserva fuentes y commits; hacer `git push` por sí solo no actualiza Hosting. La publicación incluye únicamente la lista de archivos públicos de `scripts/build.mjs`, nunca respaldos, pruebas o credenciales.

## Verificación y mantenimiento

Consulta [PRUEBAS.md](PRUEBAS.md) para el checklist y las comprobaciones realizadas. Las pruebas de reglas necesitan Node.js, JDK 21 y Firebase CLI:

```powershell
npm ci
npx firebase-tools emulators:exec --only auth,firestore --project demo-pacos-arauca "npm run test:rules"
```

Las dependencias npm son únicamente para pruebas. La versión corregida de `@grpc/grpc-js` se fija con `overrides` en package.json. En esta entrega `npm audit` no encontró vulnerabilidades.

Si cambia el dominio, actualiza los dominios autorizados, `siteUrl`, canonical, Open Graph y JSON-LD antes de volver a publicar. Si cambias la carta, despliega también las reglas generadas. El proyecto APP PRUEBA comparte Authentication con sus otras apps; revisa el alcance antes de hacer cambios generales al proyecto.

## Archivos

- `index.html`, `style.css`, `script.js`: estructura, estilos, accesibilidad, menú, carrito y flujo de pedido.
- `catalog.js`: fuente del menú y categorías.
- `account.js`: formularios, sesión, verificación, perfil e historial.
- `firebase-service.js`, `firebase-config.js`: SDK modular, operaciones e identificadores públicos.
- `firestore.rules`, `firestore.indexes.json`: permisos, validaciones e índice del historial.
- `firebase.json`, `.firebaserc`: despliegue y emuladores.
- `scripts/dev.mjs`, `scripts/sync-menu.mjs`, `scripts/sync-rules.mjs`, `scripts/build.mjs`: desarrollo, sincronización y publicación.
- `tests/firestore.test.mjs`: pruebas del aislamiento y validaciones de datos.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `PRUEBAS.md`: comandos, dependencias y documentación.

Los originales permanecen en `respaldos/antes-mejoras-firebase` y están excluidos de Git y Hosting.

Documentación: [Firebase web](https://firebase.google.com/docs/web/setup), [cuentas y verificación](https://firebase.google.com/docs/auth/web/manage-users), [reglas de Firestore](https://firebase.google.com/docs/firestore/security/get-started).
