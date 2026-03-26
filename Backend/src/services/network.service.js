const db = require("../config/db");

// Types de réseaux disponibles
const NETWORKS = {
  MTN: 'MTN',
  MOOV: 'MOOV',
  CELTIIS: 'CELTIIS'
};

/**
 * Récupère tous les réseaux disponibles
 */
async function getAllNetworks() {
  try {
    const result = await db.query(
      'SELECT id, code, name, country, is_active FROM networks WHERE is_active = TRUE ORDER BY name'
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des réseaux:', error);
    throw new Error('Impossible de récupérer les réseaux');
  }
}

/**
 * Récupère un réseau par code
 */
async function getNetworkByCode(code) {
  try {
    const result = await db.query(
      'SELECT id, code, name, country, is_active FROM networks WHERE code = $1 AND is_active = TRUE',
      [code.toUpperCase()]
    );
    if (result.rows.length === 0) {
      const error = new Error(`Réseau ${code} non trouvé`);
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  } catch (error) {
    if (error.status === 404) throw error;
    console.error('Erreur lors de la récupération du réseau:', error);
    throw new Error('Impossible de récupérer le réseau');
  }
}

/**
 * Récupère le réseau préféré d'un utilisateur
 */
async function getUserPreferredNetwork(userId) {
  try {
    const result = await db.query(
      `SELECT n.id, n.code, n.name, n.country, n.is_active
       FROM networks n
       INNER JOIN users u ON n.id = u.preferred_network_id
       WHERE u.id = $1 AND n.is_active = TRUE`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erreur lors de la récupération du réseau préféré:', error);
    throw new Error('Impossible de récupérer le réseau préféré');
  }
}

/**
 * Définit le réseau préféré d'un utilisateur
 */
async function setUserPreferredNetwork(userId, networkCode) {
  try {
    // Vérifier que le réseau existe
    const network = await getNetworkByCode(networkCode);

    // Mettre à jour l'utilisateur
    const result = await db.query(
      'UPDATE users SET preferred_network_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [network.id, userId]
    );

    if (result.rows.length === 0) {
      const error = new Error('Utilisateur non trouvé');
      error.status = 404;
      throw error;
    }

    return network;
  } catch (error) {
    if (error.status === 404) throw error;
    console.error('Erreur lors de la mise à jour du réseau préféré:', error);
    throw new Error('Impossible de mettre à jour le réseau préféré');
  }
}

/**
 * Vérifie si un réseau est actif
 */
async function isNetworkActive(networkCode) {
  try {
    const network = await getNetworkByCode(networkCode);
    return network.is_active === true;
  } catch (error) {
    return false;
  }
}

/**
 * Récupère les statistiques des réseaux
 */
async function getNetworkStats() {
  try {
    const result = await db.query(
      `SELECT
        n.code,
        n.name,
        COUNT(u.id) as user_count,
        COUNT(DISTINCT me.id) as total_executions
       FROM networks n
       LEFT JOIN users u ON n.id = u.preferred_network_id
       LEFT JOIN mmi_executions me ON n.id = me.network_id
       WHERE n.is_active = TRUE
       GROUP BY n.id, n.code, n.name
       ORDER BY user_count DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    throw new Error('Impossible de récupérer les statistiques');
  }
}

module.exports = {
  NETWORKS,
  getAllNetworks,
  getNetworkByCode,
  getUserPreferredNetwork,
  setUserPreferredNetwork,
  isNetworkActive,
  getNetworkStats
};
