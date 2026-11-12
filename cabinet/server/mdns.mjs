/* Annonce « cabinet-nouha.local » sur le réseau du cabinet (mDNS / Bonjour) :
   les PC Windows 10/11, Android et iPhone trouvent le serveur par son nom, même si son adresse IP change. */
import mdnsFactory from 'multicast-dns';
import { lanAddresses } from './tls.mjs';

export function startMdns(hostname, log = () => {}) {
  let mdns;
  try { mdns = mdnsFactory({ reuseAddr: true }); }
  catch (e) { log('mDNS indisponible', e); return { stop() {} }; }
  const name = hostname.toLowerCase();
  const answers = () => lanAddresses().map(ip => ({ name: hostname, type: 'A', ttl: 120, flush: true, data: ip }));
  mdns.on('query', q => {
    if (q.questions.some(x => x.name.toLowerCase() === name && (x.type === 'A' || x.type === 'ANY'))) mdns.respond({ answers: answers() });
  });
  mdns.on('error', e => log('mDNS', e));
  // annonce spontanée au démarrage puis régulièrement (réseau redémarré, nouvelle adresse…)
  const announce = () => { try { mdns.respond({ answers: answers() }); } catch {} };
  announce();
  const t = setInterval(announce, 60e3); t.unref?.();
  return { stop() { clearInterval(t); mdns.destroy(); } };
}
