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

El header y la barra del carrito abren el pedido y pasan por esta verificación. En la interfaz simplificada, el botón flotante duplicado está oculto mediante CSS. Los enlaces generales de contacto por WhatsApp permanecen disponibles.

Al continuar con una cuenta verificada, se guarda el perfil y la solicitud en Firestore antes de abrir WhatsApp. Si falla el guardado no se abre el mensaje. Si el navegador bloquea la ventana, el diálogo muestra un enlace para abrirlo. Debes revisar y enviar el mensaje por WhatsApp; guardar la solicitud no confirma la preparación ni cobra dinero.

Cada solicitud comienza con estado `pendiente_confirmacion`. Un reintento del mismo carrito y datos conserva su ID para evitar duplicados. **Crear otra solicitud con este carrito** permite repetirla expresamente. **Mis pedidos** muestra las últimas 50 solicitudes propias, ordenadas por fecha, con precio guardado y total solicitado.

## Datos y reglas

- El carrito conserva `pacos-cart-v2` y cantidades de 1 a 99 por opción.
- Nombre, celular, dirección, entrega, zona, pago y notas se recuerdan en `pacos-checkout-v1:{uid}`. La copia anterior de invitado se migra al ingresar. Cerrar sesión limpia los campos visibles y conserva el carrito. **Olvidar mis datos** elimina esa copia local, no el perfil ni el historial en Firebase.
- `users/{uid}` guarda `name`, `email`, `phone`, `address`, `createdAt`. Cada usuario puede consultar y actualizar su propio perfil; el correo debe coincidir con su cuenta y la fecha de creación se conserva.
- `orders/{orderId}` guarda `uid`, `products` (IDs producto:variante), `quantities`, `unitPrices`, `subtotal`, `deliveryCost`, `total`, `customer`, `phone`, `delivery`, `address`, `zone`, `payment`, `notes`, `status`, `createdAt`.
- Las reglas de perfiles y pedidos deniegan acceso público, datos ajenos, campos extra, tipos o cantidades inválidas y pedidos sin correo verificado. Los clientes no pueden modificar o borrar solicitudes. El historial exige filtrar el UID propio y limitarse a 50 resultados.

Los importes son presupuestos enviados por el cliente y deben confirmarse con el restaurante. Las reglas validan opciones y precios permitidos, tipos, límites y la suma subtotal + domicilio, pero no recalculan cada línea ni su subtotal en un servidor. No uses estos documentos como cobros o facturas aprobadas; eso requiere una operación de servidor que calcule y confirme precios.

`firebase-config.js` contiene solamente identificadores públicos de la app web. La protección está en Authentication y las reglas; nunca añadas claves privadas, cuentas de servicio, tokens CLI ni archivos .env al repositorio. Las contraseñas las administra Firebase Authentication.

## Configurar Firebase en otro proyecto

1. Crea o selecciona un proyecto en [Firebase console](https://console.firebase.google.com/), registra una app web y copia su configuración pública a `firebase-config.js`.
2. En Authentication → Método de acceso, habilita Correo electrónico/contraseña y Google, con su correo de asistencia y nombre público.
3. En Authentication → Configuración → Política de contraseñas, activa Exigir aplicación y establece mínimo ocho caracteres.
4. En Dominios autorizados añade `localhost`, tu dominio de publicación y el dominio de `authDomain`. En este proyecto están `localhost`, `app-prueba-c6cd9.firebaseapp.com`, `app-prueba-c6cd9.web.app`, `pacos-arauca.web.app` y `pacos-arauca.firebaseapp.com`.
5. En Plantillas selecciona español (Latinoamérica). Personaliza remitente y asunto si la consola permite editarlos. **Limitación actual de APP PRUEBA:** Firebase aceptó español, pero rechazó el remitente/asunto personalizados y mostró que este proyecto no puede actualizar esas plantillas por ahora. Para habilitarlos sigue el enlace de [soporte de Firebase](https://firebase.google.com/support/troubleshooter/auth/email/help); después usa remitente Paco’s Burguer & Pizzas y asunto Verifica tu correo en Paco’s. No se ha enviado una solicitud de soporte automáticamente.
6. Crea Firestore Standard predeterminado en modo producción. Elige su región antes de crearlo. Mantén privados perfiles y pedidos; únicamente la colección de reseñas tiene lectura pública limitada.
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
- `reviews.js`: reseñas públicas, estrellas, foto comprimida y edición/borrado del autor.
- `firebase-service.js`, `firebase-config.js`: SDK modular, operaciones e identificadores públicos.
- `firestore.rules`, `firestore.indexes.json`: permisos, validaciones, índice del historial y exclusiones de índices para foto/texto de las reseñas.
- `firebase.json`, `.firebaserc`: despliegue y emuladores.
- `scripts/dev.mjs`, `scripts/sync-menu.mjs`, `scripts/sync-rules.mjs`, `scripts/build.mjs`: desarrollo, sincronización y publicación.
- `tests/firestore.test.mjs`: pruebas del aislamiento y validaciones de datos.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `PRUEBAS.md`: comandos, dependencias y documentación.

Los originales permanecen en `respaldos/antes-mejoras-firebase` y están excluidos de Git y Hosting.

Documentación: [Firebase web](https://firebase.google.com/docs/web/setup), [cuentas y verificación](https://firebase.google.com/docs/auth/web/manage-users), [reglas de Firestore](https://firebase.google.com/docs/firestore/security/get-started).

## Interfaz simplificada y reversión

La estructura visible es anuncio discreto → hero → menú → Nosotros con Cómo pedir → galería de dos fotos → reseñas cuando existan → contacto → footer. La cinta, el sello/marco del hero, los textos decorativos, la foto duplicada de Nosotros y el CTA final se conservan con la clase **ui-optional**. Las otras dos fotos de la galería siguen disponibles en Ver más fotos.

El cuerpo usa **ui-clean** y los estilos correspondientes están al final de style.css. Quitar esta clase vuelve a mostrar los adornos conservados; para restaurar exactamente la estructura anterior, usa el commit anterior o **respaldos/antes-simplificacion-ui**. No restaures únicamente script.js si quieres conservar las reseñas: index.html y reviews.js deben mantenerse coordinados.

Las tarjetas muestran imagen, nombre y precio Desde. Ingredientes y opciones permanecen en el diálogo y también se incluyen en las búsquedas. La barra del carrito añade espacio al final de la página para no tapar el footer. El hero conserva Ver menú como acción principal; en móvil Pedir ahora está dentro del menú de navegación y Ver mi pedido permanece en el hero.

## Publicar reseñas con estrellas y foto

1. Pulsa **Escribir una reseña** en el footer o en la sección de opiniones.
2. Ingresa y verifica tu correo si aún no lo has hecho.
3. Elige un nombre público (2–50 caracteres), de 1 a 5 estrellas y un comentario de 10–700 caracteres.
4. Opcionalmente añade una foto JPG, PNG o WebP de hasta 5 MB. Se convierte a JPEG, con lado mayor de hasta 640 px y máximo 88.000 caracteres de datos (aproximadamente 64 KiB). Al convertirla se descartan los metadatos originales.
5. Pulsa Publicar reseña. Aparece inmediatamente y puedes volver al mismo diálogo para editarla, quitar la foto o eliminarla con confirmación.

Cada cuenta mantiene una reseña en **reviews/{uid}**, con uid, name, text, rating, photo, createdAt y updatedAt. Solo estos documentos son públicos. El diálogo informa que nombre/comentario/estrellas/foto se harán públicos; correo, celular, dirección y pedidos permanecen en sus colecciones privadas. Se muestran doce reseñas por página, ordenadas por la última actualización. No se presenta una calificación global ni una compra verificada que no se haya comprobado.

Las reglas exigen correo verificado para crear/editar, UID propio, fechas del servidor, estrellas enteras de 1 a 5, límites de texto/foto y campos estrictamente permitidos. El autor puede eliminar su documento. La foto y el comentario no se indexan. Los comentarios se presentan como texto, sin ejecutar HTML.

Se guardan miniaturas pequeñas dentro de Firestore para funcionar con el plan Spark actual. No está pensado para álbumes ni imágenes de alta resolución: las fotos cuentan para almacenamiento y transferencias de Firestore, sujetas a sus cuotas. Para ampliar esta función migra las fotos a Storage; [Firebase Storage exige el plan Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024?hl=es-419). No se activó facturación.

La publicación es inmediata, sin aprobación previa. Como propietario puedes retirar una reseña desde Firebase console → Firestore Database → reviews → documento → eliminar. Para exigir moderación, añade estados pendiente/aprobada, un rol de administrador protegido y una consulta pública que solo devuelva las aprobadas; no basta con ocultarlas usando CSS.
