# Documentation des Services MMI/USSD - Voice MoMo

## Vue d'ensemble

Ce document détaille les modifications apportées au backend Voice MoMo pour intégrer les services MMI/USSD (Unstructured Supplementary Service Data) avec support des réseaux mobiles du Bénin: **MTN**, **MOOV** et **Celtiis**.

---

## Fichiers Modifiés

### 1. `Backend/src/config/schema.sql`
**Modifications:**
- Ajout de la table `networks` pour gérer les réseaux mobiles disponibles
- Ajout de la colonne `preferred_network_id` à la table `users`
- Ajout de la colonne `network_id` à la table `transactions`
- Création de la table `mmi_codes` pour stocker les codes USSD/MMI par réseau
- Création de la table `mmi_executions` pour enregistrer l'historique des exécutions MMI
- Changement de la devise par défaut de `FCFA` à `XOF`
- Insertion des 3 réseaux du Bénin: MTN, MOOV, CELTIIS
- Insertion des codes MMI par défaut pour chaque réseau

**Nouvelles tables:**
```sql
- networks: Gestion des réseaux mobiles
- mmi_codes: Codes USSD disponibles par réseau
- mmi_executions: Historique des exécutions de codes MMI
```

### 2. `Backend/src/app.js`
**Modifications:**
- Ajout de l'importation des routes MMI
- Enregistrement de la route `/api/mmi` dans l'application

---

## Nouveaux Fichiers Créés

### 1. `Backend/src/services/network.service.js`
**Fonctionnalités:**
- `getAllNetworks()` - Récupère tous les réseaux disponibles
- `getNetworkByCode(code)` - Récupère un réseau par son code
- `getUserPreferredNetwork(userId)` - Récupère le réseau préféré de l'utilisateur
- `setUserPreferredNetwork(userId, networkCode)` - Définit le réseau préféré de l'utilisateur
- `isNetworkActive(networkCode)` - Vérifie si un réseau est actif
- `getNetworkStats()` - Récupère les statistiques d'utilisation des réseaux

**Exports constants:**
- `NETWORKS` - Objet contenant les codes des réseaux (MTN, MOOV, CELTIIS)

### 2. `Backend/src/services/mmi.service.js`
**Fonctionnalités:**
- `getMMICodesByNetwork(networkCode)` - Récupère tous les codes MMI pour un réseau
- `getMMICode(networkCode, codeType)` - Récupère un code MMI spécifique
- `executeMMI(userId, networkCode, codeType, additionalParams)` - Exécute un code MMI
- `simulateMMIExecution(networkCode, codeType, mmiCode, params)` - Simule l'exécution (pour tests)
- `getExecutionHistory(userId, networkCode, limit)` - Récupère l'historique des exécutions
- `getExecutionStats(userId)` - Récupère les statistiques des exécutions par réseau

### 3. `Backend/src/controllers/mmi.controller.js`
**Endpoints:**
- `getAllNetworks()` - Récupère tous les réseaux
- `setPreferredNetwork(req, res)` - Définit le réseau préféré
- `getPreferredNetwork(req, res)` - Récupère le réseau préféré
- `getMMICodesByNetwork(req, res)` - Récupère les codes MMI d'un réseau
- `getMMICode(req, res)` - Récupère un code MMI spécifique
- `executeMMI(req, res)` - Exécute un code MMI
- `getExecutionHistory(req, res)` - Récupère l'historique des exécutions
- `getExecutionStats(req, res)` - Récupère les stats des exécutions
- `getNetworkStats(req, res)` - Récupère les stats des réseaux

### 4. `Backend/src/routes/mmi.routes.js`
**Routes disponibles:**
```
GET    /api/mmi/networks                      - Tous les réseaux
GET    /api/mmi/networks/preferred            - Réseau préféré de l'utilisateur
POST   /api/mmi/networks/preferred            - Définir le réseau préféré
GET    /api/mmi/networks/stats                - Stats des réseaux
GET    /api/mmi/codes/:networkCode            - Tous les codes d'un réseau
GET    /api/mmi/codes/:networkCode/:codeType - Un code MMI spécifique
POST   /api/mmi/execute                       - Exécuter un code MMI
GET    /api/mmi/executions/history            - Historique des exécutions
GET    /api/mmi/executions/stats              - Stats des exécutions
```

### 5. `Backend/tests.sh`
**Script bash complet de tests:**
- Vérification de la santé du serveur
- Tests d'authentification (création et connexion)
- Tests des réseaux mobiles
- Tests des codes MMI
- Tests d'exécution des codes MMI
- Tests de l'historique et des statistiques
- Rapports colorés avec succès/erreurs

---

## Codes MMI Disponibles

### MTN Bénin
| Type | Description | Code USSD |
|------|-------------|-----------|
| balance | Consulter solde crédit | *123# |
| data_balance | Consulter solde données | *123*4# |
| momo_menu | Menu principal MoMo | *880# |
| momo_balance | Solde MTN MoMo | *880# (option Solde) |
| momo_send | Envoyer argent MoMo | *880# (option Envoi) |
| momo_deposit | Dépôt argent MoMo | *880# (option Dépôt) |
| momo_withdraw | Retrait argent MoMo | *880# (option Retrait) |
| momo_history | Historique MoMo | *880# (option Historique) |
| credit_recharge | Recharger crédit via MoMo | *880# (option Recharge) |

> **Note**: Pour MTN Bénin, toutes les opérations MoMo passent par le menu principal `*880#`.
> L'utilisateur sélectionne ensuite l'option souhaitée dans le menu interactif USSD.

### MOOV Bénin
| Type | Description | Code USSD |
|------|-------------|-----------|
| balance | Consulter solde | *155# |
| momo_menu | Menu Moov Money | *155# |
| momo_send | Envoyer argent | *155# (option Envoi) |

### CELTIIS Bénin
| Type | Description | Code USSD |
|------|-------------|-----------|
| balance | Consulter solde | *100# |
| momo_menu | Menu Celtiis Money | *100# |

---

## Utilisation des Services MMI

### 1. Définir le réseau préféré
```bash
curl -X POST http://localhost:3001/api/mmi/networks/preferred \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"networkCode": "MTN"}'
```

### 2. Récupérer les codes MMI disponibles
```bash
curl -X GET http://localhost:3001/api/mmi/codes/MTN \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Exécuter un code MMI (consulter solde)
```bash
curl -X POST http://localhost:3001/api/mmi/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "networkCode": "MTN",
    "codeType": "balance"
  }'
```

### 4. Exécuter un transfert d'argent
```bash
curl -X POST http://localhost:3001/api/mmi/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "networkCode": "MTN",
    "codeType": "momo_send",
    "destinationNumber": "+22961234568",
    "amount": "5000"
  }'
```

### 5. Récupérer l'historique des exécutions
```bash
curl -X GET "http://localhost:3001/api/mmi/executions/history?networkCode=MTN&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Récupérer les statistiques
```bash
curl -X GET http://localhost:3001/api/mmi/executions/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Exécution des Tests

### Méthode 1: Via npm
```bash
cd Backend
npm run test:mmi
```

### Méthode 2: Directement
```bash
cd Backend
bash tests.sh
```

### Prérequis pour les tests
- Le serveur doit être en cours d'exécution sur `http://localhost:3001`
- La base de données doit être initialisée avec le schéma
- `curl` doit être disponible

---

## Structure de la Réponse d'Exécution MMI

```json
{
  "message": "Code MMI exécuté avec succès",
  "execution": {
    "id": "uuid",
    "user_id": "uuid",
    "code_type": "balance",
    "mmi_code": "*123#",
    "status": "success",
    "response": "Votre solde MTN: 50,000 XOF",
    "error_message": null,
    "executed_at": "2024-01-15T10:30:45Z"
  }
}
```

---

## Points Clés de l'Implémentation

1. **Isolation par Réseau**: Chaque réseau (MTN, MOOV, CELTIIS) a ses propres codes MMI
2. **Altération de Réseaux**: Les utilisateurs peuvent changer de réseau préféré
3. **Historique Complet**: Tous les exécutions sont enregistrées avec timestamp
4. **Simulation**: Les codes MMI sont simulés (peuvent être intégrés avec une API télécom réelle)
5. **Authentification**: Tous les endpoints MMI nécessitent une authentification
6. **Validation**: Validation stricte des réseau et codes MMI
7. **Gestion des Erreurs**: Erreurs claires et informatives

---

## Notes Importantes

- Les codes MMI sont actuellement simulés. Pour une utilisation en production, intégrez une API télécom réelle
- La devise utilisée est XOF (CFA franc ouest-africain du Bénin)
- Les montants dans les transferts sont en XOF
- Tous les timestamps sont en UTC
- Les limites de l'historique sont limitées à 100 exécutions max

---

## Résumé des Changements

| Élément | Avant | Après |
|---------|-------|-------|
| Réseaux supportés | Aucun | MTN, MOOV, CELTIIS |
| Codes MMI | Aucun | 7 codes par réseau (21 au total) |
| Historique MMI | Non | Oui (table mmi_executions) |
| Réseau préféré | Non | Oui (colonne dans users) |
| Devise | FCFA | XOF |
| Endpoints MMI | 0 | 9 endpoints |
