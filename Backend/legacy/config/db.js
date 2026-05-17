const { Pool } = require('pg');
require('dotenv').config();

// Configuration du pool de connexion
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Requis pour Neon/Render
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: String(process.env.DB_PASSWORD || ""),
      port: process.env.DB_PORT,
    });

// Log pour confirmer la connexion
pool.on('connect', () => {
  console.log('🔌 [DB] Nouvelle connexion établie au pool de la base de données.');
});

/**
 * Initialisation dynamique des tables requises (particulièrement pour Neon en production)
 */
async function initDb() {
  try {
    console.log('⚙️ [DB] Vérification et initialisation dynamique du schéma sur Neon...');
    
    // 1. Activer pgcrypto pour générer des UUIDs aléatoires nativement dans Postgres
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // 2. Création de la table des utilisateurs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT,
        phone_number TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        balance DECIMAL(15,2) DEFAULT 15000.00,
        currency TEXT DEFAULT 'FCFA',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Création de la table des sessions (pour les tokens JWT et la révocation)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Création de la table des notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ [DB] Schéma dynamique de la base de données initialisé avec succès !');
  } catch (err) {
    console.error('❌ [DB] Échec de l\'initialisation dynamique de la base de données :', err);
  }
}

// Exécuter l'initialisation dès le chargement du module
initDb();

module.exports = {
  /**
   * Exécute une requête SQL
   * @param {string} text - La requête SQL
   * @param {Array} params - Les paramètres pour éviter les injections SQL
   */
  query: (text, params) => pool.query(text, params),
  
  // fermer proprement la connexion si besoin
  end: () => pool.end(),
};
