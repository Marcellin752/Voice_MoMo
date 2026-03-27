const db = require("../config/db");
const networkService = require("./network.service");

/**
 * Récupère tous les codes MMI disponibles pour un réseau
 */
async function getMMICodesByNetwork(networkCode) {
  try {
    const network = await networkService.getNetworkByCode(networkCode);
    const result = await db.query(
      `SELECT id, code_type, description, mmi_code, parameters, is_active
       FROM mmi_codes
       WHERE network_id = $1 AND is_active = TRUE
       ORDER BY code_type`,
      [network.id]
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des codes MMI:', error);
    throw new Error('Impossible de récupérer les codes MMI');
  }
}

/**
 * Récupère un code MMI spécifique
 */
async function getMMICode(networkCode, codeType) {
  try {
    const network = await networkService.getNetworkByCode(networkCode);
    const result = await db.query(
      `SELECT id, code_type, description, mmi_code, parameters, is_active
       FROM mmi_codes
       WHERE network_id = $1 AND code_type = $2 AND is_active = TRUE`,
      [network.id, codeType]
    );
    if (result.rows.length === 0) {
      const error = new Error(`Code MMI ${codeType} non trouvé pour ${networkCode}`);
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  } catch (error) {
    if (error.status === 404) throw error;
    console.error('Erreur lors de la récupération du code MMI:', error);
    throw new Error('Impossible de récupérer le code MMI');
  }
}

/**
 * Exécute un code MMI et enregistre l'exécution
 */
async function executeMMI(userId, networkCode, codeType, additionalParams = {}) {
  try {
    // Vérifier que l'utilisateur existe
    const userResult = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      const error = new Error('Utilisateur non trouvé');
      error.status = 404;
      throw error;
    }

    // Récupérer le code MMI
    const mmiCode = await getMMICode(networkCode, codeType);
    const network = await networkService.getNetworkByCode(networkCode);

    // Construire le code MMI final avec paramètres si nécessaire
    let finalMMICode = mmiCode.mmi_code;

    if (codeType === 'transfer' || codeType === 'momo_send') {
      // Pour les transferts, ajouter le numéro de destination
      if (!additionalParams.destinationNumber) {
        const error = new Error('Numéro de destination requis pour un transfert');
        error.status = 400;
        throw error;
      }
      finalMMICode = `${mmiCode.mmi_code}${additionalParams.destinationNumber}*${additionalParams.amount || ''}#`;
    }

    // Simuler l'exécution du code MMI
    const executionResult = await simulateMMIExecution(networkCode, codeType, finalMMICode, additionalParams);

    // Enregistrer l'exécution dans la base de données
    const insertResult = await db.query(
      `INSERT INTO mmi_executions (
        user_id, mmi_code_id, network_id, code_type, mmi_code, status, response, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, code_type, mmi_code, status, response, error_message, executed_at`,
      [
        userId,
        mmiCode.id,
        network.id,
        codeType,
        finalMMICode,
        executionResult.status,
        executionResult.response,
        executionResult.error_message
      ]
    );

    return insertResult.rows[0];
  } catch (error) {
    if (error.status === 404 || error.status === 400) throw error;
    console.error('Erreur lors de l\'exécution du MMI:', error);
    throw new Error('Impossible d\'exécuter le code MMI');
  }
}

/**
 * Simule l'exécution d'un code MMI sur le téléphone
 */
async function simulateMMIExecution(networkCode, codeType, mmiCode, params = {}) {
  try {
    // Simuler les réponses selon le type de code et le réseau
    const responses = {
      MTN: {
        balance: { status: 'success', response: 'Votre solde MTN: 50,000 XOF' },
        data_balance: { status: 'success', response: 'Données MTN: 2.5 GB disponible' },
        credit_recharge: { status: 'success', response: 'Recharge en cours...' },
        ussd_menu: { status: 'success', response: 'Menu USSD MTN chargé' },
        transfer: { status: 'success', response: 'Transfert de 5,000 XOF effectué' },
        momo_balance: { status: 'success', response: 'Solde MTN Money: 75,000 XOF' },
        momo_send: { status: 'success', response: 'Envoi de 10,000 XOF en cours...' }
      },
      MOOV: {
        balance: { status: 'success', response: 'Solde MOOV: 45,000 XOF' },
        data_balance: { status: 'success', response: 'Données MOOV: 1.8 GB disponible' },
        credit_recharge: { status: 'success', response: 'Recharge MOOV en cours...' },
        ussd_menu: { status: 'success', response: 'Menu USSD MOOV chargé' },
        transfer: { status: 'success', response: 'Transfert de 5,000 XOF effectué' },
        momo_balance: { status: 'success', response: 'Solde MOOV Money: 60,000 XOF' },
        momo_send: { status: 'success', response: 'Envoi de 10,000 XOF en cours...' }
      },
      CELTIIS: {
        balance: { status: 'success', response: 'Solde CELTIIS: 30,000 XOF' },
        data_balance: { status: 'success', response: 'Données CELTIIS: 3.2 GB disponible' },
        credit_recharge: { status: 'success', response: 'Recharge CELTIIS en cours...' },
        ussd_menu: { status: 'success', response: 'Menu USSD CELTIIS chargé' },
        transfer: { status: 'success', response: 'Transfert de 5,000 XOF effectué' },
        momo_balance: { status: 'success', response: 'Solde CELTIIS Money: 55,000 XOF' },
        momo_send: { status: 'success', response: 'Envoi de 10,000 XOF en cours...' }
      }
    };

    const networkResponses = responses[networkCode];
    if (!networkResponses) {
      return { status: 'failed', error_message: `Réseau ${networkCode} non supporté` };
    }

    const response = networkResponses[codeType];
    if (!response) {
      return { status: 'failed', error_message: `Type de code ${codeType} non supporté pour ${networkCode}` };
    }

    return response;
  } catch (error) {
    console.error('Erreur lors de la simulation d\'exécution:', error);
    return { status: 'failed', error_message: 'Erreur lors de l\'exécution du code MMI' };
  }
}

/**
 * Récupère l'historique des exécutions MMI d'un utilisateur
 */
async function getExecutionHistory(userId, networkCode = null, limit = 50) {
  try {
    let query = `
      SELECT me.id, me.code_type, me.mmi_code, me.status, me.response, me.error_message,
             me.executed_at, n.code, n.name
      FROM mmi_executions me
      INNER JOIN networks n ON me.network_id = n.id
      WHERE me.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (networkCode) {
      query += ` AND n.code = $${paramIndex}`;
      params.push(networkCode.toUpperCase());
      paramIndex++;
    }

    query += ` ORDER BY me.executed_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    throw new Error('Impossible de récupérer l\'historique des exécutions');
  }
}

/**
 * Récupère les statistiques des exécutions MMI
 */
async function getExecutionStats(userId) {
  try {
    const result = await db.query(
      `SELECT
        n.code,
        n.name,
        COUNT(*) as total_executions,
        SUM(CASE WHEN me.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN me.status = 'failed' THEN 1 ELSE 0 END) as failed_count
       FROM mmi_executions me
       INNER JOIN networks n ON me.network_id = n.id
       WHERE me.user_id = $1
       GROUP BY n.id, n.code, n.name
       ORDER BY total_executions DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    throw new Error('Impossible de récupérer les statistiques');
  }
}

module.exports = {
  getMMICodesByNetwork,
  getMMICode,
  executeMMI,
  simulateMMIExecution,
  getExecutionHistory,
  getExecutionStats
};
