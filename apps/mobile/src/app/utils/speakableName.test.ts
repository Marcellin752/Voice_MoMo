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
  // L'oral répète la demande sous forme de question, avec les deux réponses possibles
  assert.match(speech, /^Vous voulez envoyer 1.000 francs à /);
  assert.match(speech, /Est-ce bien cela \? Dites oui pour confirmer, ou non pour annuler\.$/);
});

test('confirmation : un dépôt dit « déposer … sur le compte de »', () => {
  const { speech, display } = buildTransferConfirmSpeech({
    amount: 200,
    name: 'David Kokou',
    phone: '0197001234',
    operation: 'déposer',
  });
  assert.match(speech, /^Vous voulez déposer 200 francs sur le compte de David, numéro 1 2 3 4/);
  assert.match(display, /^Déposer 200 F sur le compte de David Kokou/);
});
