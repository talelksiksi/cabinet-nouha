/* ═══════════════════════════════════════════
   HTTPS sur le réseau du cabinet
   Une petite « autorité de certification » propre au cabinet est créée au premier démarrage ;
   son certificat (public) s'installe une fois sur chaque PC / téléphone. Elle signe le certificat
   du serveur pour cabinet-nouha.local. La clé privée de l'autorité ne quitte jamais le PC serveur.
   Le chiffrement dans le navigateur (WebCrypto) exige une connexion sécurisée : d'où ce HTTPS local.
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';

const pki = forge.pki;
const CA_NAME = 'Cabinet Dr Nouha Ksiksi - autorite locale';

export const lanAddresses = () => Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

function serial() { return '01' + forge.util.bytesToHex(forge.random.getBytesSync(15)); }

function makeCa() {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86400e3);
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 86400e3);
  const attrs = [{ name: 'commonName', value: CA_NAME }, { name: 'organizationName', value: 'Cabinet dentaire Dr Nouha Ksiksi' }, { name: 'countryName', value: 'TN' }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

function makeServerCert(ca, hostname, ips) {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86400e3);
  cert.validity.notAfter = new Date(Date.now() + 800 * 86400e3);   // < 825 jours : accepté par iPhone / Mac
  cert.setSubject([{ name: 'commonName', value: hostname }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [
      { type: 2, value: hostname }, { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' }, ...ips.map(ip => ({ type: 7, ip })),
    ] },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

/** Charge (ou crée) l'autorité locale et le certificat du serveur ; renouvelle ce dernier si besoin. */
export function ensureTls(cfg, log = () => {}) {
  const f = n => path.join(cfg.tlsDir, n);
  let ca;
  if (fs.existsSync(f('ca.key')) && fs.existsSync(f('ca.crt'))) {
    ca = { cert: pki.certificateFromPem(fs.readFileSync(f('ca.crt'), 'utf8')), key: pki.privateKeyFromPem(fs.readFileSync(f('ca.key'), 'utf8')) };
  } else {
    log('Création de l\'autorité de certification du cabinet…');
    ca = makeCa();
    fs.writeFileSync(f('ca.key'), pki.privateKeyToPem(ca.key), { mode: 0o600 });
    fs.writeFileSync(f('ca.crt'), pki.certificateToPem(ca.cert));
  }
  const ips = lanAddresses();
  let renew = !fs.existsSync(f('server.crt'));
  if (!renew) {
    const cur = pki.certificateFromPem(fs.readFileSync(f('server.crt'), 'utf8'));
    const san = (cur.getExtension('subjectAltName')?.altNames || []);
    const hasHost = san.some(a => a.value === cfg.hostname);
    const missingIp = ips.some(ip => !san.some(a => a.ip === ip));
    renew = !hasHost || missingIp || cur.validity.notAfter.getTime() - Date.now() < 30 * 86400e3;
  }
  if (renew) {
    log('Certificat du serveur (re)généré pour ' + [cfg.hostname, ...ips].join(', '));
    const s = makeServerCert(ca, cfg.hostname, ips);
    fs.writeFileSync(f('server.key'), pki.privateKeyToPem(s.key), { mode: 0o600 });
    fs.writeFileSync(f('server.crt'), pki.certificateToPem(s.cert));
  }
  return {
    key: fs.readFileSync(f('server.key')), cert: fs.readFileSync(f('server.crt')),
    caPem: fs.readFileSync(f('ca.crt')),
    caDer: Buffer.from(forge.asn1.toDer(pki.certificateToAsn1(ca.cert)).getBytes(), 'binary'),
  };
}
