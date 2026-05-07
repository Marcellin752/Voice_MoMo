# MTN MoMo Bénin - USSD Actions Reference

## Core Actions (Mobile Money)

### 1. Transfer (Envoi d'argent)
**Code**: `*880*1*{number}*{amount}#`
**Params**:
- `to` ou `recipient`: Numéro destinataire (ex: "97123456")
- `amount`: Montant en FCFA (ex: "1000")

**Example Voice Commands**:
- "Envoie 2000 à Mama"
- "Transfère 5000 au 97000000"
- "Envoie 500 FCFA à Alice"

---

### 2. Withdraw (Retrait)
**Code**: `*880*2#`
**Params**: None required (menu interactif)

**Variants**:
- **Retrait GAB UBA**: `*880*724#` (Generate ATM withdrawal code)
  - Params: `type: "gab"` ou `gab: true`
  - Max: 400,000 FCFA
  - User generates 4-digit code at ATM

**Example Voice Commands**:
- "Je veux retirer 50000"
- "Retrait GAB UBA 100000"
- "Générer code retrait"

---

### 3. Balance (Consultation de solde)
**Code**: `*880*9#`
**Params**: None

**Example Voice Commands**:
- "Quel est mon solde?"
- "Combien j'ai sur mon compte?"
- "Consulte mon solde MoMo"

---

### 4. Bill Payment (Paiement marchand)
**Code**: `*880*5#` (Interactive menu) ou via Code Marchand
**Params**:
- `billRef` ou `ref`: Merchant code
- `amount`: Payment amount

**Example Voice Commands**:
- "Paye ma facture d'électricité"
- "Paiement marchand 5000"
- "Paye ce bill"

---

## Airtime Actions (Crédit & Forfaits)

### 5. Airtime Simple (Crédit MTN)
**Code**: `*880*4*{amount}#`
**Params**:
- `amount`: Montant crédit (ex: "500")

**Example Voice Commands**:
- "Achète-moi 1000 de crédit"
- "Recharge 500 FCFA"
- "Top-up mon crédit"

---

### 6. Go Pack Forfaits (Internet Data)
**Types**: `airtimeType` param value

#### Go Pack Jour
**Code**: `*840*172*1*{number}#`
**Params**:
- `airtimeType: "gopack-jour"`
- `number`: Phone number (MSISDN)

#### Go Pack Semaine
**Code**: `*840*172*2*{number}#`
**Params**:
- `airtimeType: "gopack-semaine"`

#### Go Pack Mois
**Code**: `*840*172*3*{number}#`
**Params**:
- `airtimeType: "gopack-mois"`

**Example Voice Commands**:
- "Achète-moi un forfait Go Pack jour"
- "Forfait internet 1 semaine"
- "Data Go Pack mensuel"

---

### 7. Internet Forfaits
**Types**: `airtimeType` param values

#### Internet Jour
**Code**: `*840*123*1*{number}#`
**Params**: `airtimeType: "internet-jour"`

#### Internet Semaine
**Code**: `*840*123*2*{number}#`
**Params**: `airtimeType: "internet-semaine"`

#### Internet Mois
**Code**: `*840*123*3*{number}#`
**Params**: `airtimeType: "internet-mois"`

#### Internet Illimité
**Code**: `*840*123*4*{number}#`
**Params**: `airtimeType: "internet-illimite"`

**Example Voice Commands**:
- "Forfait internet jour"
- "Internet illimité"
- "Data semaine"

---

## Implementation Details

### Supported Actions (TransactionAction type)
```typescript
type TransactionAction = 
  | "transfer"        // Envoi d'argent
  | "withdraw"        // Retrait (+ GAB variant)
  | "balance"         // Consulter solde
  | "billPayment"     // Paiement marchand
  | "airtime"         // Crédit & Forfaits (variants via params)
  | "miniStatement"   // Relevé transactions
  | "sendToBank";     // Transfert bancaire
```

### Parameter Examples

**Transfer**:
```json
{
  "action": "transfer",
  "params": {
    "to": "97123456",
    "amount": "2000"
  }
}
```

**Retrait GAB UBA**:
```json
{
  "action": "withdraw",
  "params": {
    "type": "gab",
    "amount": "50000"
  }
}
```

**Go Pack Internet**:
```json
{
  "action": "airtime",
  "params": {
    "airtimeType": "internet-mois",
    "number": "97123456"
  }
}
```

---

## NLP Module Intent Mapping

The NLP Module (Gemini 2.0 Flash) should recognize these intents:

| Intent | Action | Example |
|--------|--------|---------|
| `transfer` | transfer | "Envoie 5000 à Mama" |
| `withdraw` | withdraw | "Retrait 50000" |
| `withdraw_gab` | withdraw (gab=true) | "Retrait GAB 100000" |
| `check_balance` | balance | "Quel est mon solde?" |
| `bill_pay` | billPayment | "Paye la facture" |
| `airtime` | airtime | "Crédit 1000" |
| `internet_day` | airtime (internet-jour) | "Forfait internet jour" |
| `internet_week` | airtime (internet-semaine) | "Data semaine" |
| `internet_month` | airtime (internet-mois) | "Internet mensuel" |
| `gopack_day` | airtime (gopack-jour) | "Go Pack jour" |
| `gopack_week` | airtime (gopack-semaine) | "Go Pack semaine" |
| `gopack_month` | airtime (gopack-mois) | "Go Pack mois" |

---

## Status: ✅ Ready for Implementation

### Implemented
- ✅ Transfer
- ✅ Withdraw (basic)
- ✅ Balance
- ✅ Bill Payment
- ✅ Airtime (basic credit)
- ✅ Withdraw GAB (code added)
- ✅ Forfaits (Go Pack, Internet)

### NLP Module Configuration
The NLP Module (`Nlp-module/app/main.py`) needs to be updated to recognize and map these intents.

### Testing
All USSD codes have been validated against official MTN Benin documentation.
