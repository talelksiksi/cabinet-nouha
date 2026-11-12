/* Données de démonstration (100 % fictives) au format de l'application : un cabinet animé, calculé par rapport à « maintenant ». */

export function buildDataset({ nouha, remp, now = new Date() }) {
  let seed = 20261112;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pad = n => String(n).padStart(2, '0');
  const day = off => { const d = new Date(now); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const isoAgo = min => new Date(now.getTime() - min * 60e3).toISOString();
  let nid = 1000;
  const id = () => ++nid;

  const F = ['Amira', 'Sofiene', 'Yosra', 'Noureddine', 'Rania', 'Tarek', 'Hela', 'Mohamed Ali', 'Salwa', 'Karim', 'Ines', 'Walid', 'Mariem', 'Hamza', 'Olfa', 'Bilel', 'Nadia', 'Aymen', 'Sonia', 'Mehdi', 'Rim', 'Slim', 'Asma', 'Zied', 'Leila', 'Fares', 'Emna', 'Hichem', 'Imen', 'Anis', 'Chaima', 'Nizar', 'Wafa', 'Mourad', 'Sarra', 'Ridha', 'Houda', 'Lotfi', 'Amal', 'Khaled', 'Dorra', 'Sami', 'Hajer', 'Oussama', 'Najet'];
  const L = ['Ben Salah', 'Hammami', 'Chaabane', 'Ayari', 'Mejri', 'Zouari', 'Ferchichi', 'Ben Youssef', 'Gharsalli', 'Trabelsi', 'Jebali', 'Mansouri', 'Haddad', 'Gharbi', 'Ben Ammar', 'Sassi', 'Dridi', 'Khelifi', 'Bouazizi', 'Riahi', 'Mzoughi', 'Hamdi', 'Jlassi', 'Ouni', 'Belhadj', 'Chebbi', 'Toumi', 'Karoui', 'Saidi', 'Ghanmi'];
  const CITIES = ['Médenine', 'Médenine', 'Médenine', 'Djerba Houmt Souk', 'Djerba Midoun', 'Zarzis', 'Ben Guerdane', 'Tataouine', 'Beni Khedache'];
  const STREETS = ['Rue de Gabès', 'Avenue Habib Bourguiba', 'Rue de Djerba', 'Cité El Amel', 'Rue Ibn Khaldoun', 'Avenue de la République', 'Cité Ennasr', 'Rue de Tataouine'];
  const ALLERG = ['Aucune', 'Aucune', 'Aucune', 'Aucune', 'Pénicilline', 'Latex', 'Aspirine', 'Codéine', 'Iode'];
  const MEDS = ['Aucun', 'Aucun', 'Aucun', 'Metformine', 'Lisinopril 10 mg', 'Warfarine', 'Lévothyrox', 'Aspirine 100 mg', 'Atorvastatine'];
  const COND = ['Aucune', 'Aucune', 'Aucune', 'Diabète type 2', 'Hypertension', 'Hypothyroïdie', 'Asthme', 'Cardiopathie', 'Grossesse (2e trimestre)'];
  const JOBS = ['Enseignante', 'Commerçant', 'Ingénieur', 'Infirmière', 'Retraité', 'Étudiante', 'Agriculteur', 'Comptable', 'Pharmacienne', 'Chauffeur', 'Fonctionnaire', 'Artisan'];

  /* ── Actes et tarifs (codes CNAM laissés vides : c'est au cabinet de les saisir) ── */
  const ACTS = [['Consultation', 40], ['Bilan & Détartrage', 60], ['Détartrage & Polissage', 70], ['Obturation composite', 80], ['Obturation amalgame', 60],
    ['Traitement canalaire', 250], ['Pulpotomie', 90], ['Extraction dentaire', 50], ['Extraction chirurgicale', 90], ['Extraction dent de sagesse', 150],
    ['Radiographie', 20], ['Traitement des gencives (Gingivectomie)', 120], ['Préparation de couronne', 150], ['Pose de couronne', 450], ['Couronne zircone', 650],
    ['Pose de bridge', 1200], ['Pose de facettes', 600], ['Inlay / onlay', 350], ['Prothèse complète', 900], ['Prothèse partielle', 600],
    ['Prothèse sur 2 implants', 2800], ['Implant dentaire', 1800], ['Greffe osseuse', 700], ['Blanchiment dentaire', 400], ['Gouttière de protection nocturne', 150], ['Traitement d\'urgence', 50]];
  const price = n => (ACTS.find(a => a[0] === n) || [0, 60])[1];
  const PROTH = /couronne|bridge|proth|facette|inlay|onlay|implant|gouttière/i;

  /* ── Patients ── */
  const patients = [];
  for (let i = 0; i < 46; i++) {
    const g = i % 2 ? 'Masculin' : 'Féminin';
    const first = F[i % F.length], last = L[(i * 7) % L.length];
    const age = int(8, 82);
    const city = pick(CITIES);
    const p = {
      id: id(), firstName: first, lastName: last, dob: `${now.getFullYear() - age}-${pad(int(1, 12))}-${pad(int(1, 28))}`, gender: g,
      phone: `+216 ${pick(['2', '5', '9', '4'])}${int(0, 9)} ${int(100, 999)} ${int(100, 999)}`, cin: age >= 18 ? String(int(10000000, 15999999)).padStart(8, '0') : '',
      email: rnd() < .4 ? `${first.toLowerCase().replace(/\s/g, '')}.${last.toLowerCase().replace(/\s/g, '')}@exemple.tn` : '',
      address: `${int(1, 120)} ${pick(STREETS)}, ${city}`, bloodType: pick(['A+', 'O+', 'B+', 'AB+', 'A-', 'O-', '']), occupation: age < 20 ? 'Élève' : pick(JOBS),
      referredBy: rnd() < .25 ? 'Bouche-à-oreille' : '', patientSince: day(-int(20, 900)), allergies: pick(ALLERG), medications: pick(MEDS), conditions: pick(COND),
      dentalHistory: pick(['Aucun antécédent notable', 'Deux obturations anciennes', 'Extraction 46 il y a 5 ans', 'Appareil orthodontique adolescent', 'Prothèse partielle haute', 'Traitement canalaire 36']),
      smoker: rnd() < .2 ? 'Oui' : 'Non', lastVisit: '', notes: rnd() < .2 ? pick(['Préfère les rendez-vous le matin.', 'Anxiété dentaire : rassurer.', 'Vient de Djerba : regrouper les séances.', 'Parle surtout arabe.']) : '',
      emergencyName: `${pick(F)} ${last}`, emergencyPhone: `+216 ${int(20, 99)} ${int(100, 999)} ${int(100, 999)}`, emergencyRelation: pick(['Époux', 'Épouse', 'Mère', 'Père', 'Fils', 'Fille', 'Frère']), emergencyEmail: '',
      createdAt: isoAgo(int(60, 900) * 1440),
    };
    if (p.medications === 'Warfarine') p.notes = 'Sous anticoagulant : vérifier l\'INR avant tout acte sanglant.';
    patients.push(p);
  }
  // une patiente avec son identité CNAM (pour montrer le bulletin pré-rempli)
  patients[1].cnam = { id: '0784123600', regime: 'CNSS', first: patients[1].firstName, last: patients[1].lastName, address: patients[1].address, cp: '4100', relation: 'Assuré social' };

  /* ── Rendez-vous et soins sur 3 semaines + 2 semaines à venir ── */
  const SERVICES = ['Consultation', 'Bilan & Détartrage', 'Obturation composite', 'Traitement canalaire', 'Extraction dentaire', 'Pose de couronne', 'Préparation de couronne', 'Détartrage & Polissage', 'Implant dentaire', 'Pose de facettes', 'Prothèse partielle', 'Extraction chirurgicale', 'Radiographie'];
  const DUR = { 'Consultation': 30, 'Bilan & Détartrage': 30, 'Obturation composite': 45, 'Traitement canalaire': 60, 'Extraction dentaire': 30, 'Pose de couronne': 45, 'Préparation de couronne': 60, 'Détartrage & Polissage': 30, 'Implant dentaire': 90, 'Pose de facettes': 60, 'Prothèse partielle': 45, 'Extraction chirurgicale': 60, 'Radiographie': 15 };
  const TEETH = ['11', '12', '14', '16', '21', '24', '26', '36', '37', '46', '47', '45', '35', '38', '48'];
  const appointments = [], treatments = [], payments = [];
  const remPatients = new Set(patients.slice(30, 38).map(p => p.id));          // patients suivis par le remplaçant
  const slotTimes = ['08:30', '09:00', '09:45', '10:30', '11:15', '12:00', '13:30', '14:15', '15:00'];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let invoice = 0;
  for (let off = -21; off <= 14; off++) {
    const d = new Date(now); d.setDate(d.getDate() + off);
    if (d.getDay() === 0) continue;                                               // dimanche fermé
    const times = d.getDay() === 6 ? slotTimes.slice(0, 5) : slotTimes;
    for (const t of times) {
      if (off !== 0 && rnd() < .25) continue;
      const pat = off === 0 ? patients[times.indexOf(t) + 3] : pick(patients);
      const dentist = remPatients.has(pat.id) ? remp : nouha;
      const service = pick(SERVICES);
      const a = { id: id(), patientId: pat.id, dentistId: dentist, date: day(off), time: t, duration: DUR[service] || 30, service, status: 'Planifié', notes: '', reminder: '1day', createdAt: isoAgo(int(2, 20) * 1440) };
      const [hh, mm] = t.split(':').map(Number), start = hh * 60 + mm;
      if (off < 0) a.status = rnd() < .08 ? 'Absent' : 'Terminé';
      else if (off === 0) {
        if (start + a.duration + 10 < nowMin) Object.assign(a, { status: 'Terminé', arrivedAt: isoAgo(nowMin - start + 12), startedAt: isoAgo(nowMin - start - 3), endedAt: isoAgo(nowMin - start - a.duration + 2) });
        else if (start <= nowMin) Object.assign(a, { status: 'En cours', arrivedAt: isoAgo(nowMin - start + 14), startedAt: isoAgo(Math.max(1, nowMin - start)) });
        else if (start - nowMin < 50) Object.assign(a, { status: 'En salle', arrivedAt: isoAgo(int(4, 18)) });
        else a.status = rnd() < .6 ? 'Confirmé' : 'Planifié';
      } else a.status = rnd() < .5 ? 'Confirmé' : 'Planifié';
      if (a.status === 'Absent') a.notes = 'Ne s\'est pas présenté(e)';
      appointments.push(a);
      if (a.status === 'Terminé') {
        const tooth = pick(TEETH), cost = price(service);
        treatments.push({ id: id(), patientId: pat.id, dentistId: dentist, date: a.date, teeth: service.includes('Détartrage') || service === 'Consultation' || service === 'Radiographie' ? [] : [tooth],
          procedure: service, description: service === 'Consultation' ? 'Examen clinique, plan de traitement expliqué' : `${service}${service.includes('Détartrage') ? '' : ' sur la ' + tooth}`,
          notes: pick(['Bien toléré.', 'Patient coopérant.', 'Contrôle dans 15 jours.', 'Sensibilité post-opératoire possible, expliquée.', '']),
          followup: pick(['Bains de bouche 7 jours.', 'Éviter les aliments durs 24 h.', 'Revoir à la prochaine séance.', 'Brossage doux 3 jours.', '']), cost, status: 'Terminé', createdAt: a.endedAt || `${a.date}T12:00:00.000Z` });
        if (pat.lastVisit < a.date) pat.lastVisit = a.date;
        if (rnd() < .85) {
          const paid = rnd() < .75 ? cost : rnd() < .5 ? Math.round(cost / 2) : 0;
          payments.push({ id: id(), patientId: pat.id, date: a.date, dueDate: paid < cost ? day(off + 30) : '', method: pick(['Espèces', 'Espèces', 'Espèces', 'Chèque', 'CNAM / Assurance', 'Carte de débit']),
            status: paid >= cost ? 'Payé' : paid > 0 ? 'Partiel' : 'En attente', paidAmount: paid, discount: 0, notes: '', invoiceNumber: `FAC-${now.getFullYear()}-${String(++invoice).padStart(4, '0')}`,
            items: [{ description: service, amount: cost }], createdAt: a.endedAt || `${a.date}T12:30:00.000Z` });
        }
      }
    }
  }
  // un patient sans rendez-vous, arrivé pour une urgence
  appointments.push({ id: id(), patientId: patients[40].id, dentistId: nouha, date: day(0), time: `${pad(Math.min(15, Math.max(8, now.getHours())))}:${pad(Math.floor(now.getMinutes() / 15) * 15)}`, duration: 30, service: 'Traitement d\'urgence', status: 'En salle', notes: 'Sans rendez-vous : douleur 46', reminder: 'none', arrivedAt: isoAgo(7), createdAt: isoAgo(7) });

  /* ── Schéma dentaire ── */
  const chart = {};
  for (const tr of treatments) for (const t of tr.teeth) {
    const st = /canalaire|Pulpotomie/.test(tr.procedure) ? 'root-canal' : /couronne|Couronne|facettes/.test(tr.procedure) ? 'crown' : /Extraction/.test(tr.procedure) ? 'extracted' : /Implant/.test(tr.procedure) ? 'implant' : /Obturation/.test(tr.procedure) ? 'filled' : null;
    if (st) (chart[tr.patientId] ||= {})[t] = { state: st, note: '' };
  }
  for (const p of patients.slice(0, 20)) if (rnd() < .5) (chart[p.id] ||= {})[pick(['17', '27', '37', '47', '15', '25'])] = { state: 'caries', note: 'À traiter au prochain rendez-vous.' };

  /* ── Laboratoire ── */
  const labs = [{ id: id(), name: 'Laboratoire Errahma', contact: 'Hatem', phone: '+216 75 640 210', city: 'Médenine' }, { id: id(), name: 'Sud Céramique', contact: 'Mourad', phone: '+216 75 650 330', city: 'Djerba' }];
  const labworks = [], labpayments = [];
  const LTYPES = [['Couronne céramo-métallique', 120], ['Couronne zircone', 180], ['Bridge 3 éléments', 390], ['Prothèse partielle amovible', 260], ['Facette céramique', 150], ['Prothèse sur 2 implants', 520]];
  const lst = ['Posé', 'Posé', 'Livré', 'Essayage', 'Envoyé', 'Envoyé', 'Envoyé', 'Livré', 'Posé', 'Essayage'];
  lst.forEach((status, i) => {
    const [type, pr] = pick(LTYPES), p = patients[(i * 5 + 2) % patients.length];
    const sent = -int(2, 25), due = sent + int(6, 12);
    labworks.push({ id: id(), patientId: p.id, labId: labs[i % 2].id, type, teeth: pick(['46', '36', '11-21', '14', '24-25-26', '45']), shade: pick(['A2', 'A3', 'B1', 'A1']),
      sentDate: day(sent), dueDate: day(i === 4 ? -1 : due), deliveredDate: ['Livré', 'Posé'].includes(status) ? day(Math.min(-1, due)) : '', price: pr, status, notes: i === 4 ? 'Patient pressé : relancer le labo' : '' });
  });
  labpayments.push({ id: id(), labId: labs[0].id, date: day(-12), amount: 300, method: 'Espèces' });

  /* ── Tâches, dépenses ── */
  const tasks = [
    ['Relancer Sud Céramique : bridge en retard', 0, 'Urgente', 'Assistante', false], ['Commander gants, compresses et fil de suture', 0, 'Élevée', 'Assistante', false],
    ['Test hebdomadaire de l\'autoclave', 1, 'Moyenne', 'Assistante', false], ['Payer la facture STEG', 2, 'Moyenne', 'Assistante', false],
    ['Rappeler les patients absents de la semaine', -1, 'Élevée', 'Assistante', false], ['Préparer le plan de traitement implantaire', 3, 'Élevée', 'Dentiste', false],
    ['Renouveler l\'assurance responsabilité civile', 12, 'Faible', 'Dentiste', false], ['Commander composite A2 et A3', -2, 'Moyenne', 'Assistante', true],
  ].map(([title, d, priority, assignee, done]) => ({ id: id(), title, due: day(d), priority, assignee, done }));
  const m1 = day(0).slice(0, 8) + '01';
  const expenses = [
    [m1, 'Loyer', 'Loyer du cabinet', 900, 'Chèque', '4521087'], [day(-12), 'Salaires', 'Salaire assistante', 1100, 'Virement', ''], [day(-12), 'Laboratoire', 'Règlement Laboratoire Errahma', 300, 'Espèces', ''],
    [day(-6), 'Factures', 'STEG (électricité)', 87.4, 'Espèces', ''], [day(-5), 'Fournitures', 'Composite, anesthésiques', 320, 'Chèque', '4521088'], [day(-3), 'Factures', 'SONEDE (eau)', 32.8, 'Espèces', ''],
    [day(-1), 'Matériel', 'Embouts d\'aspiration, fraises', 145.5, 'Espèces', ''], [day(0), 'Fournitures', 'Gants et masques', 45.5, 'Espèces', ''],
  ].map(([date, category, label, amount, method, chequeNo]) => ({ id: id(), date, category, label, amount, method, chequeNo }));

  /* ── Documents, demandes en ligne, avant / après ── */
  const documents = [{ id: id(), patientId: patients[3].id, type: 'ordonnance', date: day(-6), lines: [
    { med: 'Amoxicilline 1 g', dose: '1 comprimé matin et soir', dur: '7 jours' }, { med: 'Paracétamol 1 g', dose: '1 comprimé si douleur, max 3 par jour', dur: '3 jours' },
    { med: 'Chlorhexidine 0,12 % bain de bouche', dose: '2 fois par jour après brossage', dur: '7 jours' }] },
  { id: id(), patientId: patients[6].id, type: 'certificat', date: day(-2), kind: 'repos', days: 2, text: 'Suite à une extraction chirurgicale.' }];
  const requests = [
    { id: id(), name: 'Salwa Gharsalli', phone: '+216 97 220 118', motif: '', day: day(0), moment: 'Après-midi', message: '', status: 'Nouvelle', createdAt: isoAgo(35) },
    { id: id(), name: 'Mohamed Ali Ben Youssef', phone: '+216 22 410 552', motif: '', day: day(2), moment: 'Matin', message: 'Plutôt en fin de matinée', status: 'Nouvelle', createdAt: isoAgo(130) },
  ];
  const svg = (after, n) => {
    const teeth = [...Array(6)].map((_, i) => {
      const x = 40 + i * 54, gap = !after && n === 2 && i === 2 ? 14 : 0, miss = !after && n === 1 && i === 4;
      const h = after ? 92 : 80 + ((i * 7) % 14), col = after ? '#fbfaf5' : ['#e9dcae', '#e3d29b', '#eadfb6'][i % 3];
      return miss ? '' : `<rect x="${x + gap}" y="${110 - h / 2}" width="48" height="${h}" rx="14" fill="${col}" stroke="#d8cfb8" stroke-width="1.5"/>`;
    }).join('');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><rect width="400" height="220" fill="#3b1d24"/><rect y="40" width="400" height="140" rx="60" fill="#c96b7a"/>${teeth}<text x="200" y="208" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="12" opacity=".7">illustration de démonstration</text></svg>`);
  };
  const gallery = [
    { id: id(), patientId: patients[5].id, title: 'Couronne céramique sur 46', treatment: 'Prothèse fixe', date: day(-9), before: svg(false, 1), after: svg(true, 1), consent: true, published: true },
    { id: id(), patientId: patients[8].id, title: 'Fermeture d\'un diastème', treatment: 'Esthétique', date: day(-20), before: svg(false, 2), after: svg(true, 2), consent: false, published: false },
  ];

  /* ── Activité récente ── */
  const activity = [
    ['appt', `${patients[40].firstName} ${patients[40].lastName} est arrivé(e) en salle d'attente`, 7, 'Amel Ben Ali'],
    ['payment', `Facture ${payments[payments.length - 1]?.invoiceNumber || ''} encaissée`, 25, 'Amel Ben Ali'],
    ['treatment', 'Couronne zircone de Sofiene Hammami envoyée au laboratoire', 80, 'Dr Nouha Ksiksi'],
    ['patient', `Nouveau patient : ${patients[45].firstName} ${patients[45].lastName}`, 200, 'Amel Ben Ali'],
    ['appt', '12 rappels WhatsApp envoyés pour demain', 60 * 18, 'Amel Ben Ali'],
  ].map(([type, text, min, by]) => ({ id: id(), type, text, time: isoAgo(min), by }));

  const settings = {
    clinic: { clinicName: 'Cabinet dentaire Dr Nouha Ksiksi', clinicPhone: '+216 23 232 407', clinicAddr: '1 Bis Rue Pasteur (en face du CHU Habib Bourguiba)', clinicCity: '4100 Médenine', clinicEmail: '', clinicWebsite: '' },
    acts: { services: ACTS.map(([name, p]) => ({ name, price: p, code: '', cot: '', prosthesis: PROTH.test(name) })), cnamCode: '' },
  };

  return { patients, appointments, treatments, payments, chart, labs, labworks, labpayments, tasks, expenses, documents, requests, gallery, activity, settings };
}
