/* ═══════════════════════════════════════════
   Comptes protégés (Dr Nouha, administrateur informatique) — outil en ligne de commande
   À lancer avec les droits administrateur Windows (le dossier des données leur est réservé).

   PC du cabinet (appelé par l'installation) :
     node tools/comptes.mjs init            crée les deux comptes et affiche leurs codes d'activation (72 h) ;
                                             relancé plus tard, renouvelle seulement les codes jamais utilisés
   Portable du Dr Nouha (COMPTES-PROTEGES.cmd) :
     node tools/comptes.mjs reinitialiser <nouha|talel>     nouveau code d'activation (mot de passe oublié)
     node tools/comptes.mjs renommer <nouha|talel> "<nom>"  nouveau nom affiché
   Les deux :
     node tools/comptes.mjs etat
   ═══════════════════════════════════════════ */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config.mjs';
import { openDb } from '../server/db.mjs';
import { PROTECTED_NAMES, provisionProtected, newActivationCode, inviteAuthOf } from '../server/accounts.mjs';

const [cmd = 'etat', who, ...rest] = process.argv.slice(2);
const cfg = loadConfig();
const db = openDb(cfg);
const isNomad = cfg.role === 'nomade';
const fmt = t => t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const line = () => console.log('  ' + '─'.repeat(60));
const die = (msg, code = 1) => { console.error('\n  ✖ ' + msg + '\n'); db.close(); process.exit(code); };

function state() {
  console.log('');
  console.log(`  Comptes protégés — ${isNomad ? 'portable du Dr Nouha' : 'PC du cabinet'}`);
  line();
  for (const name of PROTECTED_NAMES) {
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(name);
    if (!u) { console.log(`  ${name.padEnd(8)} ${isNomad ? 'pas encore reçu du cabinet (synchronisation)' : 'absent'}`); continue; }
    const st = u.status === 'active' ? 'actif' : u.status === 'invited' ? `à activer (code valable jusqu'au ${fmt(u.invite_expires)})`
      : u.status === 'pending_key' ? 'actif, accès aux dossiers à récupérer (feuille de secours)' : u.status;
    console.log(`  ${name.padEnd(8)} ${u.display_name} — ${st}`);
  }
  if (isNomad) {
    const ops = db.prepare('SELECT * FROM protected_ops ORDER BY created_at DESC LIMIT 5').all();
    if (ops.length) {
      line();
      console.log('  Dernières demandes :');
      for (const o of ops) {
        const r = o.result ? JSON.parse(o.result) : null;
        const res = !o.sent_at ? 'EN ATTENTE (portable pas encore synchronisé avec le cabinet)' : r?.ok ? 'appliquée au cabinet' : `REFUSÉE : ${r?.error || '?'}`;
        console.log(`  ${fmt(o.created_at)}  ${o.op === 'reset' ? 'réinitialisation' : 'nouveau nom'} de ${o.username} → ${res}`);
      }
    }
  }
  line();
}

function queue(op, username, payload) {
  const paired = fs.existsSync(path.join(cfg.dataDir, 'portable.json')) && JSON.parse(fs.readFileSync(path.join(cfg.dataDir, 'portable.json'), 'utf8')).paired;
  if (!paired) die('Ce portable n\'est pas associé au cabinet : associez-le d\'abord (voir le guide).');
  db.prepare('INSERT INTO protected_ops (id, created_at, op, username, payload) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomBytes(12).toString('hex'), Date.now(), op, username, JSON.stringify(payload));
  db.prepare(`INSERT INTO audit (ts, user_id, username, action, target, detail, ip, origin) VALUES (?, NULL, 'outil du portable', ?, ?, NULL, NULL, 'portable')`)
    .run(Date.now(), op === 'reset' ? 'compte_protege_reinitialisation_demandee' : 'compte_protege_renommage_demande', username);
}

switch (cmd) {
  case 'init': {
    if (isNomad) die('Sur le portable, les comptes viennent du cabinet : rien à créer ici.');
    const res = provisionProtected(db, cfg);
    console.log('');
    console.log('  CODES D\'ACTIVATION — valables 72 heures, une seule fois');
    line();
    for (const r of res) {
      if (r.code) console.log(`  ${r.displayName.padEnd(18)} identifiant : ${r.username.padEnd(6)}  code : ${r.code}`);
      else if (r.state === 'active') console.log(`  ${r.displayName.padEnd(18)} identifiant : ${r.username.padEnd(6)}  déjà activé (inchangé)`);
      else console.log(`  ${r.displayName.padEnd(18)} identifiant ${r.username} déjà pris par un autre compte : à vérifier`);
    }
    line();
    if (res.some(r => r.code)) {
      console.log("  Sur https://cabinet-nouha.local : « Première connexion (code d'activation ou d'invitation) »,");
      console.log('  identifiant + code, puis chacun choisit SON mot de passe. Ces codes ne sont enregistrés nulle part.');
    }
    break;
  }
  case 'reinitialiser': {
    if (!isNomad) die('Cette opération se fait uniquement depuis le portable du Dr Nouha.');
    if (!PROTECTED_NAMES.includes(who)) die(`Compte inconnu. Choisir : ${PROTECTED_NAMES.join(' ou ')}.`);
    const code = newActivationCode();
    queue('reset', who, { inviteAuth: inviteAuthOf(code, who) });
    console.log('');
    console.log(`  Nouveau code d'activation pour « ${who} » : ${code}`);
    line();
    console.log('  1. Il sera appliqué au cabinet à la prochaine synchronisation (portable sur le Wi-Fi du cabinet,');
    console.log('     PC du cabinet allumé, application ouverte ou non : en moins d\'une minute).');
    console.log('  2. Puis, sur un PC du cabinet : « Première connexion (code d\'activation ou d\'invitation) », identifiant + ce code,');
    console.log('     nouveau mot de passe. Valable 72 h après son arrivée au cabinet.');
    if (who === 'nouha') console.log('  3. Accès aux dossiers : se le redonner avec la FEUILLE DE SECOURS imprimée (écran proposé).');
    console.log('  L\'ancien mot de passe ne fonctionnera plus, ni au cabinet ni sur ce portable.');
    line();
    break;
  }
  case 'renommer': {
    if (!isNomad) die('Cette opération se fait uniquement depuis le portable du Dr Nouha.');
    if (!PROTECTED_NAMES.includes(who)) die(`Compte inconnu. Choisir : ${PROTECTED_NAMES.join(' ou ')}.`);
    const name = rest.join(' ').trim();
    if (name.length < 2 || name.length > 80) die('Nom affiché : 2 à 80 caractères.');
    queue('rename', who, { displayName: name });
    console.log(`\n  Nouveau nom « ${name} » pour ${who} : appliqué au cabinet à la prochaine synchronisation.\n`);
    break;
  }
  case 'etat': state(); break;
  default: die('Commandes : init | etat | reinitialiser <nouha|talel> | renommer <nouha|talel> "<nom>"');
}
db.close();
