import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'anitrack_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

export const pool = mysql.createPool(dbConfig);

/**
 * Inicializa as tabelas do AniTrack no MariaDB:
 * - animes_assistidos
 * - animes_ira_ver
 * - animes_favoritos
 * - comentarios
 * Nota: A tabela de usuários e tokens de autenticação é de responsabilidade do Auth-Service.
 */
export async function initDatabase(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Catalog-DB] Conectando ao MariaDB em ${dbConfig.host}:${dbConfig.port}... (tentativa ${attempt}/${retries})`);
      const connection = await pool.getConnection();

      console.log('[Catalog-DB] Conexão estabelecida com sucesso. Verificando tabelas do AniTrack...');

      // 0. Garante a existência da tabela usuarios para satisfazer as chaves estrangeiras
      await connection.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          senha_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'usuario',
          bio VARCHAR(500) DEFAULT '',
          foto_perfil VARCHAR(255) DEFAULT NULL,
          banner_perfil VARCHAR(255) DEFAULT NULL,
          is_premium BOOLEAN DEFAULT FALSE,
          stripe_customer_id VARCHAR(255) DEFAULT NULL,
          stripe_subscription_id VARCHAR(255) DEFAULT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 1. Tabela de Animes Assistidos
      await connection.query(`
        CREATE TABLE IF NOT EXISTS animes_assistidos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          anime_id INT NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          poster_url VARCHAR(255),
          episodios_vistos INT DEFAULT 0,
          total_episodios INT DEFAULT 12,
          nota INT DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'concluido',
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          UNIQUE KEY uq_usuario_assistido (usuario_id, anime_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 2. Tabela de Animes que Irá Ver (Watchlist / Plan to Watch)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS animes_ira_ver (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          anime_id INT NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          poster_url VARCHAR(255),
          previsao_estreia VARCHAR(100),
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          UNIQUE KEY uq_usuario_ira_ver (usuario_id, anime_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 3. Tabela de Animes Favoritos
      await connection.query(`
        CREATE TABLE IF NOT EXISTS animes_favoritos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          anime_id INT NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          poster_url VARCHAR(255),
          fixado BOOLEAN DEFAULT FALSE,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          UNIQUE KEY uq_usuario_favorito (usuario_id, anime_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Garante a coluna fixado caso a tabela animes_favoritos já exista
      try {
        const [fixCols] = await connection.query(`SHOW COLUMNS FROM animes_favoritos LIKE 'fixado'`);
        if (fixCols.length === 0) {
          console.log('[Catalog-DB] Adicionando coluna "fixado" na tabela animes_favoritos...');
          await connection.query(`ALTER TABLE animes_favoritos ADD COLUMN fixado BOOLEAN DEFAULT FALSE AFTER poster_url`);
        }
      } catch (err) {
        console.warn('[Catalog-DB] Aviso ao checar coluna fixado em animes_favoritos:', err.message);
      }

      // 4. Tabela de Animes (Recurso Principal do Domínio)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS animes (
          id INT PRIMARY KEY,
          titulo VARCHAR(255) NOT NULL,
          titulo_romaji VARCHAR(255) DEFAULT NULL,
          sinopse TEXT DEFAULT NULL,
          poster_url VARCHAR(500) DEFAULT NULL,
          banner_url VARCHAR(500) DEFAULT NULL,
          episodios INT DEFAULT 12,
          status VARCHAR(50) DEFAULT 'RELEASING',
          formato VARCHAR(50) DEFAULT 'TV',
          temporada VARCHAR(20) DEFAULT 'FALL',
          ano INT DEFAULT 2026,
          generos VARCHAR(255) DEFAULT 'Ação, Fantasia',
          score INT DEFAULT 85,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 5. Tabela de Comentários
      await connection.query(`
        CREATE TABLE IF NOT EXISTS comentarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          anime_id INT NOT NULL,
          texto TEXT NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Garante colunas de perfil e Stripe na tabela de usuários caso existam
      try {
        const [bioCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'bio'`);
        if (bioCols.length === 0) {
          await connection.query(`ALTER TABLE usuarios ADD COLUMN bio VARCHAR(500) DEFAULT '' AFTER role`);
        }
        const [fotoCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'foto_perfil'`);
        if (fotoCols.length === 0) {
          await connection.query(`ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR(255) DEFAULT NULL AFTER bio`);
        }
        const [bannerCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'banner_perfil'`);
        if (bannerCols.length === 0) {
          console.log('[Catalog-DB] Adicionando coluna "banner_perfil" na tabela usuarios...');
          await connection.query(`ALTER TABLE usuarios ADD COLUMN banner_perfil VARCHAR(255) DEFAULT NULL AFTER foto_perfil`);
        }
        const [premiumCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'is_premium'`);
        if (premiumCols.length === 0) {
          console.log('[Catalog-DB] Adicionando coluna "is_premium" na tabela usuarios...');
          await connection.query(`ALTER TABLE usuarios ADD COLUMN is_premium BOOLEAN DEFAULT FALSE AFTER foto_perfil`);
        }
        const [stripeCustCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'stripe_customer_id'`);
        if (stripeCustCols.length === 0) {
          console.log('[Catalog-DB] Adicionando coluna "stripe_customer_id" na tabela usuarios...');
          await connection.query(`ALTER TABLE usuarios ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL AFTER is_premium`);
        }
        const [stripeSubCols] = await connection.query(`SHOW COLUMNS FROM usuarios LIKE 'stripe_subscription_id'`);
        if (stripeSubCols.length === 0) {
          console.log('[Catalog-DB] Adicionando coluna "stripe_subscription_id" na tabela usuarios...');
          await connection.query(`ALTER TABLE usuarios ADD COLUMN stripe_subscription_id VARCHAR(255) DEFAULT NULL AFTER stripe_customer_id`);
        }
      } catch (err) {
        console.warn('[Catalog-DB] Aviso ao checar colunas da tabela usuarios:', err.message);
      }

      // 5. Assegura existência do usuário administrador padrão (acesso específico / chaves de admin)
      try {
        const [adminRows] = await connection.query(
          "SELECT id, role FROM usuarios WHERE email = 'admin@anitrack.com'"
        );
        if (adminRows.length === 0) {
          console.log('[Catalog-DB] Semeando usuário administrador padrão (admin@anitrack.com)...');
          await connection.query(
            `INSERT INTO usuarios (id, nome, email, senha_hash, role, bio, is_premium)
             VALUES (1, 'Admin AniTrack', 'admin@anitrack.com', '$2b$10$9LX8NRtit7sw3VwbnzjCCuFVbHYLgZm72jAbbRgQ776gkoFZFPdiW', 'admin', 'Administrador da plataforma e curador oficial do catálogo.', TRUE)
             ON DUPLICATE KEY UPDATE role = 'admin', nome = VALUES(nome);`
          );
        } else if (adminRows[0].role !== 'admin') {
          console.log('[Catalog-DB] Assegurando privilégios de administrador para admin@anitrack.com...');
          await connection.query(
            "UPDATE usuarios SET role = 'admin' WHERE email = 'admin@anitrack.com'"
          );
        }
      } catch (adminErr) {
        console.warn('[Catalog-DB] Aviso ao checar administrador padrão:', adminErr.message);
      }

      connection.release();
      console.log('[Catalog-DB] Tabelas do AniTrack verificadas com sucesso.');
      return true;
    } catch (err) {
      console.error(`[Catalog-DB] Erro ao conectar ao banco (tentativa ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        console.log(`[Catalog-DB] Aguardando ${delayMs / 1000}s antes da próxima tentativa...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('[Catalog-DB] Falha crítica ao conectar com o MariaDB após várias tentativas.');
        return false;
      }
    }
  }
  return false;
}
