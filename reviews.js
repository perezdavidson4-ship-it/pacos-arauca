import { getFirebase, spanishError } from './firebase-service.js';
import { accountReady, getSession, showAccount, refreshVerification } from './account.js';

const $ = selector => document.querySelector(selector);
const PHOTO_LIMIT = 88000; // Una foto JPEG pequeña, aproximadamente 64 KiB.
const PAGE_SIZE = 12;
let modal, openModal, ownerUid = null, ownReview = null, photo = '', photoGeneration = 0;
let busy = false, processingPhoto = false, sessionGeneration = 0, cursor = null, loaded = false;
let fetching = false, reviewRows = [], fallbackReviews = [];
const feedback = message => { $('#review-feedback').textContent = message; };
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function updateButtons() {
  $('#review-submit').disabled = busy || processingPhoto;
  $('#review-fields').disabled = busy;
  $('#review-delete').disabled = busy;
  $('#review-confirm-delete').disabled = busy;
  modal.setAttribute('aria-busy', String(busy || processingPhoto));
}
function setBusy(value) { busy = value; updateButtons(); }
function paintRating() {
  const rating = Number($('#review-form').elements.rating.value);
  document.querySelectorAll('.rating-input label').forEach(label => label.classList.toggle('is-chosen', Number(label.querySelector('input').value) <= rating));
}
function previewPhoto() {
  const preview = $('#review-photo-preview');
  preview.hidden = !photo;
  if (photo) preview.src = photo; else preview.removeAttribute('src');
  $('#review-remove-photo').hidden = !photo;
}
function resetDraft() {
  photoGeneration++; photo = ''; processingPhoto = false;
  $('#review-form').reset(); previewPhoto(); paintRating();
  $('#review-delete-confirm').hidden = true;
}
async function syncSession() {
  const generation = ++sessionGeneration;
  const {user, profile} = getSession();
  if (ownerUid && ownerUid !== user?.uid) resetDraft();
  ownerUid = user?.uid || null; ownReview = null;
  $('#review-account-note').textContent = !user ? 'Ingresa y verifica tu correo para publicar una reseña.' : !user.emailVerified ? 'Verifica tu correo desde Mi cuenta antes de publicar.' : 'Puedes publicar una reseña y actualizarla cuando quieras.';
  $('#review-account-button').hidden = !!user?.emailVerified;
  $('#review-delete').hidden = true;
  $('#review-submit').textContent = 'Publicar reseña';
  if (!user) { updateButtons(); return; }
  if (!$('#review-form').elements.name.value) $('#review-form').elements.name.value = profile?.name || user.displayName || '';
  try {
    const {db, dbSDK} = await getFirebase();
    const snapshot = await dbSDK.getDoc(dbSDK.doc(db, 'reviews', user.uid));
    if (generation !== sessionGeneration || getSession().user?.uid !== user.uid) return;
    if (snapshot.exists()) {
      ownReview = snapshot.data();
      $('#review-form').elements.name.value = ownReview.name;
      $('#review-form').elements.text.value = ownReview.text;
      $('#review-form').elements.rating.value = String(ownReview.rating);
      photo = ownReview.photo || ''; previewPhoto(); paintRating();
      $('#review-delete').hidden = false;
      $('#review-submit').textContent = 'Guardar cambios';
    }
  } catch (error) { if (generation === sessionGeneration && modal.open) feedback(spanishError(error)); }
  updateButtons();
}
function renderReviews() {
  const list = $('#reviews-list'); list.replaceChildren();
  const rows = reviewRows.length ? reviewRows : fallbackReviews;
  for (const review of rows) {
    const card = element('article', 'review-card');
    card.append(element('h3', '', review.name || review.author));
    if (review.rating) {
      const stars = element('span', 'review-stars');
      stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', `${review.rating} de 5 estrellas`);
      const filled = element('span', '', '★'.repeat(review.rating)); filled.setAttribute('aria-hidden', 'true');
      const empty = element('span', 'muted', '★'.repeat(5 - review.rating)); empty.setAttribute('aria-hidden', 'true');
      stars.append(filled, empty); card.append(stars);
    }
    card.append(element('p', 'review-text', review.text));
    if (review.photo) {
      const button = element('button', 'review-photo-button'); button.type = 'button';
      button.setAttribute('aria-label', `Ampliar foto de la reseña de ${review.name}`);
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'gallery-dialog');
      const img = element('img'); img.src = review.photo; img.alt = 'Foto compartida en la reseña';
      img.width = 640; img.height = 480; img.loading = 'lazy'; img.decoding = 'async'; button.append(img);
      button.addEventListener('click', () => {
        $('#gallery-preview').src = review.photo; $('#gallery-preview').alt = 'Foto compartida en la reseña';
        $('#gallery-caption').textContent = `Foto de la reseña de ${review.name}`;
        openModal($('#gallery-dialog'));
      });
      card.append(button);
    }
    const timestamp = review.updatedAt?.toDate?.();
    if (timestamp) { const time = element('time', 'review-date', timestamp.toLocaleDateString('es-CO', {day:'numeric',month:'long',year:'numeric'})); time.dateTime = timestamp.toISOString(); card.append(time); }
    list.append(card);
  }
  $('#opiniones').hidden = rows.length === 0;
  document.querySelectorAll('a[href="#opiniones"]').forEach(link => { link.hidden = rows.length === 0; });
}
async function loadReviews(reset = false) {
  if (fetching) return;
  fetching = true; $('#reviews-more').disabled = true; $('#reviews-status').textContent = 'Cargando reseñas…';
  try {
    const {db, dbSDK} = await getFirebase();
    const clauses = [dbSDK.orderBy('updatedAt', 'desc')];
    if (!reset && cursor) clauses.push(dbSDK.startAfter(cursor));
    clauses.push(dbSDK.limit(PAGE_SIZE));
    const result = await dbSDK.getDocs(dbSDK.query(dbSDK.collection(db, 'reviews'), ...clauses));
    const next = result.docs.map(doc => ({id:doc.id, ...doc.data()}));
    reviewRows = reset ? next : [...reviewRows, ...next.filter(row => !reviewRows.some(item => item.id === row.id))];
    cursor = result.docs.at(-1) || null; loaded = true;
    $('#reviews-more').hidden = result.size < PAGE_SIZE;
    renderReviews(); $('#reviews-status').textContent = '';
  } catch { $('#reviews-status').textContent = 'No pudimos cargar las reseñas. Puedes intentarlo de nuevo desde Escribir una reseña.'; renderReviews(); }
  finally { fetching = false; $('#reviews-more').disabled = false; }
}
async function compressPhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Elige una imagen JPG, PNG o WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch { throw new Error('No pudimos abrir esa imagen. Prueba con otra foto.'); }
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('La foto es demasiado grande. Elige una imagen de menor resolución.');
    const canvas = document.createElement('canvas');
    for (const size of [640,480,320]) {
      const scale = Math.min(1, size / Math.max(img.naturalWidth,img.naturalHeight));
      canvas.width = Math.max(1,Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1,Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(img,0,0,canvas.width,canvas.height);
      for (const quality of [.8,.65,.5]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= PHOTO_LIMIT) return data; }
    }
    throw new Error('No pudimos reducir la foto. Elige una imagen más pequeña.');
  } finally { URL.revokeObjectURL(url); }
}
async function requireVerifiedUser(expectedUid) {
  await accountReady();
  const {user} = getSession();
  if (!user || (expectedUid && user.uid !== expectedUid)) { showAccount(); throw new Error('Ingresa a tu cuenta para publicar una reseña.'); }
  if (!await refreshVerification()) { showAccount(); throw new Error('Verifica tu correo antes de publicar una reseña.'); }
  if (getSession().user?.uid !== user.uid) throw new Error('Tu sesión cambió. Abre la reseña de nuevo.');
  return user;
}
async function publishReview(event) {
  event.preventDefault();
  const form = $('#review-form');
  if (busy || processingPhoto || !form.reportValidity()) return;
  const values = {name:form.elements.name.value.trim(),text:form.elements.text.value.trim(),rating:Number(form.elements.rating.value),photo};
  if (values.name.length < 2 || values.text.length < 10) { feedback('Escribe un nombre de al menos 2 caracteres y un comentario de al menos 10.'); return; }
  const expectedUid = ownerUid; setBusy(true); feedback('Publicando tu reseña…');
  try {
    const user = await requireVerifiedUser(expectedUid);
    const {auth,db,dbSDK} = await getFirebase();
    if (auth.currentUser?.uid !== user.uid) throw new Error('Tu sesión cambió. Abre la reseña de nuevo.');
    const ref = dbSDK.doc(db,'reviews',user.uid);
    await dbSDK.runTransaction(db,async transaction => {
      const previous = await transaction.get(ref);
      transaction.set(ref,{...values,uid:user.uid,createdAt:previous.exists()?previous.data().createdAt:dbSDK.serverTimestamp(),updatedAt:dbSDK.serverTimestamp()});
    });
    feedback('Tu reseña está publicada. Puedes editarla o eliminarla aquí.');
    // Una falla al refrescar no convierte una publicación guardada en un error.
    await loadReviews(true); await syncSession();
  } catch (error) { feedback(error.code ? spanishError(error) : error.message); }
  finally { setBusy(false); }
}
async function deleteReview() {
  if (busy || !ownReview || !ownerUid) return;
  const uid = ownerUid; setBusy(true); feedback('Eliminando tu reseña…');
  try {
    await accountReady();
    const {auth,db,dbSDK} = await getFirebase();
    if (auth.currentUser?.uid !== uid || getSession().user?.uid !== uid) throw new Error('Tu sesión cambió. Abre la reseña de nuevo.');
    await dbSDK.deleteDoc(dbSDK.doc(db,'reviews',uid)); resetDraft(); ownReview = null;
    await loadReviews(true); await syncSession(); feedback('Tu reseña fue eliminada.');
  } catch (error) { feedback(error.code ? spanishError(error) : error.message); }
  finally { setBusy(false); }
}
export function initializeReviews({openDialog, testimonials = []}) {
  modal = $('#review-dialog'); openModal = openDialog; fallbackReviews = testimonials;
  renderReviews();
  document.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click',async () => {
    feedback(''); $('#review-delete-confirm').hidden = true; openModal(modal); setBusy(true);
    try { await accountReady(); await syncSession(); if (!loaded) await loadReviews(true); }
    catch (error) { feedback(spanishError(error)); }
    finally { setBusy(false); }
  }));
  document.addEventListener('pacos:session-changed',() => { syncSession().catch(() => {}); });
  $('#review-form').addEventListener('submit',publishReview);
  $('#review-form').elements.rating.forEach(radio => radio.addEventListener('change',paintRating));
  $('#review-account-button').addEventListener('click',showAccount);
  $('#review-photo').addEventListener('change',async event => {
    const generation = ++photoGeneration, file = event.target.files[0];
    if (!file) return;
    processingPhoto = true; updateButtons(); feedback('Preparando la foto…');
    try { const next = await compressPhoto(file); if (generation !== photoGeneration) return; photo = next; previewPhoto(); feedback('Foto lista. Se publicará al guardar la reseña.'); }
    catch (error) { if (generation === photoGeneration) feedback(error.message); }
    finally { if (generation === photoGeneration) { processingPhoto = false; updateButtons(); event.target.value = ''; } }
  });
  $('#review-remove-photo').addEventListener('click',() => { photoGeneration++; photo = ''; processingPhoto = false; previewPhoto(); updateButtons(); feedback('La foto se quitará al guardar los cambios.'); });
  $('#review-delete').addEventListener('click',() => { $('#review-delete-confirm').hidden = false; $('#review-cancel-delete').focus(); });
  $('#review-cancel-delete').addEventListener('click',() => { $('#review-delete-confirm').hidden = true; $('#review-delete').focus(); });
  $('#review-confirm-delete').addEventListener('click',deleteReview);
  $('#reviews-more').addEventListener('click',() => loadReviews(false));
  // Carga pública al acercarse a Nosotros; no añade trabajo al hero.
  if ('IntersectionObserver' in window) { const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadReviews(true); } },{rootMargin:'400px'}); observer.observe($('#nosotros')); }
  else loadReviews(true);
}
