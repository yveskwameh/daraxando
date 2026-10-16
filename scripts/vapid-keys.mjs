// Makes a new pair of notification keys (VAPID, docs/BACKEND.md "Notifications") and prints
// them. Nothing is saved anywhere: copy each line into Cloudflare as a Secret on one copy of the
// game, then clear the terminal. Each copy (staging, production) gets its own pair, made once.
// Run in the VS Code terminal: node scripts/vapid-keys.mjs
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);

console.log('');
console.log(`VAPID_PUBLIC_KEY=${pub.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('');
console.log('Add each as a Secret on one Worker: the part before = is the name, the part after is the value.');
console.log('Never change a pair once players have turned notifications on.');
