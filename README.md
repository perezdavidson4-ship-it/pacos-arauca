# Paco’s Burguer & Pizzas · Arauca

Página estática sin frameworks: menú de 103 productos en nueve categorías, búsqueda, fichas accesibles, carrito y solicitud por WhatsApp.

## Estado

Fase 1 implementada. Firebase Authentication, Firestore, sus reglas, historial y publicación todavía pendientes de la configuración y el acceso del propietario. El sitio conserva por ahora el pedido por WhatsApp sin inicio de sesión.

## Ejecutar localmente

Requiere Node.js. Desde esta carpeta:

```powershell
npm run dev
```

Abre http://localhost:3000. No necesitas instalar dependencias. Los módulos ES requieren HTTP: abrir index.html con doble clic no ejecuta la aplicación correctamente.

## Mantener el menú

1. Edita catalog.js: nombre, descripción, categoría, imagen y precios de cada variante en pesos colombianos enteros.
2. Conserva id de productos y variantes existentes: se usan en los carritos guardados.
3. Para añadir un producto, usa un id único y al menos una variante con id, label y price.
4. Ejecuta `npm run sync:menu` para actualizar el JSON-LD y los contadores de las categorías en index.html.
5. Revisa búsqueda, selección de variantes, carrito y WhatsApp antes de publicar. Para una categoría nueva, añade también su tarjeta en index.html y su nombre en CATEGORIES.

## Datos recordados

El carrito mantiene la clave pacos-cart-v2. Nombre, celular, dirección, entrega, zona, pago y notas se guardan aparte en pacos-checkout-v1. «Olvidar mis datos» borra esos datos del dispositivo y conserva el carrito. No se guardan contraseñas.

## Preparar Firebase (propietario)

1. En https://console.firebase.google.com/ crea un proyecto, por ejemplo pacos-arauca, y anota su ID exacto. Analytics es opcional.
2. En Configuración del proyecto → General → Tus apps, registra una app web llamada Paco’s web. Copia el objeto firebaseConfig.
3. En Authentication → Método de acceso, habilita Correo electrónico/contraseña y Google. Selecciona el correo de asistencia al habilitar Google.
4. En Authentication → Configuración → Política de contraseñas, exige ocho caracteres como mínimo.
5. En Authentication → Configuración → Dominios autorizados, añade localhost para desarrollo y comprueba los dominios PROJECT_ID.web.app y PROJECT_ID.firebaseapp.com del proyecto.
6. En Authentication → Plantillas, selecciona español para Verificación de correo y Restablecer contraseña; personaliza el nombre del remitente y los textos que permita editar la consola. Guarda los cambios.
7. En Firestore Database, crea la base predeterminada en modo producción. Elige la ubicación antes de crearla; no uses reglas públicas de modo de prueba.
8. Comparte el objeto firebaseConfig y el ID del proyecto para continuar la fase 2. Esta configuración identifica una app web y es pública; no compartas cuentas de servicio, claves privadas ni tokens de sesión.

Documentación oficial: https://firebase.google.com/docs/web/setup y https://firebase.google.com/docs/auth/web/manage-users.

Recomendación: Firebase Hosting, para mantener Hosting, Authentication, Firestore y reglas en el mismo proyecto, con HTTPS y dominios web.app. GitHub se usará para el código y su historial. La URL definitiva y canonical/og:url se configurarán al publicar; aún no hay una publicación de este proyecto.

## Pruebas antes de publicar

- Menú y búsqueda en 360, 390, 640, 768, 980, 1024 y 1440 px.
- Diálogos: Tab, Shift+Tab, Escape y devolución del foco.
- Productos con variantes, cantidades 1–99, quitar líneas, recargar y recuperar carrito.
- Recargar y recuperar notas y datos de entrega; borrar datos conservando el carrito.
- Domicilio urbano, fuera de zona y recogida; totales y contenido de WhatsApp.
- Tras la fase 2: registro, errores de formulario y correo en uso.
- Correo de verificación, bloqueo de pedidos sin verificar y límite de reenvío.
- Inicio con correo y Google; recuperación de contraseña y cierre de sesión.
- Pedido guardado una vez, apertura de WhatsApp y recuperación ante fallo de red.
- Historial propio y rechazo de lectura/escritura de datos de otro usuario.

## Archivos

- index.html: estructura, accesibilidad y metadatos.
- style.css: colores, tipografía, diseño adaptable y diálogos.
- catalog.js: fuente única del menú y categorías.
- script.js: navegación, búsqueda, productos, carrito y WhatsApp.
- scripts/sync-menu.mjs: actualización de JSON-LD y contadores.
- scripts/dev.mjs: servidor local sin dependencias.
- package.json: comandos locales.
- .gitignore: exclusión de respaldos, dependencias y archivos privados.

Los originales están en respaldos/antes-mejoras-firebase y no se publican.
