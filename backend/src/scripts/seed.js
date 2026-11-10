import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env da raiz do projeto ou da pasta backend
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'anitrack_db',
  multipleStatements: true,
  charset: 'utf8mb4'
};

async function runSeed() {
  console.log('🌸 [AniTrack Seed] Iniciando migração e seed do banco de dados...');
  console.log(`🔌 Conectando ao MariaDB em ${dbConfig.host}:${dbConfig.port} (Base: ${dbConfig.database})...`);

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso!');

    const sqlFilePath = path.resolve(__dirname, '../../../db/001_dominio.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado no caminho: ${sqlFilePath}`);
    }

    let sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Remove comandos que tentam recriar ou forçar troca de database quando conectado na nuvem/GCP
    // Isso garante compatibilidade total tanto com bancos locais quanto com a base da disciplina (IAC_2026_02_felipe_shida)
    sqlContent = sqlContent
      .replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/gi, '-- CREATE DATABASE ignorado para compatibilidade')
      .replace(/USE [^;]+;/gi, '-- USE ignorado para compatibilidade');

    console.log('📜 Executando script SQL de migração e seeds (db/001_dominio.sql)...');
    await connection.query(sqlContent);

    // Validação dos dados inseridos
    const [usuarios] = await connection.query('SELECT id, nome, email, role FROM usuarios');
    const [animes] = await connection.query('SELECT COUNT(*) as total FROM animes');
    const [assistidos] = await connection.query('SELECT COUNT(*) as total FROM animes_assistidos');
    const [favoritos] = await connection.query('SELECT COUNT(*) as total FROM animes_favoritos');
    const [comentarios] = await connection.query('SELECT COUNT(*) as total FROM comentarios');

    console.log('\n✨ Migração e Seed concluídos com sucesso!');
    console.log('----------------------------------------------------');
    console.log(`👥 Usuários cadastrados (${usuarios.length}):`);
    usuarios.forEach((u) => console.log(`   - [${u.role.toUpperCase()}] ${u.nome} <${u.email}>`));
    console.log(`🎬 Animes semeados no catálogo: ${animes[0]?.total || 0}`);
    console.log(`👁️ Histórico de assistidos: ${assistidos[0]?.total || 0}`);
    console.log(`⭐ Animes favoritados: ${favoritos[0]?.total || 0}`);
    console.log(`💬 Comentários comunitários: ${comentarios[0]?.total || 0}`);
    console.log('----------------------------------------------------');
    console.log('🔑 Senha padrão dos usuários de teste: Senha123!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Falha ao executar migração e seed:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runSeed();
