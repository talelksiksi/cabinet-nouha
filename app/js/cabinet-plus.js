/* ═══════════════════════════════════════════
   Espace cabinet Dr Nouha Ksiksi — modules complémentaires
   Salle d'attente · Agenda semaine · Demandes en ligne · Prothèses & labo
   Tâches · Caisse & dépenses · Ordonnances / certificats / devis · Avant-après
   ═══════════════════════════════════════════ */
'use strict';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayISO = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
const minsBetween = (a, b) => Math.max(0, Math.round((new Date(b || Date.now()) - new Date(a)) / 60000));
const fmtMins = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
const hhmm = iso => iso ? new Date(iso).toTimeString().slice(0, 5) : '—';
const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/* ══════════════════════════════════════════
   DONNÉES D'EXEMPLE (appelé par seedData)
══════════════════════════════════════════ */
function seedPlus() {
  const ago = m => new Date(Date.now() - m * 60000).toISOString();
  const nowTime = () => { const d = new Date(Date.now() - 15 * 60000); return d.toTimeString().slice(0, 5); };

  // Salle d'attente : une patiente terminée, un patient au fauteuil, une patiente qui attend
  const appts = DB.appointments();
  const a1 = appts.find(a => a.id === 1); if (a1) Object.assign(a1, { status: 'Terminé', arrivedAt: ago(190), startedAt: ago(178), endedAt: ago(150) });
  const a2 = appts.find(a => a.id === 2); if (a2) Object.assign(a2, { arrivedAt: ago(48), startedAt: ago(26) });
  appts.push({ id: 9, patientId: 5, dentistId: 1, date: dayISO(), time: nowTime(), duration: 30, service: 'Consultation / Bilan', status: 'En salle', notes: 'Sensibilité au froid', reminder: 'none', arrivedAt: ago(12), createdAt: ago(60 * 24) });
  DB.saveAppointments(appts);
  localStorage.setItem('cn_id_appointments', '9');
  const pats = DB.patients(); const p2 = pats.find(x => x.id === 2);
  if (p2) p2.cnam = { id: '07841236/00', regime: 'CNSS', first: 'Sofiene', last: 'Hammami', address: '12 Avenue Hédi Chaker, Sfax', cp: '3000', relation: 'Assuré social' };
  DB.savePatients(pats);
  // Encaissements du jour pour le rapport de caisse
  const pays = DB.payments();
  pays.push(
    { id: 6, patientId: 1, date: dayISO(), dueDate: '', method: 'Espèces', status: 'Payé', paidAmount: 70, discount: 0, notes: '', invoiceNumber: 'FAC-006', items: [{ description: 'Bilan & détartrage', amount: 70 }], createdAt: ago(150) },
    { id: 7, patientId: 2, date: dayISO(), dueDate: '', method: 'CNAM / Assurance', status: 'Partiel', paidAmount: 60, discount: 0, notes: 'Bulletin CNAM remis', invoiceNumber: 'FAC-007', items: [{ description: 'Traitement canalaire 36 — séance 2', amount: 120 }], createdAt: ago(20) });
  DB.savePayments(pays);
  localStorage.setItem('cn_id_payments', '7'); localStorage.setItem('cn_id_invoices', '7');

  DB.set('requests', [
    { id: 1, name: 'Salwa Gharsalli', phone: '+216 97 220 118', motif: 'Douleur ou urgence', day: dayISO(), moment: 'Après-midi', message: 'Douleur forte en bas à gauche depuis hier soir.', status: 'Nouvelle', createdAt: ago(35) },
    { id: 2, name: 'Mohamed Ali Ben Youssef', phone: '+216 22 410 552', motif: 'Implant', day: dayISO(2), moment: 'Matin', message: 'Il me manque une molaire en bas à droite, je voudrais savoir si un implant est possible.', status: 'Nouvelle', createdAt: ago(130) },
    { id: 3, name: 'Hela Ferchichi', phone: '+216 54 118 902', motif: 'Esthétique du sourire', day: dayISO(5), moment: 'Peu importe', message: '', status: 'Nouvelle', createdAt: ago(60 * 20) },
  ]);
  localStorage.setItem('cn_id_requests', '3');

  DB.set('labs', [
    { id: 1, name: 'Laboratoire Errahma', contact: 'Hatem', phone: '+216 75 640 210', city: 'Médenine' },
    { id: 2, name: 'Sud Céramique', contact: 'Mourad', phone: '+216 75 650 330', city: 'Djerba' },
  ]);
  localStorage.setItem('cn_id_labs', '2');
  DB.set('labworks', [
    { id: 1, patientId: 6, labId: 1, type: 'Couronne céramo-métallique', teeth: '46', shade: 'A2', sentDate: dayISO(-16), dueDate: dayISO(-6), deliveredDate: dayISO(-7), price: 120, status: 'Livré', notes: '' },
    { id: 2, patientId: 4, labId: 1, type: 'Prothèse partielle amovible', teeth: '24, 25', shade: 'A3', sentDate: dayISO(-9), dueDate: dayISO(3), deliveredDate: '', price: 260, status: 'Essayage', notes: 'Essayage des dents le prochain RDV' },
    { id: 3, patientId: 2, labId: 2, type: 'Couronne zircone', teeth: '36', shade: 'A2', sentDate: dayISO(-4), dueDate: dayISO(4), deliveredDate: '', price: 180, status: 'Envoyé', notes: '' },
    { id: 4, patientId: 3, labId: 2, type: 'Bridge 3 éléments', teeth: '11-21-22', shade: 'B1', sentDate: dayISO(-12), dueDate: dayISO(-1), deliveredDate: '', price: 390, status: 'Envoyé', notes: 'Patiente pressée (mariage)' },
  ]);
  localStorage.setItem('cn_id_labworks', '4');
  DB.set('labpayments', [{ id: 1, labId: 1, date: dayISO(-10), amount: 200, method: 'Espèces' }]);
  localStorage.setItem('cn_id_labpayments', '1');

  DB.set('tasks', [
    { id: 1, title: 'Relancer Sud Céramique pour le bridge de Yosra', due: dayISO(), priority: 'Urgente', assignee: 'Assistante', done: false },
    { id: 2, title: 'Commander gants, compresses et fil de suture', due: dayISO(), priority: 'Élevée', assignee: 'Assistante', done: false },
    { id: 3, title: 'Payer la facture STEG', due: dayISO(1), priority: 'Moyenne', assignee: 'Assistante', done: false },
    { id: 4, title: 'Test hebdomadaire de l\'autoclave (Bowie-Dick)', due: dayISO(2), priority: 'Moyenne', assignee: 'Assistante', done: false },
    { id: 5, title: 'Renouveler l\'assurance responsabilité civile', due: dayISO(12), priority: 'Faible', assignee: 'Dentiste', done: false },
    { id: 6, title: 'Préparer le plan de traitement de M. Ayari', due: dayISO(-1), priority: 'Élevée', assignee: 'Dentiste', done: true },
  ]);
  localStorage.setItem('cn_id_tasks', '6');

  const m1 = dayISO().slice(0, 8) + '01';
  DB.set('expenses', [
    { id: 1, date: m1, category: 'Loyer', label: 'Loyer du cabinet', amount: 900, method: 'Chèque', chequeNo: '4521087' },
    { id: 2, date: dayISO(-12), category: 'Salaires', label: 'Salaire assistante', amount: 1100, method: 'Virement', chequeNo: '' },
    { id: 3, date: dayISO(-10), category: 'Laboratoire', label: 'Règlement Laboratoire Errahma', amount: 200, method: 'Espèces', chequeNo: '', labPaymentId: 1 },
    { id: 4, date: dayISO(-3), category: 'Factures', label: 'STEG (électricité)', amount: 87.4, method: 'Espèces', chequeNo: '' },
    { id: 5, date: dayISO(-1), category: 'Fournitures', label: 'Composite, anesthésiques', amount: 320, method: 'Chèque', chequeNo: '4521088' },
    { id: 6, date: dayISO(), category: 'Fournitures', label: 'Gants et masques', amount: 45.5, method: 'Espèces', chequeNo: '' },
  ]);
  localStorage.setItem('cn_id_expenses', '6');

  DB.set('documents', [
    { id: 1, patientId: 4, type: 'ordonnance', date: dayISO(-30), lines: [
      { med: 'Amoxicilline 1 g', dose: '1 comprimé matin et soir', dur: '7 jours' },
      { med: 'Paracétamol 1 g', dose: '1 comprimé si douleur, max 3/jour', dur: '3 jours' },
      { med: 'Chlorhexidine 0,12 % bain de bouche', dose: '2 fois par jour après brossage', dur: '7 jours' }] },
  ]);
  localStorage.setItem('cn_id_documents', '1');

  DB.set('gallery', [
    { id: 1, patientId: 6, title: 'Couronne céramique sur 46', treatment: 'Prothèse fixe', date: dayISO(-7), before: Gallery.demoImage('avant', 1), after: Gallery.demoImage('apres', 1), consent: true, published: true },
    { id: 2, patientId: 3, title: 'Fermeture d\'un diastème', treatment: 'Esthétique', date: dayISO(-20), before: Gallery.demoImage('avant', 2), after: Gallery.demoImage('apres', 2), consent: false, published: false },
  ]);
  localStorage.setItem('cn_id_gallery', '2');
}

/* ══════════════════════════════════════════
   POINT D'ENTRÉE (navigation, badges, modales)
══════════════════════════════════════════ */
const Plus = {
  pages: {
    waiting: 'Salle d\'attente', lab: 'Prothèses & laboratoire', gallery: 'Avant / après',
    tasks: 'Tâches', cash: 'Caisse & dépenses', acts: 'Actes & tarifs',
  },
  onNavigate(page) {
    clearInterval(this._timer);
    if (page === 'waiting') { WaitingRoom.render(); this._timer = setInterval(() => App.currentPage === 'waiting' && WaitingRoom.render(), 30000); }
    if (page === 'appointments') { Agenda.render(); Requests.renderBanner(); }
    if (page === 'lab') Lab.render();
    if (page === 'gallery') Gallery.render();
    if (page === 'tasks') Tasks.render();
    if (page === 'cash') Cash.render();
    if (page === 'acts') Acts.render();
  },
  refresh(page) {
    if (page === 'waiting') WaitingRoom.render();
    if (page === 'appointments') { Agenda.render(); Requests.renderBanner(); }
    if (page === 'lab') Lab.render();
    if (page === 'gallery') Gallery.render();
    if (page === 'tasks') Tasks.render();
    if (page === 'cash') Cash.render();
  },
  updateBadges() {
    const set = (id, n) => { const el = document.getElementById(id); if (el) { el.textContent = n; el.classList.toggle('hidden', !n); } };
    set('nav-badge-waiting', DB.appointments().filter(a => a.date === Utils.today() && a.status === 'En salle').length);
    set('nav-badge-tasks', DB.get('tasks').filter(t => !t.done && t.due <= Utils.today()).length);
    set('nav-badge-lab', Lab.late().length);
    set('appt-requests-count', DB.get('requests').filter(r => r.status === 'Nouvelle').length);
  },
  // Modale générique construite à la volée
  modal(id, title, body, footer, size = 'modal-md') {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; el.style.display = 'none'; document.getElementById('modal-overlay').appendChild(el); }
    el.className = `modal ${size}`;
    el.innerHTML = `<div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="App.closeModal('${id}')"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body">${body}</div><div class="modal-footer">${footer}</div>`;
    App.openModal(id);
    return el;
  },
  val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; },
  patientOptions(sel) { return '<option value="">— Sélectionner un patient —</option>' + DB.patients().map(p => `<option value="${p.id}" ${p.id == sel ? 'selected' : ''}>${esc(p.firstName + ' ' + p.lastName)}</option>`).join(''); },
};

/* ══════════════════════════════════════════
   SALLE D'ATTENTE — suivi du jour en temps réel
══════════════════════════════════════════ */
const WaitingRoom = {
  _save(id, patch, log) {
    const appts = DB.appointments(); const a = appts.find(x => x.id == id); if (!a) return;
    Object.assign(a, patch); DB.saveAppointments(appts);
    if (log) DB.logActivity('appt', log.replace('{p}', Utils.patientName(a.patientId)));
    App.refreshCurrent();
  },
  arrive(id) { this._save(id, { status: 'En salle', arrivedAt: new Date().toISOString() }, '{p} est arrivé(e) en salle d\'attente'); App.toast('Patient en salle d\'attente'); },
  seat(id) {
    const a = DB.appointments().find(x => x.id == id);
    this._save(id, { status: 'En cours', arrivedAt: a?.arrivedAt || new Date().toISOString(), startedAt: new Date().toISOString() }, '{p} est au fauteuil');
    App.toast('Patient au fauteuil');
  },
  finish(id) {
    this._save(id, { status: 'Terminé', endedAt: new Date().toISOString() }, 'Consultation terminée : {p}');
    const a = DB.appointments().find(x => x.id == id);
    App.toast(`Consultation terminée. Pensez au soin et à la facture de ${Utils.patientName(a.patientId).split(' ')[0]}.`, 'info');
  },
  absent(id) { this._save(id, { status: 'Absent' }, '{p} marqué(e) absent(e)'); App.toast('Marqué absent', 'warning'); },
  undo(id) { this._save(id, { status: 'Confirmé', arrivedAt: null, startedAt: null, endedAt: null }); },

  // Statut changé ailleurs (liste, formulaire) : on horodate l'arrivée / le début du soin
  stamp() {
    const appts = DB.appointments(), now = new Date().toISOString(), today = Utils.today(); let changed = false;
    appts.filter(a => a.date === today).forEach(a => {
      if (['En salle', 'En cours', 'Terminé'].includes(a.status) && !a.arrivedAt && a.status !== 'Terminé') { a.arrivedAt = now; changed = true; }
      if (a.status === 'En cours' && !a.startedAt) { a.startedAt = now; changed = true; }
    });
    if (changed) DB.saveAppointments(appts);
  },
  render() {
    this.stamp();
    const today = Utils.today();
    const list = DB.appointments().filter(a => a.date === today).sort((a, b) => a.time.localeCompare(b.time));
    const cols = {
      planned: list.filter(a => ['Planifié', 'Confirmé'].includes(a.status)),
      waiting: list.filter(a => a.status === 'En salle'),
      chair: list.filter(a => a.status === 'En cours'),
      done: list.filter(a => a.status === 'Terminé'),
      absent: list.filter(a => ['Absent', 'Annulé'].includes(a.status)),
    };
    const waits = list.filter(a => a.arrivedAt && a.startedAt).map(a => minsBetween(a.arrivedAt, a.startedAt));
    const cares = list.filter(a => a.startedAt && a.endedAt).map(a => minsBetween(a.startedAt, a.endedAt));
    const avg = arr => arr.length ? fmtMins(Math.round(arr.reduce((s, x) => s + x, 0) / arr.length)) : '—';
    document.getElementById('wr-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('wr-stats').innerHTML = `
      <div class="wr-stat"><span>Attente moyenne</span><b>${avg(waits)}</b></div>
      <div class="wr-stat"><span>Soin moyen</span><b>${avg(cares)}</b></div>
      <div class="wr-stat"><span>Patients vus</span><b>${cols.done.length} / ${list.length - cols.absent.length}</b></div>
      <div class="wr-stat"><span>Absents</span><b>${cols.absent.length}</b></div>`;

    const name = a => `<a class="wr-name" onclick="App.openPatient(${a.patientId})">${esc(Utils.patientName(a.patientId))}</a>`;
    const alert = a => { const p = DB.patients().find(x => x.id == a.patientId); const al = p && p.allergies && !/^aucun/i.test(p.allergies) ? p.allergies : ''; const med = p && /warfarine|sintrom|aspirine|clopidogrel|xarelto|eliquis/i.test(p.medications || '') ? 'Anticoagulant' : ''; return (al || med) ? `<div class="wr-alert"><i class="fa-solid fa-triangle-exclamation"></i> ${esc([al && 'Allergie : ' + al, med].filter(Boolean).join(' · '))}</div>` : ''; };
    const card = (a, body, actions) => `<div class="wr-card"><div class="wr-top">${name(a)}<span class="wr-time">${a.time}</span></div><div class="wr-svc">${esc(a.service)}</div>${alert(a)}${body}<div class="wr-actions">${actions}</div></div>`;
    const btn = (fn, id, icon, label, cls = '') => `<button class="wr-btn ${cls}" onclick="WaitingRoom.${fn}(${id})"><i class="fa-solid ${icon}"></i> ${label}</button>`;
    const empty = t => `<div class="wr-empty">${t}</div>`;

    const html = {
      planned: cols.planned.map(a => card(a, '', btn('arrive', a.id, 'fa-door-open', 'Arrivé', 'primary') + btn('absent', a.id, 'fa-user-xmark', 'Absent'))).join('') || empty('Aucun rendez-vous restant'),
      waiting: cols.waiting.map(a => { const m = minsBetween(a.arrivedAt); return card(a, `<div class="wr-timer ${m > 20 ? 'late' : ''}"><i class="fa-regular fa-clock"></i> attend depuis ${fmtMins(m)} <small>(arrivé à ${hhmm(a.arrivedAt)})</small></div>`, btn('seat', a.id, 'fa-chair', 'Au fauteuil', 'primary') + btn('undo', a.id, 'fa-rotate-left', '')); }).join('') || empty('Salle d\'attente vide'),
      chair: cols.chair.map(a => card(a, `<div class="wr-timer"><i class="fa-solid fa-stopwatch"></i> au fauteuil depuis ${fmtMins(minsBetween(a.startedAt || a.arrivedAt))}</div>`, btn('finish', a.id, 'fa-check', 'Terminer', 'primary'))).join('') || empty('Fauteuil libre'),
      done: cols.done.map(a => card(a, `<div class="wr-durations">${a.arrivedAt && a.startedAt ? `Attente : <b>${fmtMins(minsBetween(a.arrivedAt, a.startedAt))}</b>` : ''}${a.startedAt && a.endedAt ? ` · Soin : <b>${fmtMins(minsBetween(a.startedAt, a.endedAt))}</b>` : ''}</div>`,
        `<button class="wr-btn" onclick="Treatments.openNew({patientId:${a.patientId}})"><i class="fa-solid fa-syringe"></i> Soin</button><button class="wr-btn" onclick="Payments.openNew({patientId:${a.patientId}})"><i class="fa-solid fa-file-invoice-dollar"></i> Facture</button>`)).join('') || empty('Personne pour l\'instant'),
      absent: cols.absent.map(a => card(a, '', `<a class="wr-btn" target="_blank" rel="noopener" href="${waLink(DB.patients().find(p => p.id == a.patientId)?.phone, `Bonjour ${Utils.patientName(a.patientId).split(' ')[0]}, nous ne vous avons pas vu(e) à votre rendez-vous de ${a.time}. Souhaitez-vous en fixer un autre ?`)}"><i class="fa-brands fa-whatsapp"></i> Reprogrammer</a>` + btn('undo', a.id, 'fa-rotate-left', ''))).join('') || empty('Aucun absent'),
    };
    Object.entries(html).forEach(([k, v]) => { document.getElementById('wr-' + k).innerHTML = v; document.getElementById('wr-n-' + k).textContent = cols[k].length; });
  },
};

/* ══════════════════════════════════════════
   AGENDA — vue semaine (en plus de la liste)
══════════════════════════════════════════ */
const Agenda = {
  view: 'week',
  start: null,
  H0: 8, H1: 19, PX: 1.1, // px par minute
  setView(v) {
    this.view = v;
    document.querySelectorAll('.agenda-switch button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    document.getElementById('agenda-week').classList.toggle('hidden', v !== 'week');
    document.getElementById('appt-list-wrap').classList.toggle('hidden', v !== 'list');
    this.render();
  },
  monday(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; },
  shift(n) { this.start.setDate(this.start.getDate() + 7 * n); this.render(); },
  goToday() { this.start = this.monday(new Date()); this.render(); },
  render() {
    if (!this.start) this.start = this.monday(new Date());
    const wrap = document.getElementById('agenda-week'); if (!wrap) return;
    document.getElementById('appt-list-wrap').classList.toggle('hidden', this.view !== 'list');
    wrap.classList.toggle('hidden', this.view !== 'week');
    if (this.view !== 'week') return;
    const days = [...Array(6)].map((_, i) => { const d = new Date(this.start); d.setDate(d.getDate() + i); return d; });
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = days[5];
    // Plage horaire : 8 h – 19 h, élargie si un RDV de la semaine déborde
    const weekAppts = DB.appointments().filter(a => a.date >= iso(days[0]) && a.date <= iso(end) && a.status !== 'Annulé');
    this.H0 = Math.min(8, ...weekAppts.map(a => Math.floor(this.min(a.time) / 60)));
    this.H1 = Math.min(23, Math.max(19, ...weekAppts.map(a => Math.ceil((this.min(a.time) + (a.duration || 30)) / 60))));
    document.getElementById('agenda-range').textContent = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const H = (this.H1 - this.H0) * 60 * this.PX;
    const hours = [...Array(this.H1 - this.H0)].map((_, i) => `<div class="ag-hour" style="top:${i * 60 * this.PX}px">${String(this.H0 + i).padStart(2, '0')}:00</div>`).join('');
    const appts = DB.appointments();
    const today = Utils.today();
    const cols = days.map(d => {
      const di = iso(d);
      const list = appts.filter(a => a.date === di && a.status !== 'Annulé').sort((a, b) => a.time.localeCompare(b.time));
      // Répartition en colonnes quand deux RDV se chevauchent
      const lanes = []; list.forEach(a => { const s = this.min(a.time), e = s + (a.duration || 30); let l = lanes.findIndex(end => end <= s); if (l < 0) { l = lanes.length; lanes.push(e); } else lanes[l] = e; a._lane = l; });
      const n = Math.max(1, lanes.length);
      const blocks = list.map(a => {
        const top = (this.min(a.time) - this.H0 * 60) * this.PX, h = Math.max(22, (a.duration || 30) * this.PX - 2);
        const cls = { 'Terminé': 'done', 'En cours': 'chair', 'En salle': 'wait', 'Absent': 'absent', 'Confirmé': 'ok' }[a.status] || 'plan';
        return `<div class="ag-appt ${cls}" style="top:${top}px;height:${h}px;left:calc(${a._lane * 100 / n}% + 2px);width:calc(${100 / n}% - 4px)" onclick="event.stopPropagation();Appointments.edit(${a.id})" title="${esc(a.time + ' · ' + Utils.patientName(a.patientId) + ' · ' + a.service + ' · ' + a.status)}">
          <b>${a.time} ${esc(Utils.patientName(a.patientId))}</b><span>${esc(a.service)}</span></div>`;
      }).join('');
      return `<div class="ag-col ${di === today ? 'today' : ''}" style="height:${H}px" onclick="Agenda.newAt('${di}', event)">${blocks}</div>`;
    }).join('');
    const heads = days.map(d => `<div class="ag-head ${iso(d) === today ? 'today' : ''}">${d.toLocaleDateString('fr-FR', { weekday: 'short' })} <b>${d.getDate()}</b></div>`).join('');
    document.getElementById('agenda-grid').innerHTML = `<div class="ag-heads"><div></div>${heads}</div><div class="ag-body"><div class="ag-hours" style="height:${H}px">${hours}</div>${cols}</div>`;
  },
  min(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  newAt(date, e) {
    const y = e.offsetY; const m = Math.round((y / this.PX) / 15) * 15 + this.H0 * 60;
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    Appointments.openNew({ date, time: t });
  },
};

/* ══════════════════════════════════════════
   DEMANDES DE RENDEZ-VOUS EN LIGNE (site public)
══════════════════════════════════════════ */
const Requests = {
  renderBanner() {
    const n = DB.get('requests').filter(r => r.status === 'Nouvelle').length;
    const el = document.getElementById('appt-requests-banner'); if (!el) return;
    el.classList.toggle('hidden', !n);
    el.querySelector('b').textContent = `${n} demande${n > 1 ? 's' : ''} de rendez-vous en ligne`;
  },
  open() {
    const list = DB.get('requests').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rows = list.map(r => `
      <div class="req-card ${r.status !== 'Nouvelle' ? 'handled' : ''}">
        <div class="req-top"><b>${esc(r.name)}</b><span class="badge ${r.status === 'Nouvelle' ? 'badge-en-attente' : r.status === 'Acceptée' ? 'badge-confirme' : 'badge-absent'}">${r.status}</span></div>
        <div class="req-meta"><span><i class="fa-solid fa-tooth"></i> ${esc(r.motif)}</span><span><i class="fa-regular fa-calendar"></i> ${r.day ? Utils.formatDate(r.day) : 'Date libre'} · ${esc(r.moment)}</span><span><i class="fa-solid fa-phone"></i> ${esc(r.phone)}</span><span class="text-muted">reçue il y a ${Utils.timeAgo(r.createdAt)}</span></div>
        ${r.message ? `<p class="req-msg">« ${esc(r.message)} »</p>` : ''}
        ${r.status === 'Nouvelle' ? `<div class="req-actions">
          <button class="btn-sm-primary" onclick="Requests.accept(${r.id})"><i class="fa-solid fa-calendar-check"></i> Planifier</button>
          <a class="btn-secondary btn-xs" target="_blank" rel="noopener" href="${waLink(r.phone, `Bonjour ${r.name.split(' ')[0]}, le cabinet a bien reçu votre demande de rendez-vous (${r.motif}).`)}"><i class="fa-brands fa-whatsapp"></i> Répondre</a>
          <button class="btn-secondary btn-xs" onclick="Requests.decline(${r.id})">Refuser</button></div>` : ''}
      </div>`).join('') || '<div class="empty-state-sm"><i class="fa-solid fa-inbox"></i> Aucune demande</div>';
    Plus.modal('modal-requests', '<i class="fa-solid fa-inbox"></i> Demandes de rendez-vous en ligne',
      `<p class="text-muted" style="margin-bottom:1rem;font-size:.85rem"><i class="fa-solid fa-lock"></i> Envoyées depuis le formulaire du site, chiffrées dans le navigateur du patient. Planifiez-les puis confirmez par WhatsApp.</p>${rows}`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-requests')">Fermer</button>`, 'modal-lg');
  },
  _set(id, status) { const l = DB.get('requests'); const r = l.find(x => x.id == id); if (r) r.status = status; DB.set('requests', l); return r; },
  decline(id) { const r = this._set(id, 'Refusée'); DB.logActivity('appt', `Demande en ligne de ${r.name} refusée`); this.open(); App.refreshCurrent(); },
  accept(id) {
    const r = DB.get('requests').find(x => x.id == id); if (!r) return;
    const digits = s => String(s || '').replace(/\D/g, '').slice(-8);
    let p = DB.patients().find(x => digits(x.phone) === digits(r.phone));
    if (!p) {
      const [first, ...rest] = r.name.trim().split(/\s+/);
      const pats = DB.patients(); const nid = DB.nextId('patients');
      p = { id: nid, firstName: first, lastName: rest.join(' ') || '—', phone: r.phone, dob: '', gender: '', email: '', address: '', allergies: '', medications: '', conditions: '', dentalHistory: '', notes: 'Créé depuis une demande en ligne.', patientSince: Utils.today(), createdAt: new Date().toISOString() };
      pats.push(p); DB.savePatients(pats);
      DB.logActivity('patient', `Nouveau patient depuis le site : ${r.name}`);
    }
    this._set(id, 'Acceptée');
    App.closeModal('modal-requests');
    const svc = { 'Implant': 'Pose d\'implant', 'Douleur ou urgence': 'Urgence dentaire', 'Esthétique du sourire': 'Consultation esthétique' }[r.motif] || '';
    Appointments.openNew({ patientId: p.id, date: r.day || Utils.today(), time: r.moment === 'Après-midi' ? '15:00' : '09:00', notes: `Demande en ligne — ${r.motif}${r.message ? ' : ' + r.message : ''}`, service: svc });
    App.toast(`Fiche de ${p.firstName} prête : choisissez l'heure puis confirmez-lui par WhatsApp.`, 'info');
    App.updateBadges();
  },
};

/* ══════════════════════════════════════════
   PROTHÈSES & LABORATOIRE
══════════════════════════════════════════ */
const Lab = {
  STATUS: ['Envoyé', 'Essayage', 'Livré', 'Posé'],
  TYPES: ['Couronne céramo-métallique', 'Couronne zircone', 'Couronne céramique', 'Bridge 3 éléments', 'Facette céramique', 'Inlay / onlay', 'Prothèse complète', 'Prothèse partielle amovible', 'Prothèse sur 2 implants', 'Couronne sur implant', 'Gouttière'],
  late() { return DB.get('labworks').filter(w => ['Envoyé', 'Essayage'].includes(w.status) && w.dueDate && w.dueDate < Utils.today()); },
  balance(labId) {
    const due = DB.get('labworks').filter(w => w.labId == labId).reduce((s, w) => s + parseFloat(w.price || 0), 0);
    const paid = DB.get('labpayments').filter(p => p.labId == labId).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    return { due, paid, rest: due - paid };
  },
  render() {
    const labs = DB.get('labs');
    document.getElementById('lab-cards').innerHTML = labs.map(l => {
      const b = this.balance(l.id); const n = DB.get('labworks').filter(w => w.labId == l.id && !['Livré', 'Posé'].includes(w.status)).length;
      return `<div class="lab-card"><div class="lab-head"><div><b>${esc(l.name)}</b><small>${esc(l.city)} · ${esc(l.contact)} · ${esc(l.phone)}</small></div><button class="icon-btn edit" onclick="Lab.editLab(${l.id})" title="Modifier"><i class="fa-solid fa-pen"></i></button></div>
        <div class="lab-nums"><div><span>Travaux</span><b>${Utils.currencyShort(b.due)}</b></div><div><span>Réglé</span><b>${Utils.currencyShort(b.paid)}</b></div><div class="${b.rest > 0 ? 'due' : ''}"><span>Reste dû</span><b>${Utils.currency(b.rest)}</b></div></div>
        <div class="lab-foot"><span class="text-muted">${n} travail${n > 1 ? 'x' : ''} en cours</span><button class="btn-sm-primary" onclick="Lab.pay(${l.id})"><i class="fa-solid fa-money-bill-wave"></i> Régler</button></div></div>`;
    }).join('') + `<button class="lab-card add" onclick="Lab.editLab()"><i class="fa-solid fa-plus"></i> Ajouter un laboratoire</button>`;
    this.filter();
  },
  filter() {
    const st = Plus.val('lab-filter-status'), lab = Plus.val('lab-filter-lab'), q = Plus.val('lab-search').toLowerCase();
    const sel = document.getElementById('lab-filter-lab');
    if (sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Tous les laboratoires</option>' + DB.get('labs').map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    const today = Utils.today();
    const list = DB.get('labworks').filter(w => (!st || (st === 'cours' ? !['Livré', 'Posé'].includes(w.status) : st === 'retard' ? this.late().some(x => x.id === w.id) : w.status === st)) && (!lab || w.labId == lab) && (!q || (Utils.patientName(w.patientId) + ' ' + w.type).toLowerCase().includes(q)))
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const labName = id => DB.get('labs').find(l => l.id == id)?.name || '—';
    document.getElementById('lab-empty').classList.toggle('hidden', list.length > 0);
    document.getElementById('lab-table-body').innerHTML = list.map(w => {
      const late = ['Envoyé', 'Essayage'].includes(w.status) && w.dueDate && w.dueDate < today;
      const next = { 'Envoyé': 'Essayage', 'Essayage': 'Livré', 'Livré': 'Posé' }[w.status];
      return `<tr class="${late ? 'row-late' : ''}">
        <td><a class="link" onclick="App.openPatient(${w.patientId})">${esc(Utils.patientName(w.patientId))}</a></td>
        <td>${esc(w.type)}<br><small class="text-muted">Dents ${esc(w.teeth || '—')} · Teinte ${esc(w.shade || '—')}</small></td>
        <td>${esc(labName(w.labId))}</td>
        <td>${Utils.formatDate(w.sentDate)}</td>
        <td>${Utils.formatDate(w.dueDate)}${late ? `<br><small class="late-tag"><i class="fa-solid fa-triangle-exclamation"></i> en retard de ${minsBetween(w.dueDate + 'T00:00', today + 'T00:00') / 1440 | 0} j</small>` : ''}</td>
        <td>${Utils.currency(w.price)}</td>
        <td><span class="lab-status s-${w.status.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}">${w.status}</span></td>
        <td><div class="table-actions">${next ? `<button class="btn-xs btn-secondary" onclick="Lab.advance(${w.id})" title="Passer à « ${next} »"><i class="fa-solid fa-forward"></i> ${next}</button>` : ''}
          <button class="icon-btn edit" onclick="Lab.edit(${w.id})" title="Modifier"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn del" onclick="Lab.remove(${w.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;
    }).join('');
  },
  advance(id) {
    const l = DB.get('labworks'); const w = l.find(x => x.id == id); if (!w) return;
    w.status = { 'Envoyé': 'Essayage', 'Essayage': 'Livré', 'Livré': 'Posé' }[w.status] || w.status;
    if (w.status === 'Livré' && !w.deliveredDate) w.deliveredDate = Utils.today();
    DB.set('labworks', l); DB.logActivity('treatment', `${w.type} de ${Utils.patientName(w.patientId)} : ${w.status}`);
    App.toast(`${w.type} : ${w.status}`); App.refreshCurrent();
  },
  edit(id) {
    const w = DB.get('labworks').find(x => x.id == id) || { patientId: '', labId: DB.get('labs')[0]?.id, type: '', teeth: '', shade: 'A2', sentDate: Utils.today(), dueDate: dayISO(7), price: '', status: 'Envoyé', notes: '' };
    Plus.modal('modal-labwork', `<i class="fa-solid fa-teeth"></i> ${id ? 'Modifier le travail' : 'Nouveau travail de prothèse'}`, `
      <input type="hidden" id="lw-id" value="${id || ''}"/>
      <div class="form-grid">
        <div class="form-group form-full"><label>Patient *</label><select id="lw-patient">${Plus.patientOptions(w.patientId)}</select></div>
        <div class="form-group"><label>Type de prothèse *</label><input id="lw-type" list="lw-types" value="${esc(w.type)}" placeholder="Couronne zircone…"/><datalist id="lw-types">${this.TYPES.map(t => `<option>${t}</option>`).join('')}</datalist></div>
        <div class="form-group"><label>Laboratoire *</label><select id="lw-lab">${DB.get('labs').map(l => `<option value="${l.id}" ${l.id == w.labId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Dents</label><input id="lw-teeth" value="${esc(w.teeth)}" placeholder="Ex : 46 ou 11-21-22"/></div>
        <div class="form-group"><label>Teinte</label><input id="lw-shade" value="${esc(w.shade)}" placeholder="A2"/></div>
        <div class="form-group"><label>Envoyé le</label><input type="date" id="lw-sent" value="${w.sentDate || ''}"/></div>
        <div class="form-group"><label>Retour prévu le</label><input type="date" id="lw-due" value="${w.dueDate || ''}"/></div>
        <div class="form-group"><label>Prix labo (DT)</label><input type="number" step="0.001" id="lw-price" value="${w.price}"/></div>
        <div class="form-group"><label>Statut</label><select id="lw-status">${this.STATUS.map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group form-full"><label>Remarques</label><textarea id="lw-notes">${esc(w.notes)}</textarea></div>
      </div>`, `<button class="btn-secondary" onclick="App.closeModal('modal-labwork')">Annuler</button><button class="btn-primary" onclick="Lab.save()"><i class="fa-solid fa-save"></i> Enregistrer</button>`);
  },
  save() {
    const id = Plus.val('lw-id'), pid = parseInt(Plus.val('lw-patient')), type = Plus.val('lw-type');
    if (!pid || !type) { App.toast('Patient et type de prothèse obligatoires', 'error'); return; }
    const data = { patientId: pid, labId: parseInt(Plus.val('lw-lab')), type, teeth: Plus.val('lw-teeth'), shade: Plus.val('lw-shade'), sentDate: Plus.val('lw-sent'), dueDate: Plus.val('lw-due'), price: parseFloat(Plus.val('lw-price')) || 0, status: Plus.val('lw-status'), notes: Plus.val('lw-notes') };
    const l = DB.get('labworks');
    if (id) Object.assign(l.find(x => x.id == id), data); else l.push({ id: DB.nextId('labworks'), deliveredDate: '', ...data });
    DB.set('labworks', l); DB.logActivity('treatment', `${type} pour ${Utils.patientName(pid)} envoyé(e) au laboratoire`);
    App.closeModal('modal-labwork'); App.toast('Travail enregistré'); App.refreshCurrent();
  },
  remove(id) {
    const w = DB.get('labworks').find(x => x.id == id);
    App.confirmDelete(`Supprimer « ${w.type} » de ${Utils.patientName(w.patientId)} ?`, () => { DB.set('labworks', DB.get('labworks').filter(x => x.id != id)); App.toast('Supprimé', 'warning'); App.refreshCurrent(); });
  },
  editLab(id) {
    const l = DB.get('labs').find(x => x.id == id) || { name: '', contact: '', phone: '', city: '' };
    Plus.modal('modal-lab', `<i class="fa-solid fa-flask"></i> ${id ? 'Modifier' : 'Nouveau'} laboratoire`, `<input type="hidden" id="lb-id" value="${id || ''}"/>
      <div class="form-grid"><div class="form-group form-full"><label>Nom *</label><input id="lb-name" value="${esc(l.name)}"/></div>
      <div class="form-group"><label>Prothésiste</label><input id="lb-contact" value="${esc(l.contact)}"/></div><div class="form-group"><label>Téléphone</label><input id="lb-phone" value="${esc(l.phone)}"/></div>
      <div class="form-group"><label>Ville</label><input id="lb-city" value="${esc(l.city)}"/></div></div>`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-lab')">Annuler</button><button class="btn-primary" onclick="Lab.saveLab()"><i class="fa-solid fa-save"></i> Enregistrer</button>`, 'modal-sm');
  },
  saveLab() {
    const id = Plus.val('lb-id'), name = Plus.val('lb-name'); if (!name) { App.toast('Nom obligatoire', 'error'); return; }
    const data = { name, contact: Plus.val('lb-contact'), phone: Plus.val('lb-phone'), city: Plus.val('lb-city') };
    const l = DB.get('labs'); if (id) Object.assign(l.find(x => x.id == id), data); else l.push({ id: DB.nextId('labs'), ...data });
    DB.set('labs', l); document.getElementById('lab-filter-lab').innerHTML = '<option value="">Tous les laboratoires</option>';
    App.closeModal('modal-lab'); App.toast('Laboratoire enregistré'); App.refreshCurrent();
  },
  pay(labId) {
    const lab = DB.get('labs').find(l => l.id == labId); const b = this.balance(labId);
    Plus.modal('modal-labpay', `<i class="fa-solid fa-money-bill-wave"></i> Régler ${esc(lab.name)}`, `<p style="margin-bottom:1rem">Reste dû : <b>${Utils.currency(b.rest)}</b></p>
      <div class="form-grid"><div class="form-group"><label>Montant (DT)</label><input type="number" step="0.001" id="lp-amount" value="${b.rest > 0 ? b.rest.toFixed(3) : ''}"/></div>
      <div class="form-group"><label>Date</label><input type="date" id="lp-date" value="${Utils.today()}"/></div>
      <div class="form-group"><label>Mode</label><select id="lp-method"><option>Espèces</option><option>Chèque</option><option>Virement</option></select></div>
      <div class="form-group"><label>N° de chèque</label><input id="lp-cheque" placeholder="si chèque"/></div></div>
      <p class="text-muted" style="font-size:.8rem;margin-top:.75rem">Le règlement est aussi enregistré dans les dépenses (catégorie Laboratoire).</p>`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-labpay')">Annuler</button><button class="btn-primary" onclick="Lab.savePay(${labId})"><i class="fa-solid fa-check"></i> Enregistrer</button>`, 'modal-sm');
  },
  savePay(labId) {
    const amount = parseFloat(Plus.val('lp-amount')); if (!(amount > 0)) { App.toast('Montant invalide', 'error'); return; }
    const lab = DB.get('labs').find(l => l.id == labId);
    const pays = DB.get('labpayments'); const pid = DB.nextId('labpayments');
    pays.push({ id: pid, labId, date: Plus.val('lp-date'), amount, method: Plus.val('lp-method') }); DB.set('labpayments', pays);
    const ex = DB.get('expenses'); ex.push({ id: DB.nextId('expenses'), date: Plus.val('lp-date'), category: 'Laboratoire', label: `Règlement ${lab.name}`, amount, method: Plus.val('lp-method'), chequeNo: Plus.val('lp-cheque'), labPaymentId: pid }); DB.set('expenses', ex);
    DB.logActivity('payment', `Règlement de ${Utils.currency(amount)} à ${lab.name}`);
    App.closeModal('modal-labpay'); App.toast('Règlement enregistré'); App.refreshCurrent();
  },
};

/* ══════════════════════════════════════════
   TÂCHES DU CABINET
══════════════════════════════════════════ */
const Tasks = {
  PRIO: { 'Urgente': 4, 'Élevée': 3, 'Moyenne': 2, 'Faible': 1 },
  render() {
    const today = Utils.today(), all = DB.get('tasks');
    const who = Plus.val('task-filter-who');
    const list = all.filter(t => !who || t.assignee === who).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || this.PRIO[b.priority] - this.PRIO[a.priority]);
    const groups = [
      ['En retard', list.filter(t => !t.done && t.due && t.due < today), 'late'],
      ['Aujourd\'hui', list.filter(t => !t.done && t.due === today), 'today'],
      ['À venir', list.filter(t => !t.done && (!t.due || t.due > today)), ''],
      ['Réalisées', list.filter(t => t.done).slice(0, 8), 'done'],
    ];
    document.getElementById('tasks-board').innerHTML = groups.map(([title, items, cls]) => `
      <div class="task-group ${cls}"><h4>${title} <span>${items.length}</span></h4>
        ${items.map(t => `<div class="task ${t.done ? 'is-done' : ''}">
          <label class="task-check"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="Tasks.toggle(${t.id})"/><span></span></label>
          <div class="task-body"><b>${esc(t.title)}</b><small>${t.due ? Utils.formatDate(t.due) : 'Sans date'} · ${esc(t.assignee)}</small></div>
          <span class="prio p-${t.priority.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}">${t.priority}</span>
          <button class="icon-btn edit" onclick="Tasks.edit(${t.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn del" onclick="Tasks.remove(${t.id})"><i class="fa-solid fa-trash"></i></button></div>`).join('') || '<div class="wr-empty">Rien ici</div>'}
      </div>`).join('');
  },
  toggle(id) { const l = DB.get('tasks'); const t = l.find(x => x.id == id); t.done = !t.done; DB.set('tasks', l); if (t.done) App.toast('Tâche réalisée ✔'); App.refreshCurrent(); },
  edit(id) {
    const t = DB.get('tasks').find(x => x.id == id) || { title: '', due: Utils.today(), priority: 'Moyenne', assignee: App.role === 'assistante' ? 'Assistante' : 'Dentiste' };
    Plus.modal('modal-task', `<i class="fa-solid fa-list-check"></i> ${id ? 'Modifier la tâche' : 'Nouvelle tâche'}`, `<input type="hidden" id="tk-id" value="${id || ''}"/>
      <div class="form-grid"><div class="form-group form-full"><label>Tâche *</label><input id="tk-title" value="${esc(t.title)}" placeholder="Ex : commander des anesthésiques"/></div>
      <div class="form-group"><label>Échéance</label><input type="date" id="tk-due" value="${t.due || ''}"/></div>
      <div class="form-group"><label>Priorité</label><select id="tk-prio">${Object.keys(this.PRIO).map(p => `<option ${p === t.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="form-group"><label>Pour</label><select id="tk-who">${['Dentiste', 'Assistante'].map(p => `<option ${p === t.assignee ? 'selected' : ''}>${p}</option>`).join('')}</select></div></div>`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-task')">Annuler</button><button class="btn-primary" onclick="Tasks.save()"><i class="fa-solid fa-save"></i> Enregistrer</button>`, 'modal-sm');
    setTimeout(() => document.getElementById('tk-title').focus(), 50);
  },
  save() {
    const id = Plus.val('tk-id'), title = Plus.val('tk-title'); if (!title) { App.toast('Décrivez la tâche', 'error'); return; }
    const data = { title, due: Plus.val('tk-due'), priority: Plus.val('tk-prio'), assignee: Plus.val('tk-who') };
    const l = DB.get('tasks'); if (id) Object.assign(l.find(x => x.id == id), data); else l.push({ id: DB.nextId('tasks'), done: false, ...data });
    DB.set('tasks', l); App.closeModal('modal-task'); App.toast('Tâche enregistrée'); App.refreshCurrent();
  },
  remove(id) { DB.set('tasks', DB.get('tasks').filter(x => x.id != id)); App.toast('Tâche supprimée', 'warning'); App.refreshCurrent(); },
};

/* ══════════════════════════════════════════
   CAISSE & DÉPENSES — rapport du jour, mois, chèques émis
══════════════════════════════════════════ */
const Cash = {
  CATS: ['Fournitures', 'Laboratoire', 'Loyer', 'Salaires', 'Factures', 'Matériel', 'Impôts & CNSS', 'Autre'],
  render() {
    const dEl = document.getElementById('cash-date'); if (!dEl.value) dEl.value = Utils.today();
    const d = dEl.value, month = d.slice(0, 7);
    const pays = DB.payments(), ex = DB.get('expenses');
    const sum = (arr, k) => arr.reduce((s, x) => s + parseFloat(x[k] || 0), 0);
    const inDay = pays.filter(p => p.date === d), exDay = ex.filter(e => e.date === d);
    const inMonth = pays.filter(p => (p.date || '').startsWith(month)), exMonth = ex.filter(e => (e.date || '').startsWith(month));
    const rIn = sum(inDay, 'paidAmount'), rEx = sum(exDay, 'amount'), mIn = sum(inMonth, 'paidAmount'), mEx = sum(exMonth, 'amount');
    const byMethod = m => sum(inDay.filter(p => p.method === m), 'paidAmount');
    document.getElementById('cash-stats').innerHTML = `
      <div class="stat-card stat-green"><div class="stat-icon"><i class="fa-solid fa-arrow-down"></i></div><div class="stat-info"><span class="stat-number">${Utils.currencyShort(rIn)}</span><span class="stat-label">Encaissé le ${Utils.formatDate(d)}</span></div></div>
      <div class="stat-card stat-orange"><div class="stat-icon"><i class="fa-solid fa-arrow-up"></i></div><div class="stat-info"><span class="stat-number">${Utils.currencyShort(rEx)}</span><span class="stat-label">Dépensé ce jour</span></div></div>
      <div class="stat-card stat-blue"><div class="stat-icon"><i class="fa-solid fa-scale-balanced"></i></div><div class="stat-info"><span class="stat-number">${Utils.currencyShort(rIn - rEx)}</span><span class="stat-label">Solde du jour</span></div></div>
      <div class="stat-card stat-purple"><div class="stat-icon"><i class="fa-solid fa-calendar"></i></div><div class="stat-info"><span class="stat-number">${Utils.currencyShort(mIn - mEx)}</span><span class="stat-label">Net du mois (${Utils.currencyShort(mIn)} − ${Utils.currencyShort(mEx)})</span></div></div>`;
    document.getElementById('cash-day').innerHTML = `
      <div class="cash-lines"><h4>Recettes</h4>${inDay.map(p => `<div><span>${esc(Utils.patientName(p.patientId))} <small>${esc(p.invoiceNumber)} · ${esc(p.method)}</small></span><b>${Utils.currency(p.paidAmount)}</b></div>`).join('') || '<p class="text-muted">Aucun encaissement</p>'}
        <div class="cash-methods">${['Espèces', 'Chèque', 'Carte de débit', 'CNAM / Assurance', 'Virement'].map(m => byMethod(m) ? `<span>${m} : <b>${Utils.currency(byMethod(m))}</b></span>` : '').join('')}</div></div>
      <div class="cash-lines"><h4>Dépenses</h4>${exDay.map(e => `<div><span>${esc(e.label)} <small>${esc(e.category)} · ${esc(e.method)}</small></span><b>${Utils.currency(e.amount)}</b></div>`).join('') || '<p class="text-muted">Aucune dépense</p>'}</div>`;
    // Répartition du mois par catégorie
    const cats = this.CATS.map(c => [c, sum(exMonth.filter(e => e.category === c), 'amount')]).filter(([, v]) => v);
    const max = Math.max(1, ...cats.map(([, v]) => v));
    document.getElementById('cash-cats').innerHTML = cats.map(([c, v]) => `<div class="cat-row"><span>${c}</span><div class="cat-bar"><i style="width:${v / max * 100}%"></i></div><b>${Utils.currencyShort(v)}</b></div>`).join('') || '<p class="text-muted">Aucune dépense ce mois</p>';
    this.filter();
  },
  filter() {
    const cat = Plus.val('cash-filter-cat'), meth = Plus.val('cash-filter-method'), month = Plus.val('cash-date').slice(0, 7);
    const list = DB.get('expenses').filter(e => (!cat || e.category === cat) && (!meth || e.method === meth) && (meth === 'Chèque' || (e.date || '').startsWith(month))).sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('cash-table-body').innerHTML = list.map(e => `<tr><td>${Utils.formatDate(e.date)}</td><td>${esc(e.label)}</td><td><span class="cat-tag">${esc(e.category)}</span></td><td>${esc(e.method)}${e.chequeNo ? `<br><small class="text-muted">n° ${esc(e.chequeNo)}</small>` : ''}</td><td style="text-align:right"><b>${Utils.currency(e.amount)}</b></td>
      <td><div class="table-actions"><button class="icon-btn edit" onclick="Cash.edit(${e.id})"><i class="fa-solid fa-pen"></i></button><button class="icon-btn del" onclick="Cash.remove(${e.id})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')
      || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:1.5rem">Aucune dépense</td></tr>';
  },
  edit(id) {
    const e = DB.get('expenses').find(x => x.id == id) || { date: Utils.today(), category: 'Fournitures', label: '', amount: '', method: 'Espèces', chequeNo: '' };
    Plus.modal('modal-expense', `<i class="fa-solid fa-receipt"></i> ${id ? 'Modifier la dépense' : 'Nouvelle dépense'}`, `<input type="hidden" id="ex-id" value="${id || ''}"/>
      <div class="form-grid"><div class="form-group form-full"><label>Libellé *</label><input id="ex-label" value="${esc(e.label)}" placeholder="Ex : anesthésiques, loyer de mars…"/></div>
      <div class="form-group"><label>Montant (DT) *</label><input type="number" step="0.001" id="ex-amount" value="${e.amount}"/></div>
      <div class="form-group"><label>Date</label><input type="date" id="ex-date" value="${e.date}"/></div>
      <div class="form-group"><label>Catégorie</label><select id="ex-cat">${this.CATS.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>Mode</label><select id="ex-method">${['Espèces', 'Chèque', 'Virement', 'Carte'].map(c => `<option ${c === e.method ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>N° de chèque</label><input id="ex-cheque" value="${esc(e.chequeNo)}"/></div></div>`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-expense')">Annuler</button><button class="btn-primary" onclick="Cash.save()"><i class="fa-solid fa-save"></i> Enregistrer</button>`, 'modal-sm');
  },
  save() {
    const id = Plus.val('ex-id'), label = Plus.val('ex-label'), amount = parseFloat(Plus.val('ex-amount'));
    if (!label || !(amount > 0)) { App.toast('Libellé et montant obligatoires', 'error'); return; }
    const data = { label, amount, date: Plus.val('ex-date'), category: Plus.val('ex-cat'), method: Plus.val('ex-method'), chequeNo: Plus.val('ex-cheque') };
    const l = DB.get('expenses'); if (id) Object.assign(l.find(x => x.id == id), data); else l.push({ id: DB.nextId('expenses'), ...data });
    DB.set('expenses', l); DB.logActivity('payment', `Dépense : ${label} (${Utils.currency(amount)})`);
    App.closeModal('modal-expense'); App.toast('Dépense enregistrée'); App.refreshCurrent();
  },
  remove(id) { const e = DB.get('expenses').find(x => x.id == id); App.confirmDelete(`Supprimer la dépense « ${e.label} » ?`, () => { DB.set('expenses', DB.get('expenses').filter(x => x.id != id)); App.toast('Dépense supprimée', 'warning'); App.refreshCurrent(); }); },
  print() {
    const d = Plus.val('cash-date');
    Docs.preview(`<div class="doc-title">Rapport de caisse</div><p style="text-align:center;margin-bottom:1rem">${new Date(d + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="cash-print">${document.getElementById('cash-day').innerHTML}</div>
      <div class="doc-total">${document.getElementById('cash-stats').querySelectorAll('.stat-number')[2].textContent} <small>solde du jour</small></div>`, 'A4', 'Rapport de caisse');
  },
};

/* ══════════════════════════════════════════
   ORDONNANCES · CERTIFICATS · DEVIS (fiche patient)
══════════════════════════════════════════ */
const Docs = {
  MEDS: [
    ['Amoxicilline 1 g', '1 comprimé matin et soir', '7 jours'],
    ['Amoxicilline + acide clavulanique 1 g', '1 sachet matin et soir', '7 jours'],
    ['Métronidazole 500 mg', '1 comprimé 3 fois par jour', '7 jours'],
    ['Spiramycine + métronidazole', '2 comprimés 2 fois par jour', '7 jours'],
    ['Paracétamol 1 g', '1 comprimé si douleur, max 3 par jour', '3 jours'],
    ['Ibuprofène 400 mg', '1 comprimé 3 fois par jour après les repas', '3 jours'],
    ['Chlorhexidine 0,12 % bain de bouche', '2 fois par jour après brossage', '7 jours'],
    ['Gel gingival', '3 applications par jour', '5 jours'],
    ['Dentifrice désensibilisant', 'Brossage 2 fois par jour', '1 mois'],
  ],
  TITLES: { ordonnance: 'Ordonnance', certificat: 'Certificat médical', devis: 'Devis', cnam: 'Bulletin de soins CNAM' },
  PROSTH: /couronne|bridge|proth|facette|inlay|onlay|implant|pilier|gouttière/i,
  RELATIONS: ['Assuré social', 'Conjoint', 'Enfant', 'Ascendant'],
  render(pid) {
    const list = DB.get('documents').filter(d => d.patientId == pid).sort((a, b) => b.date.localeCompare(a.date));
    const el = document.getElementById('detail-docs-list'); if (!el) return;
    document.getElementById('detail-docs-count').textContent = `${list.length} document${list.length > 1 ? 's' : ''}`;
    el.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Document</th><th>Contenu</th><th></th></tr></thead><tbody>${list.map(d => `
      <tr><td>${Utils.formatDate(d.date)}</td><td><b>${this.TITLES[d.type]}</b></td><td class="text-muted" style="font-size:.82rem">${esc(this.summary(d))}</td>
      <td><div class="table-actions"><button class="icon-btn view" onclick="Docs.print(${d.id})" title="Imprimer"><i class="fa-solid fa-print"></i></button><button class="icon-btn edit" onclick="Docs.edit(${d.id})" title="Modifier"><i class="fa-solid fa-pen"></i></button><button class="icon-btn del" onclick="Docs.remove(${d.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state-sm"><i class="fa-solid fa-file-prescription"></i> Aucun document. Créez une ordonnance, un certificat ou un devis.</div>';
  },
  summary(d) {
    if (d.type === 'ordonnance') return d.lines.map(l => l.med).join(', ');
    if (d.type === 'certificat') return d.kind === 'repos' ? `Repos de ${d.days} jour(s)` : 'Certificat de présence';
    if (d.type === 'cnam') return `${d.rows.length} acte(s) · ${Utils.currency(d.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0))} · ${d.relation}`;
    return `${d.items.length} acte(s) · ${Utils.currency(d.items.reduce((s, i) => s + parseFloat(i.amount || 0), 0))}`;
  },
  edit(id, type) {
    const d = DB.get('documents').find(x => x.id == id) || { type, date: Utils.today(), lines: [{ med: '', dose: '', dur: '' }], kind: 'presence', days: 1, text: '', items: [] };
    if (d.type === 'devis' && !d.items.length) {
      // Pré-rempli avec les soins prévus ou en cours du patient
      d.items = DB.treatments().filter(t => t.patientId == App.currentPatientId && t.status !== 'Terminé').map(t => ({ description: `${t.procedure}${t.teeth?.length ? ' (dent ' + t.teeth.join(', ') + ')' : ''}`, amount: t.cost }));
      if (!d.items.length) d.items = [{ description: '', amount: '' }];
    }
    if (d.type === 'cnam' && !d.rows) {
      // Pré-rempli : identité depuis la fiche, actes des 90 derniers jours
      const p = DB.patients().find(x => x.id == App.currentPatientId) || {};
      const c = p.cnam || {};
      d.relation = c.relation || 'Assuré social';
      d.insured = { id: c.id || '', regime: c.regime || 'CNSS', first: c.first || p.firstName || '', last: c.last || p.lastName || '', address: c.address || p.address || '', cp: c.cp || '' };
      d.patientPhone = p.phone || '';
      const since = dayISO(-90);
      d.rows = DB.treatments().filter(t => t.patientId == App.currentPatientId && t.date >= since).sort((a, b) => a.date.localeCompare(b.date))
        .map(t => { const a = Acts.find(t.procedure); return { date: t.date, teeth: (t.teeth || []).join(' '), label: t.procedure, code: a?.code || '', cot: a?.cot || '', amount: t.cost, prosthesis: a ? a.prosthesis : this.PROSTH.test(t.procedure), include: true }; });
      if (!d.rows.length) d.rows = [{ date: Utils.today(), teeth: '', label: '', code: '', cot: '', amount: '', prosthesis: false, include: true }];
    }
    this._cur = JSON.parse(JSON.stringify(d)); this._cur.id = id || '';
    this._draw();
  },
  _drawCnam(d) {
    const ins = d.insured, set = (k, v) => `Docs._cur.insured.${k}=${v}`;
    const f = (label, k, ph = '', w = '') => `<div class="form-group ${w}"><label>${label}</label><input value="${esc(ins[k])}" placeholder="${ph}" oninput="${set(k, 'this.value')}"/></div>`;
    return `<div class="cnam-edit">
      <h4><i class="fa-solid fa-id-card"></i> Assuré social</h4>
      <div class="form-grid">
        ${f('Identifiant unique CNAM *', 'id', 'Ex : 12345678/01', '')}
        <div class="form-group"><label>Régime</label><select onchange="${set('regime', 'this.value')}">${['CNSS', 'CNRPS', 'Convention bilatérale'].map(r => `<option ${r === ins.regime ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        ${f('Prénom de l\'assuré', 'first')}${f('Nom de l\'assuré', 'last')}
        ${f('Adresse', 'address', '', 'form-full')}${f('Code postal', 'cp', '4100')}
        <div class="form-group"><label>Code praticien CNAM <span class="hint">(colonne « Code professionnel de santé »)</span></label><input value="${esc(DB.settings().cnamCode || '')}" placeholder="Votre code conventionnel" onchange="const s=DB.settings();s.cnamCode=this.value.trim();DB.saveSettings(s)"/></div>
        <div class="form-group"><label>Le malade est</label><select onchange="Docs._cur.relation=this.value">${this.RELATIONS.map(r => `<option ${r === d.relation ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      </div>
      <h4><i class="fa-solid fa-tooth"></i> Actes <span class="hint">— cochez les actes à déclarer ; « Prothèse » les place dans le tableau des prothèses</span></h4>
      <div class="cnam-rows">
        <div class="cnam-row head"><span></span><span>Date</span><span>Dent(s)</span><span>Acte</span><span>Code acte</span><span>Cotation</span><span>Honoraires</span><span>Prothèse</span><span></span></div>
        ${d.rows.map((r, i) => `<div class="cnam-row ${r.include ? '' : 'off'}">
          <input type="checkbox" ${r.include ? 'checked' : ''} onchange="Docs._cur.rows[${i}].include=this.checked;this.parentNode.classList.toggle('off',!this.checked);Docs._cnamTotal()" title="Déclarer cet acte"/>
          <input type="date" value="${r.date}" oninput="Docs._cur.rows[${i}].date=this.value"/>
          <input value="${esc(r.teeth)}" placeholder="36" oninput="Docs._cur.rows[${i}].teeth=this.value"/>
          <input value="${esc(r.label)}" placeholder="Acte" list="acts-names" onchange="Docs.pickAct(${i},this.value)"/>
          <input value="${esc(r.code)}" placeholder="—" oninput="Docs._cur.rows[${i}].code=this.value"/>
          <input value="${esc(r.cot)}" list="cnam-keys" placeholder="D 20" oninput="Docs._cur.rows[${i}].cot=this.value"/>
          <input type="number" step="0.001" value="${r.amount}" oninput="Docs._cur.rows[${i}].amount=this.value;Docs._cnamTotal()"/>
          <input type="checkbox" ${r.prosthesis ? 'checked' : ''} onchange="Docs._cur.rows[${i}].prosthesis=this.checked" title="Prothèse"/>
          <button class="icon-btn del" onclick="Docs._cur.rows.splice(${i},1);Docs._draw()"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}
      </div>
      <datalist id="acts-names">${Acts.list().map(a => `<option value="${esc(a.name)}">${esc([a.code, a.cot].filter(Boolean).join(' · '))}</option>`).join('')}</datalist>
      ${d.rows.some(r => r.include && !r.code && !r.cot) ? `<p class="cnam-missing"><i class="fa-solid fa-circle-info"></i> Certains actes n'ont pas encore de code ni de cotation. Complétez-les ici, ou une fois pour toutes dans <a class="link" onclick="App.closeModal('modal-doc-edit');App.navigate('acts')">Actes & tarifs</a>.</p>` : ''}
      <datalist id="cnam-keys"><option value="C">Consultation</option><option value="D ">Soins dentaires</option><option value="DC ">Chirurgie dentaire</option><option value="SPR ">Prothèse dentaire</option><option value="Z ">Radiographie</option></datalist>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.6rem"><button class="btn-secondary btn-xs" onclick="Docs._cur.rows.push({date:Utils.today(),teeth:'',label:'',code:'',cot:'',amount:'',prosthesis:false,include:true});Docs._draw()"><i class="fa-solid fa-plus"></i> Acte</button><b id="cnam-total"></b></div>
      <p class="text-muted" style="font-size:.78rem;margin-top:.6rem"><i class="fa-solid fa-circle-info"></i> Codes et cotations selon la nomenclature CNAM en vigueur. L'identité de l'assuré est mémorisée dans la fiche pour les prochains bulletins.</p>
    </div>`;
  },
  pickAct(i, name) {
    const r = this._cur.rows[i]; r.label = name; const a = Acts.find(name);
    if (a) { r.code = a.code; r.cot = a.cot; r.prosthesis = a.prosthesis; if (!parseFloat(r.amount)) r.amount = a.price; this._draw(); }
  },
  _cnamTotal() { const el = document.getElementById('cnam-total'); if (el) el.textContent = 'Total déclaré : ' + Utils.currency(this._cur.rows.filter(r => r.include).reduce((s, r) => s + parseFloat(r.amount || 0), 0)); },
  /* Bulletin officiel CNAM (soins dentaires, recto) : positions mesurées sur le PDF de la CNAM, en points (page 842 × 595,5).
     Les données sont posées sur l'image du formulaire, ou seules pour imprimer sur un bulletin pré-imprimé. */
  CNAM_FORM: {
    W: 842, H: 595.5,
    care: { rows: [94, 118, 141.5, 165, 188, 212, 236], cols: [55.5, 102, 130.5, 217.5, 240.5, 289, 338.5, 386.5] },
    pros: { rows: [434, 458, 481, 504.5, 528.5, 552.5], cols: [55.5, 102, 132.5, 217.5, 242.5, 289, 337.5, 386.5] },
    idBoxes: [547, 562.5, 578.5, 594.5, 610.5, 626.5, 641.5, 657.5, 673, 689, 705], idY: [175, 195.5],
    regime: { 'CNSS': [555.5, 209.5], 'CNRPS': [632, 209.5], 'Convention bilatérale': [762.3, 209.5] },
    relation: { 'Ascendant': [489.8, 371.5], 'Enfant': [569.8, 371.5], 'Conjoint': [637, 371.5], 'Assuré social': [703.3, 371.5] },
    teeth: {"11":[164.7,260.6],"12":[155.8,266.0],"13":[146.8,273.3],"14":[141.5,281.3],"15":[138.0,288.1],"16":[133.9,296.7],"17":[131.0,306.6],"18":[129.0,318.5],"21":[174.1,260.6],"22":[184.2,266.1],"23":[192.3,273.9],"24":[195.7,281.1],"25":[200.3,288.1],"26":[202.9,296.6],"27":[206.3,306.3],"28":[207.8,318.3],"31":[174.6,386.2],"32":[182.5,384.3],"33":[190.0,378.9],"34":[196.4,371.9],"35":[200.2,365.8],"36":[203.3,357.1],"37":[206.4,348.1],"38":[208.8,335.2],"41":[165.2,386.2],"42":[157.8,384.7],"43":[149.8,381.9],"44":[142.3,373.7],"45":[138.9,367.1],"46":[134.8,358.6],"47":[131.2,348.0],"48":[128.7,336.5],"51":[284.8,284.5],"52":[274.4,290.2],"53":[266.7,299.4],"54":[260.6,308.8],"55":[259.2,318.6],"61":[297.5,284.9],"62":[307.3,289.3],"63":[314.2,298.6],"64":[320.9,308.8],"65":[321.7,319.1],"71":[297.5,367.5],"72":[305.4,365.1],"73":[314.3,357.1],"74":[318.7,347.2],"75":[320.4,335.1],"81":[287.1,367.5],"82":[277.8,365.3],"83":[269.0,357.6],"84":[261.9,347.8],"85":[259.8,336.5]},
  },
  cnamHtml(d, p) {
    const F = this.CNAM_FORM, pt = (x, y) => `left:${x / F.W * 100}%;top:${y / F.H * 100}%`;
    const txt = (x, y, v, cls = '', w) => v ? `<span class="cf-t ${cls}" style="${pt(x, y)}${w ? `;width:${w / F.W * 100}%` : ''}">${esc(v)}</span>` : '';
    const mark = ([x, y]) => `<span class="cf-x" style="${pt(x, y)}">X</span>`;
    const ddmmyy = iso => iso ? iso.split('-').reverse().join('/') : '';
    const proCode = DB.settings().cnamCode || '';
    // Tableaux : une ligne par acte, centrée dans sa case
    const table = (T, rows) => rows.slice(0, T.rows.length - 1).map((r, i) => {
      const y = (T.rows[i] + T.rows[i + 1]) / 2, c = T.cols, mid = k => (c[k] + c[k + 1]) / 2;
      return txt(mid(0), y, ddmmyy(r.date), 'c') + txt(mid(1), y, r.teeth, 'c sm') + txt(c[2] + 3, y, r.code || r.label, 'l', c[3] - c[2] - 6)
        + txt(mid(3), y, r.cot, 'c sm') + txt(c[5] - 3, y, parseFloat(r.amount || 0).toFixed(3), 'r') + txt(mid(5), y, proCode, 'c sm');
    }).join('');
    const soins = d.rows.filter(r => !r.prosthesis), proth = d.rows.filter(r => r.prosthesis);
    const ins = d.insured;
    const idChars = String(ins.id || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 10).split('');
    const ids = idChars.map((ch, i) => txt((F.idBoxes[i] + F.idBoxes[i + 1]) / 2, (F.idY[0] + F.idY[1]) / 2, ch, 'c big')).join('');
    const teeth = new Set(d.rows.flatMap(r => String(r.teeth).split(/[^0-9]+/).filter(Boolean)));
    const circles = [...teeth].filter(t => F.teeth[t]).map(t => `<span class="cf-o" style="${pt(...F.teeth[t])}"></span>`).join('');
    const addr = (ins.address || '').length > 58 ? [ins.address.slice(0, 58), ins.address.slice(58)] : [ins.address, ''];
    return `<div class="cnam-sheet" id="cnam-sheet"><img class="cnam-bg" src="img/cnam-bulletin-dentaire.jpg" alt="Bulletin de remboursement des frais de soins CNAM"/>
      ${table(F.care, soins)}${table(F.pros, proth)}${circles}
      ${ids}${F.regime[ins.regime] ? mark(F.regime[ins.regime]) : ''}
      ${txt(503, 246.5, ins.first, 'l')}${txt(491, 265.5, ins.last, 'l')}${txt(507, 283.5, addr[0], 'l')}${txt(474, 301, addr[1], 'l')}${txt(514, 320.5, ins.cp, 'l')}
      ${F.relation[d.relation === 'Assuré social' ? 'Assuré social' : d.relation] ? mark(F.relation[d.relation]) : ''}
      ${txt(504, 408, p.firstName, 'l')}${txt(494, 426, p.lastName, 'l')}${txt(542, 445, ddmmyy(p.dob), 'l')}${txt(608, 460.5, d.patientPhone || p.phone || '', 'l')}
    </div>
    ${soins.length > 6 || proth.length > 5 ? `<p class="cnam-warn"><i class="fa-solid fa-triangle-exclamation"></i> Le bulletin a 6 lignes de soins et 5 de prothèses : ${soins.length > 6 ? soins.length - 6 + ' soin(s)' : ''} ${proth.length > 5 ? proth.length - 5 + ' prothèse(s)' : ''} à reporter sur un second bulletin.</p>` : ''}`;
  },
  cnamBlank(on) { document.getElementById('cnam-sheet')?.classList.toggle('data-only', on); },

  _draw() {
    const d = this._cur, t = d.type;
    let body = `<div class="form-grid" style="margin-bottom:1rem"><div class="form-group"><label>Date</label><input type="date" value="${d.date}" onchange="Docs._cur.date=this.value"/></div><div class="form-group"><label>Patient</label><input disabled value="${esc(Utils.patientName(App.currentPatientId))}"/></div></div>`;
    if (t === 'cnam') {
      body += this._drawCnam(d);
    } else if (t === 'ordonnance') {
      body += `<div class="rx-quick"><span>Ajout rapide :</span>${this.MEDS.map((m, i) => `<button class="chip" onclick="Docs.addMed(${i})">${esc(m[0])}</button>`).join('')}</div>
        <div class="rx-lines">${d.lines.map((l, i) => `<div class="rx-line"><span class="rx-n">${i + 1}</span>
          <input placeholder="Médicament" value="${esc(l.med)}" oninput="Docs._cur.lines[${i}].med=this.value"/>
          <input placeholder="Posologie" value="${esc(l.dose)}" oninput="Docs._cur.lines[${i}].dose=this.value"/>
          <input placeholder="Durée" value="${esc(l.dur)}" oninput="Docs._cur.lines[${i}].dur=this.value" class="rx-dur"/>
          <button class="icon-btn del" onclick="Docs._cur.lines.splice(${i},1);Docs._draw()"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}</div>
        <button class="btn-secondary btn-xs" onclick="Docs._cur.lines.push({med:'',dose:'',dur:''});Docs._draw()"><i class="fa-solid fa-plus"></i> Ligne</button>`;
    } else if (t === 'certificat') {
      body += `<div class="form-grid"><div class="form-group"><label>Type</label><select onchange="Docs._cur.kind=this.value;Docs._draw()"><option value="presence" ${d.kind === 'presence' ? 'selected' : ''}>Présence au cabinet</option><option value="repos" ${d.kind === 'repos' ? 'selected' : ''}>Repos / arrêt</option></select></div>
        ${d.kind === 'repos' ? `<div class="form-group"><label>Nombre de jours</label><input type="number" min="1" value="${d.days}" oninput="Docs._cur.days=this.value"/></div>` : '<div></div>'}
        <div class="form-group form-full"><label>Précisions <span class="hint">(facultatif)</span></label><textarea oninput="Docs._cur.text=this.value" placeholder="Ex : suite à une extraction chirurgicale de la dent 38">${esc(d.text)}</textarea></div></div>`;
    } else {
      body += `<div class="rx-lines">${d.items.map((it, i) => `<div class="rx-line"><span class="rx-n">${i + 1}</span>
          <input placeholder="Acte" value="${esc(it.description)}" oninput="Docs._cur.items[${i}].description=this.value" style="flex:3"/>
          <input type="number" step="0.001" placeholder="Montant DT" value="${it.amount}" oninput="Docs._cur.items[${i}].amount=this.value;Docs._total()" class="rx-dur"/>
          <button class="icon-btn del" onclick="Docs._cur.items.splice(${i},1);Docs._draw()"><i class="fa-solid fa-xmark"></i></button></div>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem"><button class="btn-secondary btn-xs" onclick="Docs._cur.items.push({description:'',amount:''});Docs._draw()"><i class="fa-solid fa-plus"></i> Acte</button><b id="devis-total"></b></div>`;
    }
    Plus.modal('modal-doc-edit', `<i class="fa-solid fa-file-prescription"></i> ${this.TITLES[t]}`, body,
      `<button class="btn-secondary" onclick="App.closeModal('modal-doc-edit')">Annuler</button><button class="btn-outline" onclick="Docs.save()"><i class="fa-solid fa-save"></i> Enregistrer</button><button class="btn-primary" onclick="Docs.print(Docs.save())"><i class="fa-solid fa-print"></i> Enregistrer et imprimer</button>`, 'modal-lg');
    if (t === 'devis') this._total();
    if (t === 'cnam') this._cnamTotal();
  },
  _total() { const el = document.getElementById('devis-total'); if (el) el.textContent = 'Total : ' + Utils.currency(this._cur.items.reduce((s, i) => s + parseFloat(i.amount || 0), 0)); },
  addMed(i) {
    const [med, dose, dur] = this.MEDS[i]; const L = this._cur.lines;
    const empty = L.findIndex(l => !l.med); if (empty >= 0) L[empty] = { med, dose, dur }; else L.push({ med, dose, dur });
    this._draw();
  },
  save() {
    const d = this._cur; const pid = App.currentPatientId;
    if (d.type === 'ordonnance') d.lines = d.lines.filter(l => l.med.trim());
    if (d.type === 'devis') d.items = d.items.filter(i => i.description.trim());
    if (d.type === 'ordonnance' && !d.lines.length) { App.toast('Ajoutez au moins un médicament', 'error'); return; }
    if (d.type === 'cnam') {
      d.rows = d.rows.filter(r => r.include && (r.label || r.code));
      if (!d.rows.length) { App.toast('Cochez au moins un acte à déclarer', 'error'); return; }
      if (!d.insured.id) App.toast('Identifiant CNAM vide : il faudra le compléter à la main', 'warning');
      // Mémorise l'identité de l'assuré dans la fiche pour les prochains bulletins
      const pats = DB.patients(); const pp = pats.find(x => x.id == pid); if (pp) { pp.cnam = { ...d.insured, relation: d.relation }; DB.savePatients(pats); }
    }
    const all = DB.get('documents'); let id = d.id;
    if (id) all[all.findIndex(x => x.id == id)] = { ...d, patientId: pid };
    else { id = DB.nextId('documents'); all.push({ ...d, id, patientId: pid }); }
    DB.set('documents', all); DB.logActivity('treatment', `${this.TITLES[d.type]} pour ${Utils.patientName(pid)}`);
    App.closeModal('modal-doc-edit'); App.toast(`${this.TITLES[d.type]} enregistré${d.type === 'ordonnance' ? 'e' : ''}`); this.render(pid);
    return id;
  },
  remove(id) { App.confirmDelete('Supprimer ce document ?', () => { DB.set('documents', DB.get('documents').filter(x => x.id != id)); App.toast('Document supprimé', 'warning'); this.render(App.currentPatientId); }); },
  header() {
    const s = DB.settings();
    return `<div class="doc-head"><div><b>${esc(USERS.dentiste.name)}</b><span>Chirurgien-dentiste</span><span>${esc(s.clinicAddr || '1 Bis Rue Pasteur (en face du CHU Habib Bourguiba)')}</span><span>${esc(s.clinicCity || '4100 Médenine')} · Tél. ${esc(s.clinicPhone || '+216 23 232 407')}</span></div><div class="doc-logo"><i class="fa-solid fa-tooth"></i><span>${esc(s.clinicName || 'Cabinet dentaire Dr Nouha Ksiksi')}</span></div></div>`;
  },
  print(id) {
    if (!id) return;
    const d = DB.get('documents').find(x => x.id == id); if (!d) return;
    const p = DB.patients().find(x => x.id == d.patientId) || {};
    const who = `<div class="doc-patient"><span>Patient(e) : <b>${esc(p.firstName + ' ' + p.lastName)}</b>${p.dob ? ` · ${Utils.age(p.dob)} ans` : ''}</span><span>Le ${Utils.formatDate(d.date)}</span></div>`;
    if (d.type === 'cnam') { this.preview(this.cnamHtml(d, p), 'A4 landscape', this.TITLES.cnam); return; }
    let html = this.header();
    if (d.type === 'ordonnance') {
      html += `<div class="doc-title">Ordonnance</div>${who}<ol class="rx-print">${d.lines.map(l => `<li><b>${esc(l.med)}</b><span>${esc(l.dose)}${l.dur ? ' — pendant ' + esc(l.dur) : ''}</span></li>`).join('')}</ol>`;
    } else if (d.type === 'certificat') {
      const txt = d.kind === 'repos'
        ? `Je soussigné(e), ${esc(USERS.dentiste.name)}, certifie avoir examiné ce jour ${esc(p.firstName + ' ' + p.lastName)} et que son état de santé nécessite un repos de <b>${esc(d.days)} jour(s)</b> à compter du ${Utils.formatDate(d.date)}, sauf complications.`
        : `Je soussigné(e), ${esc(USERS.dentiste.name)}, certifie que ${esc(p.firstName + ' ' + p.lastName)} s'est présenté(e) à mon cabinet le ${Utils.formatDate(d.date)} pour des soins dentaires.`;
      html += `<div class="doc-title">Certificat médical</div><p class="doc-text">${txt}</p>${d.text ? `<p class="doc-text">${esc(d.text)}</p>` : ''}<p class="doc-text">Certificat délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>`;
    } else {
      const tot = d.items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
      html += `<div class="doc-title">Devis</div>${who}<table class="invoice-print-table"><thead><tr><th>N°</th><th>Acte</th><th style="text-align:right">Montant</th></tr></thead><tbody>${d.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.description)}</td><td style="text-align:right">${Utils.currency(it.amount)}</td></tr>`).join('')}</tbody></table>
        <div class="doc-total">Total : ${Utils.currency(tot)}</div><p class="doc-text" style="font-size:.8rem">Devis valable 3 mois. Le plan de traitement peut évoluer selon les constatations cliniques ; tout changement vous sera expliqué au préalable.</p>`;
    }
    html += `<div class="doc-sign">Signature et cachet</div>`;
    this.preview(html, d.type === 'devis' ? 'A4' : 'A5', this.TITLES[d.type]);
  },
  preview(html, size, title) {
    this._size = size;
    const cnam = size === 'A4 landscape';
    Plus.modal('modal-doc-print', `<i class="fa-solid fa-print"></i> ${title}`, cnam ? html : `<div class="doc-sheet doc-${size}">${html}</div>`,
      `${cnam ? `<label class="switch-line cnam-only"><input type="checkbox" onchange="Docs.cnamBlank(this.checked)"/> Données seules (impression sur un bulletin vierge)</label>` : ''}
       <button class="btn-secondary" onclick="App.closeModal('modal-doc-print')">Fermer</button><button class="btn-primary" onclick="Docs.doPrint()"><i class="fa-solid fa-print"></i> Imprimer (${cnam ? 'A4 paysage' : size})</button>`, cnam ? 'modal-xl' : 'modal-lg');
  },
  doPrint() {
    // Bulletin CNAM : page sans marge pour que les données tombent pile dans les cases du formulaire
    const st = document.createElement('style'); st.textContent = `@page { size: ${this._size}; margin: ${this._size === 'A4 landscape' ? 0 : '12mm'}; }`; document.head.appendChild(st);
    window.print(); setTimeout(() => st.remove(), 1000);
  },
};

/* ══════════════════════════════════════════
   AVANT / APRÈS — galerie avec consentement de publication
══════════════════════════════════════════ */
const Gallery = {
  demoImage(kind, n) {
    // Illustration neutre (aucune vraie photo de patient dans la démo)
    const after = kind === 'apres';
    const teeth = [...Array(6)].map((_, i) => {
      const x = 40 + i * 54, gap = !after && n === 2 && i === 2 ? 14 : 0, miss = !after && n === 1 && i === 4;
      const h = after ? 92 : 80 + ((i * 7) % 14), col = after ? '#fbfaf5' : ['#e9dcae', '#e3d29b', '#eadfb6'][i % 3];
      return miss ? '' : `<rect x="${x + gap}" y="${110 - h / 2}" width="48" height="${h}" rx="14" fill="${col}" stroke="#d8cfb8" stroke-width="1.5"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><rect width="400" height="220" fill="#3b1d24"/><rect y="40" width="400" height="140" rx="60" fill="#c96b7a"/>${teeth}<text x="200" y="208" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="12" opacity=".7">illustration de démonstration</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  },
  render() {
    const f = Plus.val('gal-filter');
    const list = DB.get('gallery').filter(c => !f || (f === 'pub' ? c.published : f === 'nocons' ? !c.consent : true)).sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('gallery-grid').innerHTML = list.map(c => `
      <div class="gal-card">
        <div class="ba-mini" id="ba-${c.id}"><img src="${c.after}" alt="Après"/><div class="ba-mini-before"><img src="${c.before}" alt="Avant"/></div><span class="ba-l">Avant</span><span class="ba-r">Après</span>
          <input type="range" min="0" max="100" value="50" oninput="Gallery.slide(${c.id},this.value)" aria-label="Comparer"/></div>
        <div class="gal-body"><b>${esc(c.title)}</b><small><a class="link" onclick="App.openPatient(${c.patientId})">${esc(Utils.patientName(c.patientId))}</a> · ${esc(c.treatment)} · ${Utils.formatDate(c.date)}</small>
          <div class="gal-flags">
            <label class="switch-line"><input type="checkbox" ${c.consent ? 'checked' : ''} onchange="Gallery.toggle(${c.id},'consent')"/> Consentement écrit signé</label>
            <label class="switch-line ${c.consent ? '' : 'disabled'}"><input type="checkbox" ${c.published ? 'checked' : ''} ${c.consent ? '' : 'disabled'} onchange="Gallery.toggle(${c.id},'published')"/> Publié sur le site</label>
          </div>
          <div class="gal-actions"><button class="icon-btn del" onclick="Gallery.remove(${c.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button></div></div>
      </div>`).join('') || '<div class="empty-state-sm" style="grid-column:1/-1"><i class="fa-solid fa-images"></i> Aucun cas. Ajoutez des photos avant / après.</div>';
    list.forEach(c => this.slide(c.id, 50));
  },
  slide(id, v) { const w = document.querySelector(`#ba-${id} .ba-mini-before`); if (w) w.style.clipPath = `inset(0 ${100 - v}% 0 0)`; },
  toggle(id, k) {
    const l = DB.get('gallery'); const c = l.find(x => x.id == id); c[k] = !c[k];
    if (k === 'consent' && !c.consent) c.published = false;
    DB.set('gallery', l);
    App.toast(k === 'published' ? (c.published ? 'Cas publié dans la galerie du site (simulation)' : 'Cas retiré du site') : (c.consent ? 'Consentement enregistré' : 'Consentement retiré : cas retiré du site'), c[k] ? 'success' : 'warning');
    this.render();
  },
  remove(id) { App.confirmDelete('Supprimer ce cas avant / après ?', () => { DB.set('gallery', DB.get('gallery').filter(x => x.id != id)); App.toast('Cas supprimé', 'warning'); this.render(); }); },
  openNew() {
    this._imgs = {};
    Plus.modal('modal-gallery', '<i class="fa-solid fa-images"></i> Nouveau cas avant / après', `
      <div class="form-grid"><div class="form-group form-full"><label>Patient *</label><select id="gl-patient">${Plus.patientOptions(App.currentPage === 'patient-detail' ? App.currentPatientId : '')}</select></div>
      <div class="form-group"><label>Titre *</label><input id="gl-title" placeholder="Ex : facettes sur 4 incisives"/></div>
      <div class="form-group"><label>Traitement</label><select id="gl-treat">${['Prothèse fixe', 'Prothèse amovible', 'Implant', 'Esthétique', 'Chirurgie', 'Soins'].map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Photo avant *</label><input type="file" accept="image/*" onchange="Gallery.read(this,'before')"/><div class="gl-prev" id="gl-prev-before"></div></div>
      <div class="form-group"><label>Photo après *</label><input type="file" accept="image/*" onchange="Gallery.read(this,'after')"/><div class="gl-prev" id="gl-prev-after"></div></div>
      <div class="form-group form-full"><label class="switch-line"><input type="checkbox" id="gl-consent"/> Le patient a signé le consentement de publication</label></div></div>
      <p class="text-muted" style="font-size:.8rem">Les photos sont réduites et leurs métadonnées retirées avant enregistrement.</p>`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-gallery')">Annuler</button><button class="btn-primary" onclick="Gallery.save()"><i class="fa-solid fa-save"></i> Enregistrer</button>`);
  },
  read(input, k) {
    const file = input.files[0]; if (!file) return;
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      // Redimensionne (900 px max) et ré-encode : enlève aussi les métadonnées EXIF
      const s = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      this._imgs[k] = c.toDataURL('image/jpeg', .8); URL.revokeObjectURL(url);
      document.getElementById('gl-prev-' + k).innerHTML = `<img src="${this._imgs[k]}" alt=""/>`;
    };
    img.src = url;
  },
  save() {
    const pid = parseInt(Plus.val('gl-patient')), title = Plus.val('gl-title');
    if (!pid || !title || !this._imgs.before || !this._imgs.after) { App.toast('Patient, titre et les deux photos sont obligatoires', 'error'); return; }
    const l = DB.get('gallery');
    l.push({ id: DB.nextId('gallery'), patientId: pid, title, treatment: Plus.val('gl-treat'), date: Utils.today(), before: this._imgs.before, after: this._imgs.after, consent: document.getElementById('gl-consent').checked, published: false });
    try { DB.set('gallery', l); } catch { App.toast('Stockage du navigateur plein', 'error'); return; }
    DB.logActivity('treatment', `Cas avant / après ajouté pour ${Utils.patientName(pid)}`);
    App.closeModal('modal-gallery'); App.toast('Cas ajouté'); if (App.currentPage === 'gallery') this.render();
  },
};


/* ══════════════════════════════════════════
   ACTES & TARIFS — catalogue partagé (dentiste ET assistante)
   Une seule liste : tarif, code acte CNAM, cotation, prothèse ou non.
   Alimente les prix des soins et le bulletin CNAM.
══════════════════════════════════════════ */
const Acts = {
  DEFAULT: [
    ['Consultation', 40], ['Bilan & Détartrage', 60], ['Détartrage & Polissage', 70], ['Obturation composite', 80],
    ['Obturation amalgame', 60], ['Traitement canalaire', 250], ['Pulpotomie', 90], ['Extraction dentaire', 50],
    ['Extraction chirurgicale', 90], ['Extraction dent de sagesse', 150], ['Radiographie', 20], ['Traitement des gencives (Gingivectomie)', 120],
    ['Préparation de couronne', 150], ['Pose de couronne', 450], ['Couronne zircone', 650], ['Pose de bridge', 1200],
    ['Pose de facettes', 600], ['Inlay / onlay', 350], ['Prothèse complète', 900], ['Prothèse partielle', 600],
    ['Prothèse sur 2 implants', 2800], ['Implant dentaire', 1800], ['Greffe osseuse', 700], ['Blanchiment dentaire', 400],
    ['Gouttière de protection nocturne', 150], ['Traitement d\'urgence', 50],
  ],
  _fill(a) { return { name: a.name || '', price: parseFloat(a.price) || 0, code: a.code || '', cot: a.cot || '', prosthesis: a.prosthesis ?? Docs.PROSTH.test(a.name || '') }; },
  list() {
    const s = DB.settings();
    return (s.services && s.services.length ? s.services : this.DEFAULT.map(([name, price]) => ({ name, price }))).map(a => this._fill(a));
  },
  saveList(l) { const s = DB.settings(); s.services = l; DB.saveSettings(s); },
  find(name) { const n = String(name || '').trim().toLowerCase(); return n ? this.list().find(a => a.name.toLowerCase() === n) : null; },
  render() {
    const q = Plus.val('acts-search').toLowerCase(), all = this.list();
    document.getElementById('acts-pro-code').value = DB.settings().cnamCode || '';
    const missing = all.filter(a => !a.code && !a.cot).length;
    document.getElementById('acts-missing').innerHTML = missing
      ? `<i class="fa-solid fa-circle-info"></i> ${missing} acte${missing > 1 ? 's' : ''} sans code CNAM ni cotation — à compléter pour remplir les bulletins automatiquement.`
      : '<i class="fa-solid fa-circle-check"></i> Tous les actes ont un code ou une cotation CNAM.';
    document.getElementById('acts-missing').classList.toggle('ok', !missing);
    document.getElementById('acts-body').innerHTML = all.map((a, i) => ({ a, i })).filter(({ a }) => !q || (a.name + ' ' + a.code + ' ' + a.cot).toLowerCase().includes(q)).map(({ a, i }) => `
      <tr class="${!a.code && !a.cot ? 'act-missing' : ''}">
        <td><input class="act-in" value="${esc(a.name)}" onchange="Acts.set(${i},'name',this.value)" placeholder="Nom de l'acte"/></td>
        <td><input class="act-in num" type="number" min="0" step="0.001" value="${a.price}" onchange="Acts.set(${i},'price',parseFloat(this.value)||0)"/></td>
        <td><input class="act-in" value="${esc(a.code)}" onchange="Acts.set(${i},'code',this.value)" placeholder="—"/></td>
        <td><input class="act-in" value="${esc(a.cot)}" list="cnam-keys-acts" onchange="Acts.set(${i},'cot',this.value)" placeholder="ex. D 20"/></td>
        <td style="text-align:center"><input type="checkbox" ${a.prosthesis ? 'checked' : ''} onchange="Acts.set(${i},'prosthesis',this.checked)" title="Va dans le tableau « Prothèses dentaires » du bulletin"/></td>
        <td><button class="icon-btn del" onclick="Acts.remove(${i})" title="Supprimer"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:1.2rem">Aucun acte trouvé</td></tr>';
  },
  set(i, k, v) {
    const l = this.list(); l[i][k] = typeof v === 'string' ? v.trim() : v; this.saveList(l);
    this._saved(); if (k === 'code' || k === 'cot' || k === 'name') this.render();
  },
  add() {
    const l = this.list(); l.unshift(this._fill({ name: '', price: 0 })); this.saveList(l);
    document.getElementById('acts-search').value = ''; this.render();
    document.querySelector('#acts-body .act-in')?.focus();
  },
  remove(i) {
    const l = this.list(); const a = l[i];
    App.confirmDelete(`Supprimer l'acte « ${a.name || 'sans nom'} » du catalogue ?`, () => { l.splice(i, 1); this.saveList(l); DB.logActivity('treatment', `Acte « ${a.name} » retiré du catalogue par ${USERS[App.role]?.name || ''}`); this.render(); App.toast('Acte supprimé', 'warning'); });
  },
  setProCode(v) { const s = DB.settings(); s.cnamCode = v.trim(); DB.saveSettings(s); this._saved(); },
  _saved() {
    const el = document.getElementById('acts-saved'); if (!el) return;
    el.textContent = `Enregistré à ${new Date().toTimeString().slice(0, 5)}`; el.classList.add('flash'); clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove('flash'), 1200);
  },
};

/* Branchements sur les modules existants */
(() => {
  const r = Patients.renderDetail.bind(Patients);
  Patients.renderDetail = id => { r(id); Docs.render(id); };
})();
