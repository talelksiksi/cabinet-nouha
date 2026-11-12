/* ═══════════════════════════════════════════
   Espace cabinet — administration
   Utilisateurs (niveaux d'accès par domaine), journal d'activité, sauvegardes & système, mon compte.
   Les actions qui touchent aux clés passent par Secure (js/secure/session.mjs).
   ═══════════════════════════════════════════ */
'use strict';

const Admin = {
  users: [],
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  async render(page) {
    try {
      if (page === 'users') return await this.renderUsers();
      if (page === 'journal') return await this.renderJournal();
      if (page === 'system') return await this.renderSystem();
      if (page === 'account') return this.renderAccount();
      if (page === 'conflicts') return await this.renderConflicts();
    } catch (e) { App.toast(e.message, 'error'); }
  },
  isManager: () => ['admin', 'superadmin'].includes(Secure.user?.kind),
  when: ts => ts ? new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
  ago(ts) { if (!ts) return 'jamais'; const d = Date.now() - ts; if (d < 60e3) return 'à l\'instant'; if (d < 3600e3) return `il y a ${Math.floor(d / 60e3)} min`; if (d < 86400e3) return `il y a ${Math.floor(d / 3600e3)} h`; return `il y a ${Math.floor(d / 86400e3)} j`; },

  /* ══════════ Utilisateurs ══════════ */
  STATUS: { active: ['Actif', 'confirme'], invited: ['Invitation envoyée', 'en-attente'], pending_key: ['En attente d\'accès', 'partiel'], disabled: ['Désactivé', 'absent'] },
  KIND: { superadmin: 'Administrateur informatique', admin: 'Dentiste + administration', staff: 'Personnel' },
  async renderUsers() {
    const el = document.getElementById('page-users');
    const { users } = await Secure.api('GET', '/api/users');
    this.users = users;
    const pending = Secure.hasDataKey ? Secure.pendingAccess : [];
    const levelSummary = u => {
      if (u.kind === 'superadmin') return '<span class="text-muted">Comptes et système, aucun dossier patient</span>';
      if (u.kind === 'admin') return '<span class="text-muted">Tout le cabinet</span>';
      const p = u.perms || {}, mods = Secure.MODULES.filter(m => p[m.key]);
      return mods.length ? mods.map(m => `<span class="perm-chip ${p[m.key]}">${this.esc(m.label.split(/[,:]/)[0])}${p[m.key] === 'view' ? ' (lecture)' : ''}</span>`).join('') + (u.scope === 'own' ? '<span class="perm-chip own">Ses patients uniquement</span>' : '') : '<span class="text-muted">Aucun accès</span>';
    };
    el.innerHTML = `
      <div class="page-header">
        <div><h2>Utilisateurs</h2><p class="page-subtitle">${Secure.isNomad ? 'Comptes gérés au cabinet : depuis ce portable, vos changements sont transmis au PC du cabinet (portable sur le Wi-Fi du cabinet).' : 'Comptes du cabinet et niveaux d\'accès. Les changements s\'appliquent immédiatement côté serveur ; les nouveaux accès apparaissent à la prochaine connexion.'}</p></div>
        <button class="btn-primary" onclick="Admin.editUser()"><i class="fa-solid fa-user-plus"></i> Nouveau compte</button>
      </div>
      ${pending.length ? `<div class="card pending-card"><div class="card-header"><h3><i class="fa-solid fa-key"></i> Accès aux dossiers à autoriser</h3></div><div class="card-body">
        ${pending.map(p => `<div class="pending-row"><div><b>${this.esc(p.displayName)}</b> <span class="text-muted">· ${this.esc(p.username)} · compte créé par ${this.esc(p.createdByName)}</span></div>
          <button class="btn-sm-primary" onclick="Admin.grant('${p.id}')"><i class="fa-solid fa-unlock"></i> Autoriser l'accès</button></div>`).join('')}
        <p class="text-muted" style="font-size:.8rem;margin-top:.5rem">Seul un administrateur qui détient la clé des données peut donner cet accès : l'administrateur informatique ne le peut pas.</p></div></div>` : ''}
      ${Secure.user.kind === 'admin' && !Secure.hasDataKey ? '' : ''}
      <div class="card"><div class="card-body p0"><div class="table-wrap"><table class="data-table users-table">
        <thead><tr><th>Personne</th><th>Type</th><th>Accès</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => {
          const [st, cls] = u.protected && u.status === 'invited' ? ['Code d’activation à utiliser', 'en-attente'] : (this.STATUS[u.status] || [u.status, 'planifie']);
          const me = u.id === Secure.user.id, protectedU = u.protected || (u.kind === 'superadmin' && Secure.user.kind !== 'superadmin');
          return `<tr class="${u.status === 'disabled' ? 'row-disabled' : ''}">
            <td><b>${this.esc(u.displayName)}</b>${me ? ' <span class="perm-chip own">vous</span>' : ''}${u.protected ? ' <span class="perm-chip locked" title="Compte protégé : modifiable uniquement avec l\'outil « comptes protégés » du portable du Dr Nouha"><i class="fa-solid fa-lock"></i> protégé</span>' : ''}<br><small class="text-muted">${this.esc(u.username)}${u.roleLabel ? ' · ' + this.esc(u.roleLabel) : ''}</small></td>
            <td style="font-size:.82rem">${this.KIND[u.kind]}</td>
            <td class="perm-cell">${levelSummary(u)}</td>
            <td><span class="badge badge-${cls}">${st}</span>${u.status === 'invited' && u.inviteExpires ? `<br><small class="text-muted">expire le ${new Date(u.inviteExpires).toLocaleDateString('fr-FR')}</small>` : ''}</td>
            <td style="font-size:.82rem">${this.ago(u.lastLogin)}</td>
            <td><div class="table-actions">
              ${protectedU ? '' : `<button class="icon-btn edit" title="Modifier les accès" onclick="Admin.editUser('${u.id}')"><i class="fa-solid fa-sliders"></i></button>`}
              ${me || protectedU ? '' : `<button class="icon-btn view" title="Nouveau code (mot de passe oublié)" onclick="Admin.resetUser('${u.id}')"><i class="fa-solid fa-key"></i></button>`}
              ${me || protectedU ? '' : u.status === 'disabled'
                ? `<button class="icon-btn view" title="Réactiver" onclick="Admin.enable('${u.id}')"><i class="fa-solid fa-user-check"></i></button>`
                : `<button class="icon-btn del" title="Désactiver" onclick="Admin.disable('${u.id}')"><i class="fa-solid fa-user-slash"></i></button>`}
            </div>${u.protected ? '<small class="text-muted">Mot de passe : « Mon compte »</small>' : ''}</td></tr>`;
        }).join('')}</tbody></table></div></div></div>
      ${users.some(u => u.protected) ? `<p class="text-muted" style="font-size:.8rem;margin-top:.6rem"><i class="fa-solid fa-lock"></i> Les comptes protégés (Dr Nouha, administrateur informatique) ne se modifient pas ici : chacun change son mot de passe dans « Mon compte » ; un mot de passe oublié se réinitialise avec l'outil « comptes protégés » du portable du Dr Nouha.</p>` : ''}`;
    this.renderPendingBanner();
  },

  renderPendingBanner() {
    const n = Secure.hasDataKey ? Secure.pendingAccess.length : 0;
    const b = document.getElementById('nav-badge-users'); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
    const el = document.getElementById('access-banner'); if (!el) return;
    el.classList.toggle('hidden', !n);
    if (n) el.innerHTML = `<i class="fa-solid fa-user-clock"></i><div><b>${n} compte${n > 1 ? 's' : ''} en attente d'accès aux dossiers</b><span>Créé${n > 1 ? 's' : ''} par l'administrateur informatique : à autoriser par vous.</span></div><button class="btn-sm-primary" onclick="App.navigate('users')">Voir</button>`;
  },

  permMatrix(perms = {}) {
    return `<table class="perm-matrix"><thead><tr><th>Domaine</th><th>Aucun</th><th>Lecture</th><th>Modification</th></tr></thead><tbody>
      ${Secure.MODULES.map(m => {
        const cur = perms[m.key] || 'none';
        const cell = lvl => m.levels.includes(lvl) || lvl === 'none' ? `<td><input type="radio" name="perm-${m.key}" value="${lvl}" ${cur === lvl ? 'checked' : ''}/></td>` : '<td class="na">—</td>';
        return `<tr><td>${this.esc(m.label)}</td>${cell('none')}${cell('view')}${cell('edit')}</tr>`;
      }).join('')}</tbody></table>`;
  },
  readMatrix() {
    const out = {};
    for (const m of Secure.MODULES) { const r = document.querySelector(`input[name="perm-${m.key}"]:checked`); if (r && r.value !== 'none') out[m.key] = r.value; }
    return out;
  },
  applyPreset(key) {
    const p = Secure.PRESETS[key]; if (!p) return;
    for (const m of Secure.MODULES) { const r = document.querySelector(`input[name="perm-${m.key}"][value="${p.perms[m.key] || 'none'}"]`); if (r) r.checked = true; }
    document.getElementById('u-scope').checked = p.scope === 'own';
    const role = document.getElementById('u-role'); if (!role.value || Object.values(Secure.PRESETS).some(x => x.roleLabel === role.value)) role.value = p.roleLabel;
  },
  toggleKind() {
    const admin = document.getElementById('u-kind').value === 'admin';
    document.getElementById('u-perms-wrap').classList.toggle('hidden', admin);
  },

  editUser(id) {
    const u = id ? this.users.find(x => x.id === id) : null;
    const presets = Object.entries(Secure.PRESETS).map(([k, p]) => `<button type="button" class="chip" onclick="Admin.applyPreset('${k}')">${this.esc(p.label)}</button>`).join('');
    Plus.modal('modal-user', `<i class="fa-solid fa-user-gear"></i> ${u ? 'Accès de ' + this.esc(u.displayName) : 'Nouveau compte'}`, `
      <div class="form-grid">
        <div class="form-group"><label>Nom affiché *</label><input id="u-name" value="${this.esc(u?.displayName || '')}" placeholder="Ex : Amel Ben Ali"/></div>
        <div class="form-group"><label>Identifiant de connexion *</label><input id="u-username" value="${this.esc(u?.username || '')}" ${u ? 'disabled' : ''} placeholder="ex. amel" autocapitalize="none"/></div>
        <div class="form-group"><label>Type de compte</label><select id="u-kind" onchange="Admin.toggleKind()" ${u?.kind === 'superadmin' ? 'disabled' : ''}>
          <option value="staff" ${u?.kind !== 'admin' ? 'selected' : ''}>Personnel (accès choisis ci-dessous)</option>
          <option value="admin" ${u?.kind === 'admin' ? 'selected' : ''}>Dentiste + administration (tout, comme le Dr Nouha)</option></select></div>
        <div class="form-group"><label>Fonction (affichée)</label><input id="u-role" value="${this.esc(u?.roleLabel || '')}" placeholder="Assistante, Dentiste, Accueil…"/></div>
      </div>
      <div id="u-perms-wrap" class="${u?.kind === 'admin' ? 'hidden' : ''}">
        <div class="preset-row"><span>Modèles :</span>${presets}</div>
        ${this.permMatrix(u?.perms || (u ? {} : Secure.PRESETS.temp.perms))}
        <label class="check-line"><input type="checkbox" id="u-scope" ${u?.scope === 'own' ? 'checked' : ''}/> Uniquement ses propres patients (dentiste associé ou remplaçant)</label>
      </div>
      ${u ? '<p class="text-muted" style="font-size:.8rem;margin-top:.6rem"><i class="fa-solid fa-circle-info"></i> Un accès retiré est coupé immédiatement ; un accès ajouté apparaît à sa prochaine connexion.</p>' : ''}`,
      `<button class="btn-secondary" onclick="App.closeModal('modal-user')">Annuler</button><button class="btn-primary" onclick="Admin.saveUser(${u ? `'${u.id}'` : ''})"><i class="fa-solid fa-save"></i> ${u ? 'Enregistrer' : 'Créer le compte'}</button>`, 'modal-lg');
  },
  async saveUser(id) {
    try {
      const data = { displayName: document.getElementById('u-name').value.trim(), roleLabel: document.getElementById('u-role').value.trim(),
        kind: document.getElementById('u-kind').value, perms: this.readMatrix(), scope: document.getElementById('u-scope')?.checked ? 'own' : 'all' };
      if (id) {
        await Secure.api('PATCH', `/api/users/${id}`, data);
        App.closeModal('modal-user'); App.toast('Accès mis à jour');
      } else {
        data.username = document.getElementById('u-username').value.trim().toLowerCase();
        const r = await Secure.createUser(data);
        App.closeModal('modal-user');
        this.showCode(r.user, r.code, r.withKey);
      }
      this.renderUsers();
    } catch (e) { App.toast(e.message, 'error'); }
  },
  showCode(user, code, withKey) {
    Plus.modal('modal-code', '<i class="fa-solid fa-ticket"></i> Code d\'invitation', `
      <p>À remettre en main propre à <b>${this.esc(user.displayName)}</b> (pas par message). Valable 7 jours, utilisable une seule fois.</p>
      <div class="invite-card" id="invite-card">
        <div><span>Adresse</span><b>https://cabinet-nouha.local</b></div>
        <div><span>Identifiant</span><b>${this.esc(user.username)}</b></div>
        <div><span>Code d'invitation</span><b class="code">${this.esc(code)}</b></div>
        <p>Sur l'écran de connexion : « Première connexion avec un code d'invitation », puis choisir son mot de passe.</p>
      </div>
      <p class="text-muted" style="font-size:.82rem">${withKey ? '<i class="fa-solid fa-unlock"></i> L\'accès aux dossiers est inclus : la personne pourra travailler dès l\'activation.' : '<i class="fa-solid fa-hourglass-half"></i> Créé sans la clé des données : le Dr Nouha devra autoriser l\'accès aux dossiers après l\'activation.'}</p>
      <p class="text-muted" style="font-size:.82rem"><i class="fa-solid fa-eye-slash"></i> Ce code ne sera plus jamais affiché : imprimez-le ou notez-le maintenant.</p>`,
      `<button class="btn-secondary" onclick="Admin.printCode()"><i class="fa-solid fa-print"></i> Imprimer</button><button class="btn-primary" onclick="App.closeModal('modal-code')">J'ai noté le code</button>`);
  },
  printCode() {
    const w = window.open('', '_blank', 'width=600,height=500'); if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Invitation</title><style>body{font-family:Arial;margin:40px}div{margin:10px 0}span{display:block;color:#555;font-size:13px}b{font-size:20px}.code{font-family:Consolas,monospace;letter-spacing:2px}</style>
      <h2>Espace cabinet — invitation</h2>${document.getElementById('invite-card').innerHTML}<script>print()<\/script>`);
    w.document.close();
  },
  async resetUser(id) {
    const u = this.users.find(x => x.id === id);
    App.confirmDelete(`Réinitialiser le compte de ${u.displayName} ? Son mot de passe actuel ne fonctionnera plus ; un nouveau code d'invitation sera créé.`, async () => {
      try { const r = await Secure.resetUser(u); this.showCode(r.user, r.code, r.withKey); this.renderUsers(); } catch (e) { App.toast(e.message, 'error'); }
    });
  },
  async disable(id) {
    const u = this.users.find(x => x.id === id);
    App.confirmDelete(`Désactiver le compte de ${u.displayName} ? Sa session est coupée immédiatement et son accès aux dossiers retiré.`, async () => {
      try { await Secure.api('POST', `/api/users/${id}/disable`); App.toast('Compte désactivé', 'warning'); this.renderUsers(); } catch (e) { App.toast(e.message, 'error'); }
    });
  },
  async enable(id) {
    try { await Secure.api('POST', `/api/users/${id}/enable`); App.toast('Compte réactivé : l\'accès aux dossiers est à autoriser de nouveau.'); await Secure.autoGrant(); this.renderUsers(); } catch (e) { App.toast(e.message, 'error'); }
  },
  async grant(id) {
    const p = Secure.pendingAccess.find(x => x.id === id); if (!p) return;
    try { await Secure.grant(id, p.pubKey); this.renderUsers(); } catch (e) { App.toast(e.message, 'error'); }
  },

  /* ══════════ Journal ══════════ */
  ACTIONS: {
    installation: 'Installation du serveur', connexion: 'Connexion', deconnexion: 'Déconnexion', connexion_refusee: 'Connexion refusée',
    compte_bloque: 'Compte bloqué (trop d\'erreurs)', mot_de_passe_change: 'Mot de passe changé', invitation_acceptee: 'Compte activé',
    compte_cree: 'Compte créé', compte_modifie: 'Accès modifiés', compte_desactive: 'Compte désactivé', compte_reactive: 'Compte réactivé',
    compte_reinitialise: 'Compte réinitialisé', cle_donnees_creee: 'Clé des données créée', cle_secours_remplacee: 'Clé de secours remplacée',
    cle_donnees_recuperee: 'Accès retrouvé (clé de secours)', acces_donnees_autorise: 'Accès aux dossiers autorisé',
    donnee_creee: 'Création', donnee_modifiee: 'Modification', donnee_supprimee: 'Suppression',
    sauvegarde_usb: 'Copie sur clé USB', sauvegarde_manuelle: 'Sauvegarde manuelle', cle_sauvegarde_consultee: 'Clé de sauvegarde consultée',
    portable_code_cree: 'Code d\'association de portable créé', portable_associe: 'Portable associé', portable_retire: 'Portable retiré', conflit_tranche: 'Conflit de synchronisation tranché',
    compte_protege_cree: 'Compte protégé créé (installation)', code_activation_renouvele: 'Code d\'activation renouvelé (installation)',
    compte_protege_reinitialisation_demandee: 'Réinitialisation demandée (outil du portable)', compte_protege_reinitialise: 'Compte protégé réinitialisé (outil du portable)',
    compte_protege_renommage_demande: 'Nouveau nom demandé (outil du portable)', compte_protege_renomme: 'Compte protégé renommé (outil du portable)',
    compte_protege_refuse: 'Demande de l\'outil du portable refusée',
  },
  COLL: { patients: 'patient', appointments: 'rendez-vous', treatments: 'soin', payments: 'facture', documents: 'document', chart: 'schéma dentaire',
    files: 'fichier', labworks: 'travail de laboratoire', labs: 'laboratoire', labpayments: 'règlement labo', tasks: 'tâche', expenses: 'dépense',
    gallery: 'avant / après', requests: 'demande en ligne' },
  async renderJournal(filter = this._jf || '') {
    this._jf = filter;
    const { entries } = await Secure.api('GET', '/api/audit?limit=300');
    const list = entries.filter(e => !filter || (filter === 'security' ? /connexion|compte|cle_|mot_de_passe|acces|installation/.test(e.action) : filter === 'data' ? e.action.startsWith('donnee_') : e.action.startsWith('sauvegarde')));
    document.getElementById('page-journal').innerHTML = `
      <div class="page-header"><div><h2>Journal d'activité</h2><p class="page-subtitle">Qui a fait quoi et quand. Le contenu des dossiers n'y figure jamais.</p></div>
        <select class="select-sm" onchange="Admin.renderJournal(this.value)">
          <option value="" ${!filter ? 'selected' : ''}>Tout</option><option value="security" ${filter === 'security' ? 'selected' : ''}>Connexions et comptes</option>
          <option value="data" ${filter === 'data' ? 'selected' : ''}>Dossiers</option><option value="backup" ${filter === 'backup' ? 'selected' : ''}>Sauvegardes</option></select></div>
      <div class="card"><div class="card-body p0"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Détail</th><th>Appareil</th></tr></thead>
        <tbody>${list.map(e => {
          const [c] = (e.target || '').split('/');
          const what = e.target && e.target.includes('/') ? (this.COLL[c] || c) : (e.targetName && e.targetName !== '—' ? e.targetName : '');
          const bad = /refusee|bloque/.test(e.action);
          return `<tr class="${bad ? 'row-late' : ''}"><td style="white-space:nowrap">${this.when(e.ts)}</td><td>${this.esc(e.username || '—')}</td>
            <td>${bad ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> ' : ''}${this.ACTIONS[e.action] || this.esc(e.action)}${e.origin === 'portable' ? ' <span class="perm-chip own"><i class="fa-solid fa-laptop"></i> portable</span>' : ''}</td>
            <td class="text-muted" style="font-size:.82rem">${this.esc(what)}${e.detail?.raison ? ' · ' + this.esc(e.detail.raison.replace('_', ' ')) : ''}</td>
            <td class="text-muted" style="font-size:.78rem">${this.esc((e.ip || '').replace('::ffff:', ''))}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:1.5rem">Rien pour l\'instant</td></tr>'}</tbody></table></div></div></div>`;
  },

  /* ══════════ Sauvegardes & système ══════════ */
  async renderSystem() {
    const [st, sys] = await Promise.all([Secure.api('GET', '/api/backup/status'), Secure.api('GET', '/api/system')]);
    const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
    const users = sys.users.reduce((s, r) => s + (r.status === 'active' ? r.n : 0), 0);
    const records = sys.records.reduce((s, r) => s + r.n, 0);
    document.getElementById('page-system').innerHTML = `
      <div class="page-header"><div><h2>Sauvegardes & système</h2><p class="page-subtitle">Sauvegardes chiffrées automatiques à ${st.slots.join(' et ')} ; copie sur clé USB chaque mardi.</p></div>
        <button class="btn-primary" onclick="Admin.backupNow()"><i class="fa-solid fa-floppy-disk"></i> Sauvegarder maintenant</button></div>
      <div class="stats-grid">
        <div class="stat-card stat-green"><div class="stat-icon"><i class="fa-solid fa-shield-halved"></i></div><div class="stat-info"><span class="stat-number">${st.last ? this.ago(st.last.ts) : 'aucune'}</span><span class="stat-label">Dernière sauvegarde${st.last ? ' · ' + size(st.last.size) : ''}</span></div></div>
        <div class="stat-card stat-blue"><div class="stat-icon"><i class="fa-regular fa-clock"></i></div><div class="stat-info"><span class="stat-number">${new Date(st.nextAuto).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span><span class="stat-label">Prochaine sauvegarde automatique</span></div></div>
        <div class="stat-card ${st.usbDue ? 'stat-orange' : 'stat-purple'}"><div class="stat-icon"><i class="fa-brands fa-usb"></i></div><div class="stat-info"><span class="stat-number">${st.usb ? this.ago(st.usb.ts) : 'jamais'}</span><span class="stat-label">Dernière copie sur clé USB${st.usbDue ? ' · <b>à faire</b>' : ''}</span></div></div>
        <div class="stat-card stat-blue"><div class="stat-icon"><i class="fa-solid fa-database"></i></div><div class="stat-info"><span class="stat-number">${st.count}</span><span class="stat-label">Sauvegardes conservées sur le PC</span></div></div>
      </div>
      ${await this.nomadSection(sys)}
      ${st.lastFail ? `<div class="usb-banner"><i class="fa-solid fa-triangle-exclamation"></i><div><b>Dernière sauvegarde en échec</b><span>${this.esc(st.lastFail.detail || '')} (${this.when(st.lastFail.ts)})</span></div></div>` : ''}
      <div class="cash-grid">
        <div class="card"><div class="card-header"><h3><i class="fa-brands fa-usb"></i> Copie sur clé USB</h3></div><div class="card-body">
          <p class="text-muted" style="font-size:.88rem">Chaque mardi, branchez la clé de sauvegarde <b>sur le PC du serveur</b>, lancez la copie, puis emportez la clé hors du cabinet (exigence du guide INPDP). La clé garde les 8 dernières semaines.</p>
          <button class="btn-secondary" onclick="Admin.usbModal()"><i class="fa-solid fa-floppy-disk"></i> Copier sur la clé</button></div></div>
        <div class="card"><div class="card-header"><h3><i class="fa-solid fa-server"></i> Système</h3></div><div class="card-body sys-list">
          <div><span>Adresse</span><b>https://${this.esc(sys.server.hostname)}</b></div>
          <div><span>Comptes actifs</span><b>${users}</b></div>
          <div><span>Enregistrements chiffrés</span><b>${records}</b></div>
          <div><span>Sessions ouvertes</span><b>${sys.sessions}</b></div>
          <div><span>Clé des données</span><b>${sys.dataKeyReady ? `créée · ${sys.keyHolders} administrateur${sys.keyHolders > 1 ? 's' : ''} la détien${sys.keyHolders > 1 ? 'nent' : 't'}` : 'pas encore créée'}</b></div>
          <div><span>Serveur démarré</span><b>${this.when(sys.server.started)} · Node ${this.esc(sys.server.node)}</b></div>
          ${Secure.user.kind === 'superadmin' ? `<button class="btn-secondary" style="margin-top:.8rem" onclick="Admin.printBackupKey()"><i class="fa-solid fa-print"></i> Imprimer la clé de sauvegarde</button>` : ''}
        </div></div>
      </div>`;
  },
  async nomadSection(sys) {
    if (Secure.isNomad) {
      const s = sys.sync, ago = s.office.lastSync ? this.ago(s.office.lastSync) : 'jamais';
      return `<div class="card" style="margin-bottom:1rem"><div class="card-header"><h3><i class="fa-solid fa-laptop"></i> Portable du Dr Nouha — synchronisation avec le cabinet</h3>
        <button class="btn-sm-primary" onclick="Admin.syncNow(this)"><i class="fa-solid fa-rotate"></i> Synchroniser maintenant</button></div><div class="card-body sys-list">
        <div><span>Cabinet</span><b>${s.office.reachable ? '<span style="color:var(--success)">joignable</span>' : 'hors de portée (portable hors du cabinet)'}</b></div>
        <div><span>Dernière synchronisation</span><b>${ago}</b></div>
        <div><span>Modifications en attente d'envoi</span><b>${s.pending}</b></div>
        <div><span>Conflits à trancher</span><b>${s.conflicts ? `<a class="link" onclick="App.navigate('conflicts')">${s.conflicts}</a>` : '0'}</b></div>
        ${s.office.lastError && !s.office.reachable ? `<div><span>Dernier message</span><b style="font-weight:500">${this.esc(s.office.lastError)}</b></div>` : ''}
        <p class="text-muted" style="font-size:.82rem;margin-top:.6rem">La synchronisation est automatique (chaque minute) dès que le portable est sur le Wi-Fi du cabinet avec le PC du cabinet allumé.</p></div></div>`;
    }
    let nodes = [];
    try { nodes = (await Secure.api('GET', '/api/sync/nodes')).nodes; } catch {}
    return `<div class="card" style="margin-bottom:1rem"><div class="card-header"><h3><i class="fa-solid fa-laptop"></i> Portables associés</h3>
      <button class="btn-sm-primary" onclick="Admin.pairCode()"><i class="fa-solid fa-link"></i> Associer un portable</button></div><div class="card-body">
      ${nodes.length ? nodes.map(n => `<div class="pending-row"><div><b>${this.esc(n.name)}</b> <span class="text-muted">· associé le ${new Date(n.createdAt).toLocaleDateString('fr-FR')} · dernière synchronisation : ${n.lastSeen ? this.ago(n.lastSeen) : 'jamais'}</span>${n.revoked ? ' <span class="badge badge-absent">retiré</span>' : ''}</div>
        ${n.revoked ? '' : `<button class="btn-secondary btn-xs" onclick="Admin.revokeNode('${n.id}')"><i class="fa-solid fa-link-slash"></i> Retirer</button>`}</div>`).join('')
        : '<p class="text-muted" style="font-size:.88rem">Aucun. Le portable du Dr Nouha, une fois associé, garde une copie complète et se synchronise dès qu\'il est sur le Wi-Fi du cabinet.</p>'}
      </div></div>`;
  },
  async pairCode() {
    try {
      const r = await Secure.api('POST', '/api/sync/pairing-code');
      Plus.modal('modal-pair', '<i class="fa-solid fa-link"></i> Associer un portable', `
        <p>Sur le portable (installé avec le paquet <b>Install-Package-Owner</b> et branché sur le Wi-Fi du cabinet), ouvrez l'Espace cabinet et saisissez :</p>
        <div class="invite-card"><div><span>Code d'association</span><b class="code">${this.esc(r.code)}</b></div><p>Valable 15 minutes, une seule fois.</p></div>`,
        `<button class="btn-primary" onclick="App.closeModal('modal-pair');Admin.renderSystem()">Terminé</button>`);
    } catch (e) { App.toast(e.message, 'error'); }
  },
  revokeNode(id) {
    App.confirmDelete('Retirer ce portable ? Il ne pourra plus se synchroniser (perte, vol, remplacement). Il faudra l\'associer de nouveau pour le réutiliser.', async () => {
      try { await Secure.api('POST', `/api/sync/nodes/${id}/revoke`); App.toast('Portable retiré', 'warning'); this.renderSystem(); } catch (e) { App.toast(e.message, 'error'); }
    });
  },
  async syncNow(btn) {
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronisation…';
    const r = await Secure.api('POST', '/api/sync/now').catch(e => ({ ok: false, error: e.message }));
    App.toast(r.ok ? `Synchronisé : ${r.sent} envoyée${r.sent > 1 ? 's' : ''}, ${r.received} reçue${r.received > 1 ? 's' : ''}` : r.error, r.ok ? 'success' : 'warning');
    await Secure.refreshNomad(); App.refreshCurrent(); this.renderSystem();
  },

  /* ══════════ Conflits (portable) ══════════ */
  FIELD: { firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', email: 'E-mail', address: 'Adresse', dob: 'Naissance', allergies: 'Allergies', medications: 'Traitements',
    conditions: 'Antécédents', notes: 'Notes', date: 'Date', time: 'Heure', status: 'Statut', service: 'Soin', procedure: 'Acte', cost: 'Coût', paidAmount: 'Versé',
    description: 'Description', followup: 'Suivi', duration: 'Durée', title: 'Titre', label: 'Libellé', amount: 'Montant', dentistId: 'Dentiste', teeth: 'Dents' },
  async renderConflicts() {
    const el = document.getElementById('page-conflicts');
    const { conflicts } = await Secure.api('GET', '/api/sync/conflicts');
    const show = v => v == null || v === '' ? '<span class="text-muted">—</span>' : this.esc(typeof v === 'object' ? JSON.stringify(v) : v);
    const cards = [];
    for (const c of conflicts) {
      const local = c.local.deleted ? null : await Secure.decrypt(c.c, c.id, c.local);
      const office = c.office.deleted || !c.office.data ? null : await Secure.decrypt(c.c, c.id, c.office);
      const ref = local || office || {};
      const title = c.c === 'patients' ? `${ref.firstName || ''} ${ref.lastName || ''}` : `${this.COLL[c.c] || c.c}${ref.patientId ? ' · ' + Utils.patientName(ref.patientId) : ''}${ref.date ? ' · ' + Utils.formatDate(ref.date) : ''}`;
      const keys = [...new Set([...Object.keys(local || {}), ...Object.keys(office || {})])].filter(k => k !== 'id' && JSON.stringify((local || {})[k]) !== JSON.stringify((office || {})[k]));
      const rows = !local ? '<tr><td colspan="3"><b>Supprimé sur le portable</b>, modifié au cabinet.</td></tr>'
        : !office ? '<tr><td colspan="3"><b>Supprimé au cabinet</b>, modifié sur le portable.</td></tr>'
        : keys.map(k => `<tr><td>${this.FIELD[k] || this.esc(k)}</td><td>${show(local[k])}</td><td>${show(office[k])}</td></tr>`).join('');
      cards.push(`<div class="card conflict-card"><div class="card-header"><h3><i class="fa-solid fa-code-compare"></i> ${this.esc(title.trim() || c.c)}</h3><span class="text-muted" style="font-size:.8rem">${this.esc(this.COLL[c.c] || c.c)}</span></div><div class="card-body">
        <table class="data-table conflict-table"><thead><tr><th>Champ</th><th><i class="fa-solid fa-laptop"></i> Sur ce portable</th><th><i class="fa-solid fa-building"></i> Au cabinet</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="conflict-actions"><button class="btn-primary" onclick="Admin.resolve('${c.c}','${c.id}','local')"><i class="fa-solid fa-laptop"></i> Garder la version du portable</button>
        <button class="btn-secondary" onclick="Admin.resolve('${c.c}','${c.id}','office')"><i class="fa-solid fa-building"></i> Garder la version du cabinet</button></div></div></div>`);
    }
    el.innerHTML = `<div class="page-header"><div><h2>Conflits à trancher</h2><p class="page-subtitle">Ces dossiers ont été modifiés à la fois sur ce portable et au cabinet. Rien n'a été écrasé : choisissez la bonne version.</p></div></div>
      ${cards.join('') || '<div class="empty-state"><i class="fa-solid fa-circle-check"></i><h3>Aucun conflit</h3><p>Tout est synchronisé.</p></div>'}`;
  },
  async resolve(c, id, keep) {
    try {
      await Secure.api('POST', '/api/sync/resolve', { c, id, keep });
      App.toast(keep === 'local' ? 'Version du portable gardée : envoyée au cabinet' : 'Version du cabinet gardée');
      await Secure.refreshNomad(); this.renderConflicts(); App.refreshCurrent();
    } catch (e) { App.toast(e.message, 'error'); }
  },

  async backupNow() {
    try { const r = await Secure.api('POST', '/api/backup/now'); App.toast(`Sauvegarde faite (${Math.round(r.size / 1024)} Ko)`); this.renderSystem(); }
    catch (e) { App.toast(e.message, 'error'); }
  },
  async printBackupKey() {
    try { const r = await Secure.api('GET', '/api/system/backup-key'); Secure.printRecovery(r.backupKey, 'sauvegarde'); } catch (e) { App.toast(e.message, 'error'); }
  },
  async usbModal() {
    Plus.modal('modal-usb', '<i class="fa-brands fa-usb"></i> Copie sur la clé USB', '<p><i class="fa-solid fa-spinner fa-spin"></i> Recherche des clés USB branchées sur le PC du serveur…</p>', '<button class="btn-secondary" onclick="App.closeModal(\'modal-usb\')">Fermer</button>');
    try {
      const { drives } = await Secure.api('GET', '/api/backup/drives');
      const body = drives.length
        ? `<p>Clé${drives.length > 1 ? 's' : ''} détectée${drives.length > 1 ? 's' : ''} sur le PC du serveur :</p>${drives.map(d => `<label class="drive-row"><input type="radio" name="usb-drive" value="${d.drive}" ${drives.length === 1 ? 'checked' : ''}/> <b>${d.drive}</b> ${this.esc(d.label || 'Clé USB')} <span class="text-muted">· ${Math.round(d.free / 1073741824 * 10) / 10} Go libres</span></label>`).join('')}
           <p class="text-muted" style="font-size:.82rem;margin-top:.6rem">La sauvegarde est chiffrée : sans la clé de sauvegarde, la clé USB est illisible si elle est perdue.</p>`
        : '<p><i class="fa-solid fa-circle-info"></i> Aucune clé USB détectée. Branchez la clé <b>sur le PC du serveur</b> (le PC de l\'assistante), attendez quelques secondes, puis réessayez.</p>';
      Plus.modal('modal-usb', '<i class="fa-brands fa-usb"></i> Copie sur la clé USB', body,
        drives.length ? `<button class="btn-secondary" onclick="App.closeModal('modal-usb')">Annuler</button><button class="btn-primary" id="usb-go" onclick="Admin.usbCopy()"><i class="fa-solid fa-floppy-disk"></i> Copier</button>`
          : `<button class="btn-secondary" onclick="App.closeModal('modal-usb')">Fermer</button><button class="btn-primary" onclick="Admin.usbModal()"><i class="fa-solid fa-rotate"></i> Réessayer</button>`);
    } catch (e) { App.toast(e.message, 'error'); }
  },
  async usbCopy() {
    const d = document.querySelector('input[name="usb-drive"]:checked'); if (!d) return App.toast('Choisissez la clé', 'error');
    const b = document.getElementById('usb-go'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copie et vérification…';
    try {
      const r = await Secure.api('POST', '/api/backup/usb', { drive: d.value });
      Plus.modal('modal-usb', '<i class="fa-solid fa-circle-check"></i> Copie terminée', `<p>Sauvegarde copiée et vérifiée sur <b>${r.drive}</b> (${Math.round(r.size / 1024)} Ko).</p><p><b>Retirez la clé et emportez-la hors du cabinet</b> jusqu'à mardi prochain.</p>`,
        '<button class="btn-primary" onclick="App.closeModal(\'modal-usb\')">C\'est fait</button>');
      Secure.refreshBackupBanner();
      if (App.currentPage === 'system') this.renderSystem();
    } catch (e) { b.disabled = false; b.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Copier'; App.toast(e.message, 'error'); }
  },

  /* ══════════ Mon compte ══════════ */
  renderAccount() {
    const u = Secure.user;
    const age = u.passwordAge != null ? Math.floor(u.passwordAge / 86400e3) : null;
    document.getElementById('page-account').innerHTML = `
      <div class="page-header"><div><h2>Mon compte</h2><p class="page-subtitle">${this.esc(u.displayName)} · ${this.esc(u.username)} · ${this.KIND[u.kind]}</p></div></div>
      <div class="cash-grid">
        <div class="card"><div class="card-header"><h3><i class="fa-solid fa-key"></i> Changer mon mot de passe</h3></div><div class="card-body">
          <div class="form-group"><label>Mot de passe actuel</label><input type="password" id="ac-cur" autocomplete="current-password"/></div>
          <div class="form-group"><label>Nouveau mot de passe</label><input type="password" id="ac-new" autocomplete="new-password" oninput="Admin.pwHint()"/></div>
          <div class="form-group"><label>Confirmer</label><input type="password" id="ac-new2" autocomplete="new-password"/></div>
          <ul class="pw-rules" id="ac-rules"></ul>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn-secondary" onclick="Admin.suggestPw()"><i class="fa-solid fa-wand-magic-sparkles"></i> Proposer</button>
          <button class="btn-primary" onclick="Admin.savePw()"><i class="fa-solid fa-save"></i> Enregistrer</button></div>
          <p class="text-muted" style="font-size:.8rem;margin-top:.6rem">${age != null ? `Mot de passe changé il y a ${age} jour${age > 1 ? 's' : ''}. ` : ''}Renouvellement demandé tous les 6 mois.</p>
        </div></div>
        <div class="card"><div class="card-header"><h3><i class="fa-solid fa-shield-halved"></i> Sécurité</h3></div><div class="card-body sys-list">
          <div><span>Accès aux dossiers</span><b>${u.kind === 'superadmin' ? 'Aucun (administrateur informatique)' : Secure.hasDataKey ? 'Déchiffrés sur cet appareil uniquement' : 'En attente'}</b></div>
          ${u.kind === 'admin' && Secure.hasDataKey ? `<div><span>Feuille de secours</span><b><button class="btn-sm-primary" onclick="Admin.newRecoverySheet()"><i class="fa-solid fa-print"></i> Imprimer une nouvelle feuille</button></b></div>` : ''}
          ${u.protected ? `<div><span>Compte protégé</span><b>Nom, type et accès fixes ; oubli du mot de passe : outil du portable du Dr Nouha</b></div>` : ''}
          <div><span>Verrouillage automatique</span><b>après 30 minutes sans activité</b></div>
          <div><span>Je m'absente</span><b><button class="btn-sm-primary" onclick="Secure.lock()"><i class="fa-solid fa-lock"></i> Verrouiller maintenant</button></b></div>
        </div></div>
      </div>`;
    this.pwHint();
  },
  newRecoverySheet() {
    App.confirmDelete('Imprimer une NOUVELLE feuille de secours ? L’ancienne feuille ne fonctionnera plus : détruisez-la et rangez la nouvelle à sa place.', async () => {
      try { await Secure.newRecoverySheet(); App.toast('Nouvelle feuille de secours créée : imprimez-la et rangez-la en lieu sûr.', 'success'); }
      catch (e) { App.toast(e.message, 'error'); }
    });
  },
  pwHint() {
    const pw = document.getElementById('ac-new')?.value || '', r = Secure.checkPassword(pw, Secure.user.username);
    const el = document.getElementById('ac-rules'); if (!el) return;
    el.innerHTML = pw ? (r.ok ? '<li class="ok"><i class="fa-solid fa-check"></i> Mot de passe solide</li>' : r.issues.map(x => `<li class="bad"><i class="fa-solid fa-xmark"></i> ${x}</li>`).join('')) : '<li><i class="fa-solid fa-circle"></i> 12 caractères minimum, majuscules, minuscules, chiffres et symboles</li>';
  },
  suggestPw() {
    const g = Secure.generatePassword();
    for (const id of ['ac-new', 'ac-new2']) { const e = document.getElementById(id); e.value = g; e.type = 'text'; }
    this.pwHint(); App.toast('Notez ce mot de passe avant d\'enregistrer.', 'info');
  },
  async savePw() {
    const cur = document.getElementById('ac-cur').value, n = document.getElementById('ac-new').value, n2 = document.getElementById('ac-new2').value;
    const r = Secure.checkPassword(n, Secure.user.username);
    if (!r.ok) return App.toast('Mot de passe trop faible : ' + r.issues.join(', '), 'error');
    if (n !== n2) return App.toast('Les deux mots de passe diffèrent', 'error');
    try { await Secure.changePassword(cur, n); App.toast('Mot de passe changé. Les autres appareils sont déconnectés.'); this.renderAccount(); }
    catch (e) { App.toast(e.message, 'error'); }
  },
};
