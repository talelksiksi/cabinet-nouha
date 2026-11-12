'use strict';
/* Coordonnées du cabinet : à compléter (laisser vide = message « bientôt disponible ») */
const CABINET = { telephone: '', whatsapp: '' };

const CAS = [
  { f: 'cas-01-rehabilitation-complete', titre: 'Réhabilitation complète', desc: 'Remplacement des dents manquantes et abîmées par une prothèse fixe : sourire et mastication retrouvés.' },
  { f: 'cas-02-rehabilitation-prothese', titre: 'Réhabilitation prothétique', desc: 'Dents usées, décalées et colorées remplacées par une prothèse harmonieuse et stable.' },
  { f: 'cas-03-facettes-couronnes', titre: 'Esthétique du sourire', desc: 'Couronnes céramiques sur le sourire : teinte, forme et alignement retrouvés.' },
  { f: 'cas-04-bridge-anterieur', titre: 'Bridge antérieur', desc: 'Les dents de devant manquantes remplacées par un bridge fixe au rendu naturel.' },
  { f: 'cas-05-fermeture-diasteme', titre: 'Fermeture d\'espace', desc: 'Un espace entre les incisives refermé avec un résultat naturel et discret.' },
];

const $ = s => document.querySelector(s);
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };

/* En-tête qui se compacte au défilement */
const header = $('#header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* Menu mobile */
$('#burger').addEventListener('click', () => $('#menu').classList.toggle('open'));
document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('open')));
document.querySelector('.menu .lang').addEventListener('click', e => { e.preventDefault(); toast('La version arabe arrive bientôt — النسخة العربية قريبًا'); });

/* Apparition au défilement */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* Avant / après */
const range = $('#ba-range'), wrap = $('#ba-before-wrap'), handle = $('#ba-handle');
const setPos = v => { wrap.style.clipPath = `inset(0 ${100 - v}% 0 0)`; handle.style.left = v + '%'; };
range.addEventListener('input', () => setPos(range.value));
function showCase(i) {
  const c = CAS[i];
  $('#ba-before').src = `img/cas/${c.f}-avant.jpg`;
  $('#ba-after').src = `img/cas/${c.f}-apres.jpg`;
  $('#ba-title').textContent = c.titre;
  $('#ba-desc').textContent = c.desc;
  document.querySelectorAll('#ba-thumbs button').forEach((b, j) => b.classList.toggle('on', i === j));
  range.value = 50; setPos(50);
}
$('#ba-thumbs').innerHTML = CAS.map((c, i) => `<button type="button" aria-label="${c.titre}"><img src="img/cas/${c.f}-apres.jpg" alt="" loading="lazy"/></button>`).join('');
document.querySelectorAll('#ba-thumbs button').forEach((b, i) => b.addEventListener('click', () => showCase(i)));
showCase(0);
// Petite démonstration du curseur quand la galerie apparaît
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return; o.disconnect();
  let t = 0; const id = setInterval(() => { t += 1; const v = 50 + Math.sin(t / 10) * 22; setPos(v); range.value = v; if (t > 62) { clearInterval(id); setPos(50); range.value = 50; } }, 16);
}), { threshold: .5 }).observe($('#ba'));

/* WhatsApp / téléphone */
document.querySelectorAll('[data-wa]').forEach(a => a.addEventListener('click', e => {
  if (CABINET.whatsapp) { a.href = `https://wa.me/${CABINET.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour Docteur, je souhaite prendre rendez-vous.')}`; a.target = '_blank'; return; }
  e.preventDefault(); toast('Le numéro WhatsApp du cabinet sera ajouté très bientôt.');
}));
document.querySelectorAll('[data-tel]').forEach(a => a.addEventListener('click', e => {
  if (CABINET.telephone) { a.href = 'tel:' + CABINET.telephone.replace(/\s/g, ''); return; }
  e.preventDefault(); toast('Le numéro du cabinet sera ajouté très bientôt.');
}));
if (CABINET.telephone) $('#tel-label').textContent = CABINET.telephone;

/* Formulaire de rendez-vous (aperçu : rien n'est envoyé pour l'instant) */
const form = $('#rdv-form'), msg = $('#form-msg');
form.jour.min = new Date().toISOString().slice(0, 10);
form.addEventListener('submit', e => {
  e.preventDefault();
  let ok = true;
  ['nom', 'tel', 'motif'].forEach(n => { const f = form[n]; const bad = !f.value.trim() || (n === 'tel' && f.value.replace(/\D/g, '').length < 8); f.classList.toggle('invalid', bad); if (bad) ok = false; });
  if (!ok) { msg.className = 'form-msg err'; msg.textContent = 'Merci d\'indiquer votre nom, un numéro de téléphone valide et le motif.'; return; }
  msg.className = 'form-msg ok';
  msg.textContent = `Merci ${form.nom.value.trim().split(' ')[0]} ! Aperçu du site : l'envoi réel sera branché à l'espace cabinet.`;
  form.reset();
});

$('#year').textContent = new Date().getFullYear();
