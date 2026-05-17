require('ts-node').register({ transpileOnly: true });
const { VoiceIntentProcessor } = require('./Mobile/src/app/services/engine/VoiceIntentProcessor.ts');
const p = new VoiceIntentProcessor();
console.log(typeof p.processIntent);
console.log(typeof p.transactionEngine.startTransfer);
