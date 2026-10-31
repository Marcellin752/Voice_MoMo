import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatContactForSpeech, buildTransferConfirmSpeech } from './speakableName.ts';

test('TTS : prénom + 4 derniers chiffres espacés, pas le nom complet', () => {
  assert.equal(
    formatContactForSpeech('Koffi Mensah', '0164971234'),
    'Koffi, numéro 1 2 3 4'
  );
});

test('TTS : sans nom, lit le numéro', () => {
  assert.equal(formatContactForSpeech(null, '22997123456'), 'le numéro 3 4 5 6');
});

test('confirmation : écran = nom complet, oral = forme parlable', () => {
  const { speech, display } = buildTransferConfirmSpeech({
    amount: 1000,
    name: 'Koffi Mensah',
    phone: '0164971234',
  });
  assert.match(display, /Koffi Mensah/);
  assert.match(speech, /Koffi, numéro 1 2 3 4/);
  assert.doesNotMatch(speech, /Mensah/);
});
