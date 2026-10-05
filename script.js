import { CATALOG, CATEGORIES } from "./catalog.js";
import { initializeAccount, accountReady, getSession, showAccount, refreshVerification } from "./account.js";
import { saveProfile, storeOrder, spanishError } from "./firebase-service.js";

const PACOS = Object.freeze({ whatsapp: "573132009287", menu: "https://www.pacosarauca.com/", facebook: "https://www.facebook.com/pacosburger/" });
// Agrega únicamente testimonios reales autorizados: { text: "…", author: "…" }.
const TESTIMONIALS = [];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const nav = $("#main-nav");
const toggle = $(".menu-toggle");
function closeNav(restoreFocus = false) {
  nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Abrir menú"); $("use", toggle).setAttribute("href", "#i-menu"); if (restoreFocus) toggle.focus();
}
toggle.addEventListener("click", () => {
  const open = !nav.classList.contains("is-open"); nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú"); $("use", toggle).setAttribute("href", open ? "#i-close" : "#i-menu");
});
$$('a[href^="#"]', nav).forEach((link) => link.addEventListener("click", () => closeNav()));
document.addEventListener("click", (event) => { if (!event.target.closest(".site-header")) closeNav(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && nav.classList.contains("is-open")) closeNav(true); });
window.matchMedia("(min-width: 981px)").addEventListener("change", (event) => { if (event.matches) closeNav(); });
const header = $("#site-header");
function updateHeader() { header.classList.toggle("is-scrolled", window.scrollY > 30); }
window.addEventListener("scroll", updateHeader, { passive: true }); updateHeader();
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) { if (!entry.isIntersecting) continue; $$('a[href^="#"]', nav).forEach((link) => { const active = link.getAttribute("href") === `#${entry.target.id}`; link.classList.toggle("is-active", active); if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); }); }
  }, { rootMargin: "-18% 0px -65% 0px", threshold: 0 });
  $$("main section[id]").forEach((section) => observer.observe(section));
}

// Carta importada del HTML original adjunto por el usuario el 4 de octubre de 2026.
// El menú se mantiene en catalog.js.


const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const PAGE_SIZE = 12;
let visibleLimit = PAGE_SIZE;
let activeFilter = "todos";
const search = $("#menu-search");
let cart = [];
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function cartProduct(line) {
  if (!line || typeof line !== "object") return null;
  const product = CATALOG.find((item) => item.id === line.productId);
  const variant = product?.variants.find((item) => item.id === line.variantId);
  return product && variant ? { product, variant } : null;
}
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("pacos-cart-v2") || "[]");
    if (!Array.isArray(saved)) return;
    cart = [];
    saved.forEach((line) => {
      if (!cartProduct(line) || !Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > 99) return;
      const existing = cart.find((item) => item.productId === line.productId && item.variantId === line.variantId);
      if (existing) existing.quantity = Math.min(99, existing.quantity + line.quantity);
      else cart.push({ productId: line.productId, variantId: line.variantId, quantity: line.quantity });
    });
  } catch { cart = []; }
}
function saveCart() { try { localStorage.setItem("pacos-cart-v2", JSON.stringify(cart)); } catch {} }
function cartSubtotal() { return cart.reduce((total, line) => total + cartProduct(line).variant.price * line.quantity, 0); }
function deliveryFee() {
  const form = $("#order-form");
  if (form.elements.delivery.value !== "domicilio" || !cart.length) return 0;
  return form.elements.zone.value === "fuera" ? 6000 : 5000;
}
function cartLines() {
  return cart.map((line) => {
    const { product, variant } = cartProduct(line);
    return `${line.quantity} × ${product.category}: ${product.name}${variant.label ? ` (${variant.label})` : ""} - ${money(variant.price * line.quantity)}`;
  });
}
function addToCart(productId, variantId, quantity = 1) {
  if (!cartProduct({productId,variantId}) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
  const existing = cart.find(line => line.productId === productId && line.variantId === variantId);
  if ((existing?.quantity || 0) + quantity > 99) { announceCart("Puedes añadir hasta 99 unidades por opción."); return false; }
  if (existing) existing.quantity += quantity; else cart.push({productId,variantId,quantity});
  renderCart(); saveCart();
  const product = CATALOG.find(item => item.id === productId);
  announceCart(quantity === 1 ? product.name + " añadido al pedido." : quantity + " de " + product.name + " añadidos al pedido.");
  return true;
}
function changeQuantity(index, change) {
  const line = cart[index];
  if (!line) return;
  line.quantity = Math.min(99, line.quantity + change);
  if (line.quantity <= 0) cart.splice(index, 1);
  renderCart(); saveCart();
}
function renderCart() {
  const list = $("#cart-items");
  const focusedControl = document.activeElement?.closest("[data-cart-action]");
  const focusedRow = focusedControl?.closest(".cart-row");
  const focusKey = focusedRow?.dataset.cartKey;
  const focusIndex = focusedRow ? [...list.children].indexOf(focusedRow) : -1;
  const focusAction = focusedControl?.dataset.cartAction;
  list.replaceChildren();
  const count = cart.reduce((total, line) => total + line.quantity, 0);
  $("#cart-count").textContent = String(count);
  $("#cart-empty").hidden = cart.length !== 0;
  $("#cart-totals").hidden = cart.length === 0;
  $("#checkout-fields").hidden = cart.length === 0;
  $("#cart-bar").hidden = cart.length === 0;
  $("#cart-bar-label").textContent = `${count} ${count === 1 ? "producto" : "productos"} · ${money(cartSubtotal())}`;
  cart.forEach((line, index) => {
    const { product, variant } = cartProduct(line);
    const row = makeElement("div", "cart-row"); row.dataset.cartKey = `${line.productId}:${line.variantId}`;
    const description = makeElement("div", "cart-description");
    description.append(makeElement("strong", "", product.name));
    description.append(makeElement("small", "muted", product.category));
    if (variant.label) description.append(makeElement("small", "muted", variant.label));
    description.append(makeElement("span", "", `${money(variant.price)} por unidad`));
    const controls = makeElement("div", "cart-controls");
    const minus = makeElement("button", "quantity-button", "−"); minus.type = "button"; minus.dataset.cartAction = "minus"; minus.setAttribute("aria-label", `Disminuir cantidad de ${product.name}`); minus.addEventListener("click", () => changeQuantity(index, -1));
    const plus = makeElement("button", "quantity-button", "+"); plus.type = "button"; plus.dataset.cartAction = "plus"; plus.disabled = line.quantity >= 99; plus.setAttribute("aria-label", `Aumentar cantidad de ${product.name}`); plus.addEventListener("click", () => changeQuantity(index, 1));
    const amount = makeElement("span", "cart-quantity", String(line.quantity));
    controls.append(minus, amount, plus);
    const remove = makeElement("button", "cart-remove", "Quitar"); remove.type = "button"; remove.dataset.cartAction = "remove"; remove.setAttribute("aria-label", `Quitar ${product.name} del pedido`); remove.addEventListener("click", () => { cart.splice(index, 1); renderCart(); saveCart(); });
    row.append(description, makeElement("strong", "cart-line-price", money(variant.price * line.quantity)), controls, remove);
    list.append(row);
  });
  $("#cart-subtotal").textContent = money(cartSubtotal());
  $("#cart-delivery").textContent = money(deliveryFee());
  $("#cart-total").textContent = money(cartSubtotal() + deliveryFee());
  if (focusKey) {
    const row = [...list.children].find(item => item.dataset.cartKey === focusKey) || list.children[Math.min(focusIndex, list.children.length - 1)];
    const target = row ? [...row.querySelectorAll("[data-cart-action]")].find(item => item.dataset.cartAction === focusAction && !item.disabled) || row.querySelector("[data-cart-action]:not(:disabled)") : $("#browse-products");
    target?.focus({ preventScroll: true });
  }
}
let menuMode = "categories";
let searchFromCategories = false;
let previousCategoryButton = null;
let categoryScrollPosition = 0;
let cartToastTimer;
let detailProduct = null;
let detailVariantId = "";
const productDialog = $("#product-dialog");
const detailQuantity = $("#product-quantity");
const detailAdd = $("#product-detail-add");

function announceCart(message) {
  const status = $("#cart-status");
  status.textContent = message;
  clearTimeout(cartToastTimer);
  cartToastTimer = setTimeout(() => { status.textContent = ""; }, 4500);
}
function setMenuView(mode) {
  menuMode = mode;
  $("#menu-categories").hidden = mode !== "categories";
  $("#category-products").hidden = mode === "categories";
  $("#menu").classList.toggle("is-browsing-products", mode === "products");
  $("#menu").setAttribute("aria-labelledby", mode === "categories" ? "menu-title" : "category-products-title");
  $("#menu-discovery-copy").textContent = mode === "categories" ? "Nueve categorías. Un montón de buenos antojos." : "Encuentra tu favorito por nombre, ingrediente o sabor.";
}
function showCategories(restoreFocus = true) {
  activeFilter = "todos"; visibleLimit = PAGE_SIZE; search.value = ""; searchFromCategories = false;
  setMenuView("categories"); search.placeholder = "Busca tu antojo…";
  $$("[data-filter]").forEach(button => { const active = button.dataset.filter === "todos"; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  $$("[data-category-open]").forEach(button => button.setAttribute("aria-expanded", "false"));
  if (restoreFocus) {
    window.scrollTo({ top: categoryScrollPosition, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    (previousCategoryButton || search).focus({ preventScroll: true });
  }
}
function syncCategoryHeading(products) {
  const isSearch = !!normalize(search.value);
  $("#category-products-title").textContent = isSearch ? "Tu búsqueda." : activeFilter === "todos" ? "Toda la carta." : activeFilter + ".";
  $("#category-products-kicker").textContent = isSearch ? "ENCUENTRA TU ANTOJO" : "HECHO PARA PROVOCAR";
  $("#category-products-count").textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}${activeFilter !== "todos" ? " en " + activeFilter.toLowerCase() : " para elegir"}`;
  search.placeholder = activeFilter === "todos" ? "Busca tu antojo…" : `Buscar en ${activeFilter.toLowerCase()}…`;
}
function renderProducts() {
  if (menuMode === "categories") return;
  const grid = $("#menu-grid"); grid.replaceChildren();
  const query = normalize(search.value);
  const products = CATALOG.filter(product => (activeFilter === "todos" || product.category === activeFilter) && normalize(`${product.name} ${product.category} ${product.description} ${product.variants.map(v => v.label).join(" ")}`).includes(query));
  syncCategoryHeading(products);
  products.slice(0, visibleLimit).forEach(product => {
    const article = makeElement("article", "food-card product-card"); article.dataset.productId = product.id;
    const open = makeElement("button", "product-card-button"); open.type = "button"; open.dataset.productOpen = product.id;
    open.setAttribute("aria-haspopup", "dialog"); open.setAttribute("aria-controls", "product-dialog");
    open.setAttribute("aria-label", `Ver ${product.name} de ${product.category}`);
    const image = makeElement("span", "food-image product-image");
    if (product.image) {
      const img = makeElement("img"); img.src = product.image; img.alt = ""; img.width = 600; img.height = 450; img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("error", () => { image.classList.add("image-unavailable"); image.dataset.imageLabel = product.name; });
      img.addEventListener("load", () => image.classList.remove("image-unavailable")); image.append(img);
    } else image.append(makeElement("span", "product-image-label", product.name));
    const info = makeElement("span", "food-info");
    const name = makeElement("span", "product-name", product.name);
    const description = makeElement("span", "product-description", product.description);
    const lowest = Math.min(...product.variants.map(v => v.price));
    const price = makeElement("strong", "product-price", `${new Set(product.variants.map(v => v.price)).size > 1 ? "Desde " : ""}${money(lowest)}`);
    const foot = makeElement("span", "product-card-foot");
    foot.append(makeElement("span", "", product.variants.length > 1 ? `Elegir ${product.variantType === "flavor" ? "sabor" : "tamaño"}` : "Ver producto"));
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg"); arrow.setAttribute("class", "icon"); arrow.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use"); use.setAttribute("href", "#i-arrow"); arrow.append(use); foot.append(arrow);
    info.append(makeElement("small", "product-category", product.category), name, description, price, foot);
    open.append(image, info); open.addEventListener("click", () => openProduct(product.id)); article.append(open); grid.append(article);
  });
  $("#empty-menu").hidden = products.length > 0;
  $("#menu-result").textContent = `Mostrando ${Math.min(products.length, visibleLimit)} de ${products.length} ${products.length === 1 ? "producto" : "productos"}.`;
  $("#load-more-products").hidden = products.length <= visibleLimit;
}
function setFilter(filter) {
  if (filter !== "todos" && !CATEGORIES.includes(filter)) return;
  activeFilter = filter; visibleLimit = PAGE_SIZE; searchFromCategories = false; setMenuView("products");
  $$("[data-filter]").forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  renderProducts();
}
function openCategory(category, button) {
  categoryScrollPosition = window.scrollY; previousCategoryButton = button || null;
  search.value = ""; setFilter(category);
  $$("[data-category-open]").forEach(item => item.setAttribute("aria-expanded", String(item.dataset.categoryOpen === category)));
  $("#category-products").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  $("#category-products-title").focus({ preventScroll: true });
}
function updateProductSelection() {
  if (!detailProduct) return;
  const variant = detailProduct.variants.find(item => item.id === detailVariantId);
  const quantity = Number(detailQuantity.value);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
  const existing = cart.find(line => line.productId === detailProduct.id && line.variantId === detailVariantId);
  const remaining = 99 - (existing?.quantity || 0);
  const valid = !!variant && validQuantity && quantity <= remaining;
  const lowest = Math.min(...detailProduct.variants.map(item => item.price));
  $("#product-detail-price").textContent = variant ? money(variant.price) : `${new Set(detailProduct.variants.map(item => item.price)).size > 1 ? "Desde " : ""}${money(lowest)}`;
  $("#product-price-caption").textContent = variant ? "Precio por unidad" : detailProduct.variantType === "flavor" ? "Elige tu sabor favorito" : "Selecciona una presentación";
  $("#product-qty-minus").disabled = validQuantity && quantity <= 1;
  $("#product-qty-plus").disabled = validQuantity && quantity >= 99;
  detailAdd.disabled = !valid;
  detailAdd.textContent = valid ? `Añadir ${quantity === 1 ? "al pedido" : quantity + " al pedido"} · ${money(variant.price * quantity)}` : !variant ? "Elige una opción para continuar" : "Revisa la cantidad";
  detailAdd.setAttribute("aria-label", valid ? `Añadir ${quantity} de ${detailProduct.name}${variant.label ? " " + variant.label : ""} por ${money(variant.price * quantity)}` : detailAdd.textContent);
  const feedback = $("#product-detail-feedback");
  feedback.textContent = variant && validQuantity && quantity > remaining ? remaining > 0 ? `Ya tienes ${existing.quantity} en el pedido. Puedes añadir ${remaining} más de esta opción.` : "Ya tienes 99 unidades de esta opción en el pedido." : "";
  feedback.hidden = !feedback.textContent;
}
function openProduct(productId) {
  const product = CATALOG.find(item => item.id === productId); if (!product) return;
  detailProduct = product; detailVariantId = product.variants.length === 1 ? product.variants[0].id : ""; detailQuantity.value = "1";
  $("#product-dialog-title").textContent = product.name;
  $("#product-dialog-category").textContent = product.category;
  $("#product-dialog-description").textContent = product.description;
  const photo = $("#product-detail-photo"); photo.replaceChildren(); photo.classList.remove("image-unavailable");
  if (product.image) {
    const img = makeElement("img"); img.src = product.image; img.alt = product.name; img.width = 700; img.height = 700; img.loading = "lazy"; img.decoding = "async";
    img.addEventListener("error", () => { if (img.parentElement !== photo) return; photo.classList.add("image-unavailable"); photo.dataset.imageLabel = product.name; });
    img.addEventListener("load", () => { if (img.parentElement === photo) photo.classList.remove("image-unavailable"); }); photo.append(img);
  } else photo.append(makeElement("span", "detail-photo-label", product.name));
  const panel = $("#product-options-panel"); panel.hidden = product.variants.length === 1;
  $("#product-options-legend").textContent = product.variantType === "flavor" ? "Elige un sabor" : "Elige el tamaño / presentación";
  const options = $("#product-detail-options"); options.replaceChildren();
  if (product.variants.length > 1) product.variants.forEach((variant, index) => {
    const label = makeElement("label", "product-option");
    const radio = makeElement("input"); radio.type = "radio"; radio.name = "product-option"; radio.value = variant.id; radio.id = `detail-option-${index}`;
    const copy = makeElement("span", "option-copy"); copy.append(makeElement("strong", "option-name", variant.label), makeElement("span", "option-price", money(variant.price)));
    label.append(radio, copy); options.append(label);
  });
  updateProductSelection(); openDialog(productDialog);
}
$("#product-detail-options").addEventListener("change", event => {
  if (event.target.name !== "product-option") return;
  detailVariantId = event.target.value;
  $$(".product-option", productDialog).forEach(label => label.classList.toggle("is-selected", $("input", label).checked));
  updateProductSelection();
});
detailQuantity.addEventListener("input", updateProductSelection);
[["#product-qty-minus", -1], ["#product-qty-plus", 1]].forEach(([selector, delta]) => $(selector).addEventListener("click", () => {
  const current = Number(detailQuantity.value); detailQuantity.value = String(Math.max(1, Math.min(99, (Number.isInteger(current) ? current : 1) + delta))); updateProductSelection();
}));
detailAdd.addEventListener("click", () => {
  if (detailAdd.disabled || !detailProduct || !detailQuantity.reportValidity()) return;
  if (addToCart(detailProduct.id, detailVariantId, Number(detailQuantity.value))) productDialog.close();
});
productDialog.addEventListener("close", () => { detailProduct = null; $("#product-detail-photo").replaceChildren(); });

const filters = $(".filters"); filters.replaceChildren();
["todos", ...CATEGORIES].forEach(category => {
  const count = category === "todos" ? CATALOG.length : CATALOG.filter(product => product.category === category).length;
  const button = makeElement("button", "filter", `${category === "todos" ? "Todo el menú" : category} (${count})`); button.dataset.filter = category; button.type = "button"; button.setAttribute("aria-pressed", String(category === "todos"));
  if (category === "todos") button.classList.add("is-active"); button.addEventListener("click", () => setFilter(category)); filters.append(button);
});
$$('[data-category-open]').forEach(button => button.addEventListener("click", () => openCategory(button.dataset.categoryOpen, button)));
$("#show-categories").addEventListener("click", () => showCategories());
$$('a[href="#menu"]').forEach(link => link.addEventListener("click", () => showCategories(false)));
search.addEventListener("input", () => {
  visibleLimit = PAGE_SIZE;
  if (menuMode === "categories" && normalize(search.value)) { previousCategoryButton = null; categoryScrollPosition = window.scrollY; searchFromCategories = true; setMenuView("products"); activeFilter = "todos"; }
  if (searchFromCategories && !normalize(search.value)) { showCategories(false); return; }
  renderProducts();
});
$("#load-more-products").addEventListener("click", () => {
  const previousCount = $("#menu-grid").children.length;
  visibleLimit += PAGE_SIZE; renderProducts();
  $("#menu-grid").children[previousCount]?.querySelector("button")?.focus({ preventScroll: true });
});
$("#reset-search").addEventListener("click", () => { search.value = ""; setFilter("todos"); search.focus(); });
$$('[name="delivery"],[name="zone"]').forEach(input => input.addEventListener("change", renderCart));
loadCart(); renderCart(); showCategories(false);


const dialogs = $$("dialog");
const orderDialog = $("#order-dialog");
const orderForm = $("#order-form");
const orderFeedback = $("#order-feedback");
function openDialog(dialog) { closeNav(); document.body.classList.add("dialog-open"); if (!dialog.open) dialog.showModal(); }
dialogs.forEach((dialog) => {
  dialog.addEventListener("close", () => { if (!dialogs.some((item) => item.open)) document.body.classList.remove("dialog-open"); if (dialog.id === "gallery-dialog") $("#gallery-preview").removeAttribute("src"); });
  dialog.addEventListener("click", (event) => { if (event.target !== dialog) return; const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); });
  $$("[data-close-dialog]", dialog).forEach((button) => button.addEventListener("click", () => dialog.close()));
});
$$("[data-order]").forEach((button) => button.addEventListener("click", () => { renderCart(); orderFeedback.hidden = true; openDialog(orderDialog); }));
function updateDelivery() { const delivery = orderForm.elements.delivery.value; $("#delivery-fields").hidden = delivery !== "domicilio"; orderForm.elements.address.required = delivery === "domicilio"; orderForm.elements.address.disabled = delivery !== "domicilio"; orderForm.elements.zone.disabled = delivery !== "domicilio"; }
$$('input[name="delivery"]').forEach((input) => input.addEventListener("change", updateDelivery)); updateDelivery();
let orderBusy = false;
const pendingRequests = new Map();
function requestId(uid, values) {
  const key = `pacos-order-request:${uid}`;
  const fingerprint = JSON.stringify(values);
  if(pendingRequests.get(key)?.fingerprint === fingerprint) return pendingRequests.get(key).id;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved?.fingerprint === fingerprint && /^[a-f0-9-]{36}$/.test(saved.id)) {pendingRequests.set(key,saved);return saved.id;}
  } catch {}
  const id = crypto.randomUUID();
  pendingRequests.set(key,{id,fingerprint});
  try { localStorage.setItem(key, JSON.stringify({id,fingerprint})); } catch {}
  return id;
}
orderForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (orderBusy || !cart.length || !orderForm.reportValidity()) return;
  const data = new FormData(orderForm);
  const value = key => String(data.get(key) || "").trim();
  const phone = value("phone").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    orderFeedback.textContent = "Escribe un celular válido con entre 10 y 15 dígitos.";
    orderFeedback.hidden = false;
    return;
  }
  const values = {
    products: cart.map(line => `${line.productId}:${line.variantId}`),
    quantities: cart.map(line => line.quantity),
    unitPrices: cart.map(line => cartProduct(line).variant.price),
    subtotal: cartSubtotal(), deliveryCost: deliveryFee(), total: cartSubtotal() + deliveryFee(),
    customer: value("customer"), phone, delivery: value("delivery"),
    address: value("delivery") === "domicilio" ? value("address") : "",
    zone: value("delivery") === "domicilio" ? value("zone") : "",
    payment: value("payment"), notes: value("notes")
  };
  const productLines = cartLines();
  let popup;
  orderBusy = true;
  const submit = $("#order-submit");
  submit.disabled = true; orderForm.setAttribute("aria-busy", "true");
  orderFeedback.textContent = "Comprobando tu cuenta…"; orderFeedback.hidden = false;
  try {
    await accountReady();
    const {user} = getSession();
    if (!user) {showAccount(); throw {code:"app/signed-out"};}
    if (!await refreshVerification()) {showAccount(); throw {code:"app/unverified"};}
    // El enlace visible permite continuar si el navegador bloquea esta ventana.
    popup = window.open("about:blank", "_blank");
    if (popup) {popup.opener = null; popup.document.title = "Preparando tu pedido"; popup.document.body.textContent = "Guardando tu solicitud de Paco’s…";}
    orderFeedback.textContent = "Guardando tu pedido…";
    await saveProfile({name:values.customer,phone,address:orderForm.elements.address.value.trim()},user.uid);
    if (getSession().user?.uid !== user.uid) throw {code:"app/signed-out"};
    const id = requestId(user.uid, values);
    await storeOrder(id, values, user.uid);
    saveCheckout();
    const lines = ["¡Hola, Paco’s! Quiero solicitar un pedido.",`Solicitud: ${id}`,"",`Nombre: ${values.customer}`,`Celular: ${phone}`,"Pedido:",...productLines,"",`Subtotal: ${money(values.subtotal)}`,`Domicilio: ${money(values.deliveryCost)}`,`Total: ${money(values.total)}`,"",`Entrega: ${values.delivery === "domicilio" ? "Domicilio" : "Recoger en el local"}`];
    if(values.delivery === "domicilio") lines.push(`Dirección: ${values.address}`,`Zona: ${values.zone === "urbano" ? "Urbana (domicilio $5.000)" : "Fuera de zona urbana (domicilio $6.000)"}`);
    lines.push(`Pago: ${values.payment}`);
    if(values.notes)lines.push(`Notas: ${values.notes}`);
    lines.push("","Por favor, confírmenme disponibilidad y tiempo de entrega. Gracias.");
    const url = `https://wa.me/${PACOS.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    if(popup && !popup.closed)popup.location.href = url;
    const fallback = document.createElement("a"); fallback.href = url; fallback.target = "_blank"; fallback.rel = "noopener noreferrer"; fallback.textContent = "abrir el mensaje en WhatsApp";
    const another = makeElement("button", "text-link forget-checkout", "Crear otra solicitud con este carrito"); another.type = "button";
    another.addEventListener("click",()=>{
      try{localStorage.removeItem(`pacos-order-request:${user.uid}`);}catch{}
      pendingRequests.delete(`pacos-order-request:${user.uid}`);
      orderFeedback.textContent = "Puedes crear otra solicitud al continuar. Confirma con el restaurante si necesitas repetir el pedido.";
      submit.focus();
    });
    orderFeedback.replaceChildren(document.createTextNode(`Solicitud ${id.slice(-8).toUpperCase()} guardada. Revisa y envía el mensaje en WhatsApp. Si no se abrió, puedes `),fallback,document.createTextNode(". Volver a continuar conserva esta solicitud para evitar duplicarla."),another);
  } catch(error) {
    if(popup && !popup.closed)popup.close();
    orderFeedback.textContent = spanishError(error);
  } finally {orderBusy=false;submit.disabled=false;orderForm.setAttribute("aria-busy","false");}
});


function imageFallback(img) { if (img.closest(".brand")) { img.style.display = "none"; return; } const surface = img.parentElement; surface.classList.add("image-unavailable"); surface.dataset.imageLabel = img.alt || "Paco’s"; }
$$("img").forEach((img) => { img.addEventListener("error", () => imageFallback(img)); img.addEventListener("load", () => img.parentElement.classList.remove("image-unavailable")); if (img.getAttribute("src") && img.complete && img.naturalWidth === 0) imageFallback(img); });
$$("[data-gallery]").forEach((button) => button.addEventListener("click", () => { const img = $("#gallery-preview"); img.parentElement.classList.remove("image-unavailable"); img.src = button.dataset.gallery; img.alt = button.dataset.caption; $("#gallery-caption").textContent = button.dataset.caption; openDialog($("#gallery-dialog")); }));
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("motion-ready"); const observer = new IntersectionObserver((entries, observer) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }); }, { threshold: 0.08 }); $$(".reveal").forEach((element) => observer.observe(element));
}
if (TESTIMONIALS.length) { const container = $("#testimonials-container"); container.replaceChildren(); TESTIMONIALS.forEach((testimonial) => { const block = document.createElement("figure"); const quote = document.createElement("blockquote"); const author = document.createElement("figcaption"); quote.className = "testimonial-quote"; author.className = "testimonial-author"; quote.textContent = testimonial.text; author.textContent = testimonial.author; block.append(quote, author); container.append(block); }); }
$("#year").textContent = new Date().getFullYear();

$("#browse-products").addEventListener("click",()=>{orderDialog.close();showCategories(false);$("#menu").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});});

// Solo datos de entrega y notas: nunca contraseñas ni credenciales.
let CHECKOUT_KEY = "pacos-checkout-v1";
let checkoutOwner = null;
let checkoutInitialized = false;
const checkoutLimits = { customer: 80, phone: 20, address: 180, notes: 500 };
const checkoutOptions = { delivery: ["domicilio", "recoger"], zone: ["urbano", "fuera"], payment: ["Efectivo", "Transferencia (Nequi, Bre-B o Daviplata)"] };
function saveCheckout() {
  const values = {};
  for (const [key, limit] of Object.entries(checkoutLimits)) values[key] = orderForm.elements[key].value.slice(0, limit);
  for (const key of Object.keys(checkoutOptions)) values[key] = orderForm.elements[key].value;
  try { localStorage.setItem(CHECKOUT_KEY, JSON.stringify(values)); } catch {}
}
function restoreCheckout() {
  try {
    const values = JSON.parse(localStorage.getItem(CHECKOUT_KEY) || "{}");
    if (!values || typeof values !== "object" || Array.isArray(values)) return;
    for (const [key, limit] of Object.entries(checkoutLimits)) if (typeof values[key] === "string") orderForm.elements[key].value = values[key].slice(0, limit);
    for (const [key, options] of Object.entries(checkoutOptions)) if (options.includes(values[key])) orderForm.elements[key].value = values[key];
  } catch {}
}
orderForm.addEventListener("input", saveCheckout);
orderForm.addEventListener("change", saveCheckout);
restoreCheckout(); updateDelivery(); renderCart();
$("#forget-checkout").addEventListener("click", () => {
  try { localStorage.removeItem(CHECKOUT_KEY); } catch {}
  orderForm.reset(); updateDelivery(); renderCart();
  orderForm.elements.customer.focus();
  orderFeedback.textContent = "Datos de entrega y notas borrados de este dispositivo.";
  orderFeedback.hidden = false;
});

// Cada sesión usa su propia copia local; cerrar sesión limpia los campos visibles.
initializeAccount({openDialog,onProfile(user,profile){
  const uid=user?.uid || null;
  if(!checkoutInitialized || uid!==checkoutOwner){
    const migratingGuest=checkoutOwner===null && !!uid;
    let guest;
    if(migratingGuest){try{guest=localStorage.getItem("pacos-checkout-v1");}catch{}}
    checkoutOwner=uid;checkoutInitialized=true;CHECKOUT_KEY=uid ? `pacos-checkout-v1:${uid}` : "pacos-checkout-v1";
    orderForm.reset();
    if(migratingGuest && guest){try{if(!localStorage.getItem(CHECKOUT_KEY))localStorage.setItem(CHECKOUT_KEY,guest);localStorage.removeItem("pacos-checkout-v1");}catch{}}
    restoreCheckout();
  }
  if(user && profile){
    for(const [field,key] of [["customer","name"],["phone","phone"],["address","address"]])if(!orderForm.elements[field].value)orderForm.elements[field].value=profile[key] || "";
  }
  updateDelivery();renderCart();
}}).catch(()=>{});
if("ResizeObserver" in window)new ResizeObserver(()=>document.documentElement.style.setProperty("--header-offset", `${header.getBoundingClientRect().height+16}px`)).observe(header);
