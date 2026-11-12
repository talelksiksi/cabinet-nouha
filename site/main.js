'use strict';
/* Coordonnées du cabinet : à compléter (laisser vide = message « bientôt disponible ») */
const CABINET = { telephone: '+216 23 232 407', whatsapp: '+216 98 192 130' };

/* Langue de la page : <html lang="fr"> (racine) ou <html lang="ar" dir="rtl"> (dossier ar/) */
const AR = document.documentElement.lang === 'ar';
const BASE = AR ? '../' : '';

const CAS = [
  { f: 'cas-01-rehabilitation-complete',
    fr: ['Réhabilitation complète', 'Remplacement des dents manquantes et abîmées par une prothèse fixe : sourire et mastication retrouvés.'],
    ar: ['إعادة تأهيل كاملة', 'تعويض الأسنان المفقودة والمتضررة بتركيبة ثابتة: عودة الابتسامة والقدرة على المضغ.'] },
  { f: 'cas-02-rehabilitation-prothese',
    fr: ['Réhabilitation prothétique', 'Dents usées, décalées et colorées remplacées par une prothèse harmonieuse et stable.'],
    ar: ['إعادة تأهيل بالتركيبات', 'أسنان متآكلة وغير منتظمة ومتغيّرة اللون عُوِّضت بتركيبة متناسقة وثابتة.'] },
  { f: 'cas-03-facettes-couronnes',
    fr: ['Esthétique du sourire', 'Couronnes céramiques sur le sourire : teinte, forme et alignement retrouvés.'],
    ar: ['تجميل الابتسامة', 'تيجان خزفية للأسنان الأمامية: لون وشكل وانتظام طبيعي.'] },
  { f: 'cas-04-bridge-anterieur',
    fr: ['Bridge antérieur', 'Les dents de devant manquantes remplacées par un bridge fixe au rendu naturel.'],
    ar: ['جسر أمامي', 'تعويض الأسنان الأمامية المفقودة بجسر ثابت بمظهر طبيعي.'] },
  { f: 'cas-05-fermeture-diasteme',
    fr: ['Fermeture d\'espace', 'Un espace entre les incisives refermé avec un résultat naturel et discret.'],
    ar: ['غلق الفراغ بين الأسنان', 'غلق الفراغ بين القواطع الأمامية بنتيجة طبيعية وغير ظاهرة.'] },
];

const T = AR ? {
  waText: 'السلام عليكم دكتورة، أريد حجز موعد.',
  waSoon: 'سيُضاف رقم الواتساب الخاص بالعيادة قريبًا.',
  telSoon: 'سيُضاف رقم هاتف العيادة قريبًا.',
  formErr: 'الرجاء كتابة الاسم ورقم هاتف صحيح وسبب الزيارة.',
  formOk: p => `شكرًا ${p}! هذه نسخة تجريبية من الموقع: سيتم ربط الإرسال بفضاء العيادة لاحقًا.`,
} : {
  waText: 'Bonjour Docteur, je souhaite prendre rendez-vous.',
  waSoon: 'Le numéro WhatsApp du cabinet sera ajouté très bientôt.',
  telSoon: 'Le numéro du cabinet sera ajouté très bientôt.',
  formErr: 'Merci d\'indiquer votre nom, un numéro de téléphone valide et le motif.',
  formOk: p => `Merci ${p} ! Aperçu du site : l'envoi réel sera branché à l'espace cabinet.`,
};

const $ = s => document.querySelector(s);
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };

/* En-tête qui se compacte au défilement */
const header = $('#header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* Menu mobile */
$('#burger').addEventListener('click', () => $('#menu').classList.toggle('open'));
document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('open')));

/* Apparition au défilement */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* Avant / après */
const range = $('#ba-range'), wrap = $('#ba-before-wrap'), handle = $('#ba-handle');
// En arabe, « avant » est à droite : on lit de droite à gauche
const setPos = v => {
  wrap.style.clipPath = AR ? `inset(0 0 0 ${100 - v}%)` : `inset(0 ${100 - v}% 0 0)`;
  handle.style.left = (AR ? 100 - v : v) + '%';
};
range.addEventListener('input', () => setPos(range.value));
function showCase(i) {
  const c = CAS[i], [titre, desc] = AR ? c.ar : c.fr;
  $('#ba-before').src = `${BASE}img/cas/${c.f}-avant.jpg`;
  $('#ba-after').src = `${BASE}img/cas/${c.f}-apres.jpg`;
  $('#ba-title').textContent = titre;
  $('#ba-desc').textContent = desc;
  document.querySelectorAll('#ba-thumbs button').forEach((b, j) => b.classList.toggle('on', i === j));
  range.value = 50; setPos(50);
}
$('#ba-thumbs').innerHTML = CAS.map(c => `<button type="button" aria-label="${(AR ? c.ar : c.fr)[0]}"><img src="${BASE}img/cas/${c.f}-apres.jpg" alt="" loading="lazy"/></button>`).join('');
document.querySelectorAll('#ba-thumbs button').forEach((b, i) => b.addEventListener('click', () => showCase(i)));
showCase(0);
// Petite démonstration du curseur quand la galerie apparaît
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return; o.disconnect();
  let t = 0; const id = setInterval(() => { t += 1; const v = 50 + Math.sin(t / 10) * 22; setPos(v); range.value = v; if (t > 62) { clearInterval(id); setPos(50); range.value = 50; } }, 16);
}), { threshold: .5 }).observe($('#ba'));

/* WhatsApp / téléphone */
document.querySelectorAll('[data-wa]').forEach(a => a.addEventListener('click', e => {
  if (CABINET.whatsapp) { a.href = `https://wa.me/${CABINET.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(T.waText)}`; a.target = '_blank'; return; }
  e.preventDefault(); toast(T.waSoon);
}));
document.querySelectorAll('[data-tel]').forEach(a => a.addEventListener('click', e => {
  if (CABINET.telephone) { a.href = 'tel:' + CABINET.telephone.replace(/\s/g, ''); return; }
  e.preventDefault(); toast(T.telSoon);
}));

/* Formulaire de rendez-vous (aperçu : rien n'est envoyé pour l'instant) */
const form = $('#rdv-form'), msg = $('#form-msg');
form.jour.min = new Date().toISOString().slice(0, 10);
form.addEventListener('submit', e => {
  e.preventDefault();
  let ok = true;
  ['nom', 'tel', 'motif'].forEach(n => { const f = form[n]; const bad = !f.value.trim() || (n === 'tel' && f.value.replace(/\D/g, '').length < 8); f.classList.toggle('invalid', bad); if (bad) ok = false; });
  if (!ok) { msg.className = 'form-msg err'; msg.textContent = T.formErr; return; }
  msg.className = 'form-msg ok';
  msg.textContent = T.formOk(form.nom.value.trim().split(' ')[0]);
  form.reset();
});

$('#year').textContent = new Date().getFullYear();
