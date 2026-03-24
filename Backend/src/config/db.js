const { Pool } = require('pg');
require('dotenv').config();

// Configuration du pool de connexion
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD || ""), // Force la conversion en String
  port: process.env.DB_PORT,
});
// Log pour confirmer la connexion
pool.on('connect', () => {
  console.log('Connecté à la base de données db_voice_momo');
});

module.exports = {
  /**
   * Exécute une requête SQL
   * @param {string} text - La requête SQL
   * @param {Array} params - Les paramètres pour éviter les injections SQL
   */
  query: (text, params) => pool.query(text, params),
  
  //fermer proprement la connexion si besoin
  end: () => pool.end(),
};
