// Einmalig: VAPID-Schlüsselpaar für Web Push erzeugen.  npm run push:keys
// Der Public Key kommt als Secret VAPID_PUBLIC_KEY ins Repo (und landet über die Action
// in macro.json – er ist öffentlich), der Private Key nur als Secret VAPID_PRIVATE_KEY.

import webpush from 'web-push'

const k = webpush.generateVAPIDKeys()
console.log('VAPID_PUBLIC_KEY=' + k.publicKey)
console.log('VAPID_PRIVATE_KEY=' + k.privateKey)
console.log('')
console.log('Als GitHub-Secrets setzen (im Repo-Ordner):')
console.log(`  gh secret set VAPID_PUBLIC_KEY --body "${k.publicKey}"`)
console.log(`  gh secret set VAPID_PRIVATE_KEY --body "${k.privateKey}"`)
console.log('  gh secret set VAPID_SUBJECT --body "mailto:deine@mail.de"')
