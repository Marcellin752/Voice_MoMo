# Audit UX Voice MoMo - Point de Vue Utilisateur

*"Je suis un utilisateur ordinaire. Mon seul objectif : envoyer de l'argent à ma famille par la voix, facilement et sans stress."*

---

## 🔴 BLOQUANTS — Empêchent la transaction de se compléter

### 1. Message d'erreur technique incompréhensible
**Fichier:** `MoMoTransactionEngine.ts` ligne 17
**Problème actuel:**
```
"Impossible d'envoyer le code USSD. Réessayez ou ouvrez le menu *880# manuellement."
```
**Pourquoi c'est bloquant:** L'utilisateur ne sait pas ce qu'est un "code USSD". Il ne comprend pas quoi faire. Il abandonne.
**Solution:** Message humain: "La transaction n'a pas pu être lancée. Vérifiez votre connexion réseau et réessayez."

---

### 2. Erreur "Numéro trop court" sans guidance
**Fichier:** `ContactResolverService.ts` ligne 23
**Problème actuel:**
```
"Numéro trop court: 12345. Minimum 8 chiffres requis."
```
**Pourquoi c'est bloquant:** L'utilisateur a dicté un numéro incomplet mais ne sait pas comment corriger. Pas d'exemple.
**Solution:** "Le numéro que j'ai compris est incomplet. Pouvez-vous répéter le numéro complet, par exemple 9-5-1-2-3-4-5-6 ?"

---

### 3. Pas de feedback pendant le traitement long
**Fichier:** `useVoiceAssistant.ts` ligne 227
**Problème actuel:** "Traitement en cours..." sans indication de durée
**Pourquoi c'est bloquant:** Après 10 secondes de silence, l'utilisateur pense que l'app a planté et ferme.
**Solution:** Ajouter des messages progressifs: "Je traite votre demande..." → "Connexion au réseau MTN..." → "Presque terminé..."

---

### 4. Timeout silencieux après 45 secondes
**Fichier:** `MoMoTransactionEngine.ts` ligne 335-341
**Problème actuel:** Après 45s sans SMS, message vague: "Transaction envoyée. Vérifiez votre historique MoMo..."
**Pourquoi c'est bloquant:** L'utilisateur ne sait pas si l'argent est parti ou non. Stress maximal.
**Solution:** "Je n'ai pas reçu de confirmation. L'argent n'a probablement PAS été envoyé. Voulez-vous réessayer ?"

---

### 5. Contact introuvable = fin de parcours
**Fichier:** `VoiceIntentProcessor.ts` ligne 52
**Problème actuel:**
```
"Le contact 'Maman' est introuvable."
```
**Pourquoi c'est bloquant:** L'utilisateur ne peut pas continuer. Pas d'alternative proposée.
**Solution:** "Je n'ai pas trouvé 'Maman' dans vos contacts. Voulez-vous dicter le numéro directement ?"

---

## 🟠 FRUSTRANTS — Dégradent fortement l'expérience, risque d'abandon

### 6. Pas de confirmation vocale du montant compris
**Fichier:** `useVoiceAssistantNLP.ts` ligne 193-194
**Problème actuel:** L'app dit juste "Action exécutée" sans répéter ce qu'elle a compris
**Pourquoi c'est frustrant:** L'utilisateur a dit "5000" mais l'app a peut-être compris "50000". Aucune vérification.
**Solution:** Toujours répéter: "J'ai compris: envoyer 5 000 francs à Jean. C'est correct ?"

---

### 7. Ambiguïté silencieuse pour les contacts homonymes
**Fichier:** `VoiceIntentProcessor.ts` lignes 57-64
**Problème actuel:** Affiche une liste de contacts sur l'écran sans guidance vocale claire
**Pourquoi c'est frustrant:** L'utilisateur doit regarder l'écran et toucher. Il voulait tout faire à la voix.
**Solution:** "J'ai trouvé 3 personnes nommées Jean. Jean Dupont, Jean Martin, ou Jean Koffi ? Dites le nom complet."

---

### 8. Messages d'erreur en anglais ou techniques
**Fichier:** `useVoiceAssistant.ts` ligne 266
**Problème actuel:**
```
"Serveur vocal injoignable. Vérifiez VITE_VOICE_AI_URL et le NLP Module (port 8000)."
```
**Pourquoi c'est frustrant:** L'utilisateur lambda ne comprend rien. Il pense que c'est sa faute.
**Solution:** "Le service vocal est temporairement indisponible. Veuillez réessayer dans quelques minutes."

---

### 9. Pas de reprise après échec de reconnaissance vocale
**Fichier:** `useVoiceAssistant.ts` lignes 67-76
**Problème actuel:** "Je n'ai pas bien entendu. Veuillez réessayer." puis retour à idle
**Pourquoi c'est frustrant:** L'utilisateur doit rappuyer sur le micro. Friction inutile.
**Solution:** Relancer automatiquement l'écoute: "Je n'ai pas bien compris. J'écoute à nouveau..."

---

### 10. Demande de PIN sans contexte suffisant
**Fichier:** `useVoiceAssistantNLP.ts` lignes 164-166
**Problème actuel:** "Veuillez entrer votre code PIN pour confirmer le transfert."
**Pourquoi c'est frustrant:** L'utilisateur ne voit plus le montant ni le destinataire. Doute.
**Solution:** "Pour envoyer 5 000 F à Jean (01 95 12 34 56), entrez votre code PIN MTN."

---

### 11. Pas d'annulation facile en cours de transaction
**Fichier:** `MoMoTransactionEngine.ts`
**Problème actuel:** Une fois le transfert lancé, pas de moyen d'annuler
**Pourquoi c'est frustrant:** L'utilisateur réalise qu'il s'est trompé mais ne peut rien faire.
**Solution:** Ajouter "Dites STOP ou appuyez sur Annuler pour interrompre" pendant le traitement.

---

## 🟡 IRRITANTS — Nuisent à la fluidité sans bloquer

### 12. Feedback "Je vous écoute..." trop générique
**Fichier:** `useVoiceAssistant.ts` ligne 170
**Problème actuel:** "Je vous écoute..."
**Pourquoi c'est irritant:** Pas d'indication de ce qu'on peut dire.
**Solution:** "Je vous écoute. Dites par exemple: Envoie 2000 à Maman."

---

### 13. Délai de 5 secondes avant retour à idle trop court
**Fichier:** `useVoiceAssistant.ts` ligne 119, `useVoiceAssistantNLP.ts` ligne 208
**Problème actuel:** `setTimeout(() => setStatus('idle'), 5000);`
**Pourquoi c'est irritant:** L'utilisateur n'a pas fini de lire le message qu'il disparaît.
**Solution:** Augmenter à 8-10 secondes, ou attendre une action utilisateur.

---

### 14. Pas de son/vibration pour confirmer l'écoute
**Fichier:** `useVoiceAssistant.ts` ligne 168-170
**Problème actuel:** L'écoute démarre silencieusement
**Pourquoi c'est irritant:** L'utilisateur n'est pas sûr que l'app écoute vraiment.
**Solution:** Ajouter un bip court ou une vibration au démarrage de l'écoute.

---

### 15. Solde masqué par défaut sans explication
**Fichier:** `HomeScreen.tsx` ligne 222
**Problème actuel:** Le solde affiche "••••••" sans explication
**Pourquoi c'est irritant:** L'utilisateur ne sait pas comment voir son solde.
**Solution:** Ajouter une icône œil plus visible ou un texte "Touchez pour afficher".

---

### 16. Messages de succès/échec pas assez distincts
**Fichier:** `HomeScreen.tsx` lignes 91-99
**Problème actuel:** Toast success et info se ressemblent visuellement
**Pourquoi c'est irritant:** Difficile de distinguer rapidement succès/échec/info.
**Solution:** Couleurs très distinctes: vert vif pour succès, rouge pour échec, bleu pour info.

---

### 17. Pas d'historique des commandes vocales
**Problème actuel:** Aucun moyen de voir ce qu'on a dit précédemment
**Pourquoi c'est irritant:** Si l'app a mal compris, l'utilisateur ne peut pas vérifier.
**Solution:** Afficher la transcription de la dernière commande en petit sous le feedback.

---

### 18. Format du montant pas localisé dans les messages
**Fichier:** `VoiceIntentProcessor.ts` ligne 42
**Problème actuel:** "Doit être entre 100 et 500000 XOF"
**Pourquoi c'est irritant:** "XOF" est technique. L'utilisateur dit "francs".
**Solution:** "Le montant doit être entre 100 et 500 000 francs CFA."

---

## 📊 Résumé par criticité

| Criticité | Nombre | Impact |
|-----------|--------|--------|
| 🔴 Bloquant | 5 | Abandon garanti |
| 🟠 Frustrant | 6 | Risque élevé d'abandon |
| 🟡 Irritant | 7 | Expérience dégradée |

---

## 🔧 Plan de correction prioritaire

1. **Priorité 1 (Bloquants):** Messages d'erreur humains et guidance
2. **Priorité 2 (Frustrants):** Confirmation vocale et reprise automatique
3. **Priorité 3 (Irritants):** Feedback amélioré et délais ajustés
