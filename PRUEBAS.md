# Pruebas de la entrega · 5 de octubre de 2026

## Verificado automáticamente

La interfaz se probó con Chromium/Edge y Firebase Authentication y Firestore en emuladores, con usuarios y direcciones ficticios. WhatsApp se interceptó para comprobar el texto sin enviar mensajes. No se crearon pedidos de prueba en producción.

- [x] Anchos 360, 390, 640, 768, 980, 1024 y 1440 px, sin desbordamiento horizontal en página, cuenta y pedido.
- [x] Menú, productos, variantes, carrito persistente y foco al modificar cantidades o cargar más resultados.
- [x] Pestañas Ingresar/Crear cuenta con flechas y Home; diálogos con cierre y navegación por teclado.
- [x] Registro con nombre/correo/teléfono, mínimo ocho caracteres y creación de perfil.
- [x] Correo de verificación, bloqueo de pedido sin verificar, reenvío con 60 segundos de espera y actualización de verificación/token.
- [x] Login con contraseña correcta y mensaje español con contraseña incorrecta.
- [x] Generación de instrucciones de recuperación de contraseña en el emulador.
- [x] Inicio con el proveedor Google simulado por el emulador, cuenta verificada y perfil propio.
- [x] Pedido guardado antes de continuar, texto de WhatsApp con total, contacto, dirección y notas; reintento conserva un solo pedido.
- [x] Historial propio, sesión tras recargar y persistencia de datos/notas.
- [x] Logout limpia datos visibles y conserva el carrito; otra cuenta no recibe las notas anteriores.
- [x] Olvidar mis datos elimina la copia local y conserva productos.
- [x] Diez pruebas de reglas: invitados rechazados, perfiles propios, campos/tipos, correo verificado, UID propio, historial filtrado, fechas, estados inmutables y validación de entradas posteriores de una lista.
- [x] Las 174 opciones del catálogo caben en un pedido válido; no se limita artificialmente el carrito a pocas líneas.
- [x] JSON-LD coincide con nombres y precios de `catalog.js`; imágenes con dimensiones y carga diferida salvo hero.
- [x] Sin errores JavaScript en el recorrido probado. `npm audit`: cero vulnerabilidades.
- [x] Configuración real comprobada con la API oficial: correo y Google activos, mínimo ocho caracteres exigido, cinco dominios autorizados, plantilla `es-419`, Firestore Standard `nam5`.

## Checklist final en producción para el propietario

Los correos reales, el consentimiento de Google y la recepción en WhatsApp requieren este recorrido con tu propia cuenta. No sustituyas el correo real por uno ficticio en producción.

1. **Registro:** abre Ingresar → Crear cuenta. Usa tu nombre, celular, correo y una contraseña de ocho caracteres o más. Comprueba el aviso y el perfil.
2. **Verificación:** revisa bandeja y spam. Antes de verificar, el pedido debe quedar bloqueado. Abre el enlace y pulsa Ya verifiqué mi correo. Comprueba el límite de Reenviar correo.
3. **Login:** cierra sesión, ingresa con correo/contraseña y comprueba también Ingresar con Google. La cuenta debe mostrar tu nombre.
4. **Recuperación:** escribe el correo en Ingresar, pulsa Olvidé mi contraseña y sigue el enlace del correo.
5. **Pedido:** añade un producto, revisa cantidades y elige domicilio urbano, fuera de zona o recogida. Añade una nota. Continúa y verifica el mensaje; envíalo solo si realmente quieres pedir.
6. **Historial:** abre Mis pedidos y comprueba productos, cantidades, total y fecha. Continuar dos veces con los mismos datos debe conservar el mismo ID; repetir expresamente usa Crear otra solicitud.
7. **Logout:** cierra sesión y vuelve a abrir el carrito. No debe mostrar datos personales del usuario anterior. Los productos deben permanecer. Recarga y comprueba que otra cuenta vea solo su historial.

## Correcciones adicionales aplicadas

- El botón flotante de pedido ahora abre el carrito para pasar por la cuenta verificada; el contacto general por WhatsApp sigue disponible.

- El foco del carrito se perdía al reconstruir controles; ahora vuelve al control equivalente o al siguiente disponible.
- Cargar más productos dejaba el foco atrás; ahora pasa al primer producto nuevo.
- JSON-LD y contadores se regeneran desde el catálogo para evitar divergencias futuras; se corrigió la expresión de búsqueda del generador.
- El pedido guardado usa un ID estable para evitar duplicados durante reintentos.
- Los datos de entrega se separan por UID y los campos visibles se limpian al cerrar sesión.
- Una dependencia de pruebas tenía un aviso de seguridad; se fijó la versión corregida compatible de gRPC.

## Limitaciones concretas

Firebase bloqueó la personalización de remitente/asunto en APP PRUEBA; el idioma español sí está aplicado. El README contiene el enlace de soporte y el cambio pendiente cuando Firebase lo habilite.

Un registro en Firestore es una solicitud pendiente. No prueba que WhatsApp se haya enviado ni que el restaurante haya confirmado el pedido. Los precios se calculan en la página; el restaurante debe verificar el presupuesto. Las imágenes siguen dependiendo de sus URLs originales en pacosarauca.com.
