-- ============================================================================
-- AniTrack — Migração e Seed do Banco de Dados MariaDB
-- Arquivo: db/001_dominio.sql
-- Domínio: Plataforma SaaS de Gestão de Animes, Simulcasts e Listas Pessoais
-- ============================================================================

CREATE DATABASE IF NOT EXISTS anitrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE anitrack_db;

-- ----------------------------------------------------------------------------
-- 1. TABELA: usuarios (Entidade de Usuários e Autenticação Central)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'otaku',
  bio VARCHAR(500) DEFAULT '',
  foto_perfil VARCHAR(255) DEFAULT NULL,
  banner_perfil VARCHAR(255) DEFAULT NULL,
  is_premium BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(255) DEFAULT NULL,
  stripe_subscription_id VARCHAR(255) DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TABELA: animes (Recurso Principal do Domínio de Negócio)
-- ----------------------------------------------------------------------------
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TABELA: animes_assistidos (Histórico de Progresso do Usuário)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animes_assistidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  anime_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  poster_url VARCHAR(500) DEFAULT NULL,
  episodios_vistos INT DEFAULT 0,
  total_episodios INT DEFAULT 12,
  nota INT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'concluido',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_assistido (usuario_id, anime_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. TABELA: animes_ira_ver (Fila de Espera / Watchlist)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animes_ira_ver (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  anime_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  poster_url VARCHAR(500) DEFAULT NULL,
  previsao_estreia VARCHAR(100) DEFAULT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_ira_ver (usuario_id, anime_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. TABELA: animes_favoritos (Títulos Favoritados pelo Usuário)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animes_favoritos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  anime_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  poster_url VARCHAR(500) DEFAULT NULL,
  fixado BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_favorito (usuario_id, anime_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. TABELA: comentarios (Comentários e Resenhas Comunitárias por Anime)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comentarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  anime_id INT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. TABELA: reset_tokens (Recuperação Segura de Senha)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expira_em DATETIME NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED DATA (Dados Iniciais do Domínio para Testes e Demonstração)
-- Senha padrão dos usuários de teste: Senha123!
-- Hash Bcrypt correspondente: $2b$10$9LX8NRtit7sw3VwbnzjCCuFVbHYLgZm72jAbbRgQ776gkoFZFPdiW
-- ============================================================================

-- Inserção de Usuários com os 3 Papéis do Negócio: admin, critico, otaku
INSERT INTO usuarios (id, nome, email, senha_hash, role, bio, is_premium)
VALUES 
  (1, 'Admin AniTrack', 'admin@anitrack.com', '$2b$10$9LX8NRtit7sw3VwbnzjCCuFVbHYLgZm72jAbbRgQ776gkoFZFPdiW', 'admin', 'Administrador da plataforma e curador oficial do catálogo.', TRUE),
  (2, 'Crítico Renan', 'critico@anitrack.com', '$2b$10$9LX8NRtit7sw3VwbnzjCCuFVbHYLgZm72jAbbRgQ776gkoFZFPdiW', 'critico', 'Crítico especializado em animes sazonais e resenhas da comunidade.', TRUE),
  (3, 'Otaku João', 'otaku@anitrack.com', '$2b$10$9LX8NRtit7sw3VwbnzjCCuFVbHYLgZm72jAbbRgQ776gkoFZFPdiW', 'otaku', 'Fã assíduo de shonen e animes de fantasia.', FALSE)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Inserção de Animes do Catálogo Local (Recurso Principal)
INSERT INTO animes (id, titulo, titulo_romaji, sinopse, poster_url, banner_url, episodios, status, formato, temporada, ano, generos, score)
VALUES
  (154587, 'Sousou no Frieren', 'Frieren: Beyond Journey\'s End', 'A maga elfa Frieren e seus companheiros heróis derrotaram o Rei Demônio e trouxeram paz à terra. Anos após o fim da batalha, Frieren reflete sobre a mortalidade de seus amigos humanos e parte em uma nova jornada.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gviomerpgqmU.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-21a4KzB1826J.jpg', 28, 'FINISHED', 'TV', 'FALL', 2023, 'Aventura, Drama, Fantasia', 91),
  (151807, 'Solo Leveling', 'Ore dake Level Up na Ken', 'Em um mundo onde caçadores despertam habilidades mágicas para enfrentar monstros de masmorras mortais, Sung Jinwoo é conhecido como o caçador mais fraco da humanidade, até encontrar uma missão secreta única.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-3Lrcd4W9qX7m.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-itJq1j2K0zI6.jpg', 12, 'FINISHED', 'TV', 'WINTER', 2024, 'Ação, Aventura, Fantasia', 83),
  (16498, 'Shingeki no Kyojin', 'Attack on Titan', 'Após sua cidade natal ser destruída e sua mãe ser morta, o jovem Eren Jaeger promete limpar a terra dos gigantescos Titãs humanóides que levaram a humanidade à beira da extinção.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg', 25, 'FINISHED', 'TV', 'SPRING', 2013, 'Ação, Drama, Fantasia, Mistério', 85),
  (101922, 'Kimetsu no Yaiba', 'Demon Slayer: Kimetsu no Yaiba', 'Tanjiro Kamado é um garoto de bom coração que vende carvão para sustentar sua família. Um dia, sua família é massacrada por um demônio e sua irmã Nezuko é transformada em oni.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYwgvr.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-YfZhFlNOafL2.jpg', 26, 'FINISHED', 'TV', 'SPRING', 2019, 'Ação, Fantasia, Sobrenatural', 84),
  (113415, 'Jujutsu Kaisen', 'Jujutsu Kaisen', 'Yuji Itadori é um estudante do ensino médio comum que acaba engolindo o dedo podre de Ryomen Sukuna, o Rei das Maldições, entrando no perigoso mundo dos Feiticeiros Jujutsu.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pTvaw2.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQGo7GlDQJbh.jpg', 24, 'FINISHED', 'TV', 'FALL', 2020, 'Ação, Fantasia, Sobrenatural', 86),
  (140960, 'Spy x Family', 'SPY×FAMILY', 'Para manter a paz entre nações rivais, o espião de codinome Twilight precisa forjar uma família de mentira. O que ele não sabe é que sua esposa é uma assassina de aluguel e sua filha adotiva tem poderes telepatas.', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-aRj9fDyeaH2S.jpg', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/140960-j4x6l0699s5r.jpg', 25, 'FINISHED', 'TV', 'SPRING', 2022, 'Ação, Comédia', 85)
ON DUPLICATE KEY UPDATE titulo = VALUES(titulo);

-- Inserção de Histórico de Animes Assistidos
INSERT INTO animes_assistidos (usuario_id, anime_id, titulo, poster_url, episodios_vistos, total_episodios, nota, status)
VALUES
  (3, 154587, 'Sousou no Frieren', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gviomerpgqmU.jpg', 28, 28, 10, 'concluido'),
  (3, 151807, 'Solo Leveling', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-3Lrcd4W9qX7m.jpg', 8, 12, 9, 'assistindo'),
  (2, 16498, 'Shingeki no Kyojin', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg', 25, 25, 10, 'concluido')
ON DUPLICATE KEY UPDATE nota = VALUES(nota);

-- Inserção de Watchlist (Irá Ver)
INSERT INTO animes_ira_ver (usuario_id, anime_id, titulo, poster_url, previsao_estreia)
VALUES
  (3, 140960, 'Spy x Family', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-aRj9fDyeaH2S.jpg', 'Próxima Temporada'),
  (2, 113415, 'Jujutsu Kaisen', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pTvaw2.jpg', 'Fim de Semana')
ON DUPLICATE KEY UPDATE previsao_estreia = VALUES(previsao_estreia);

-- Inserção de Favoritos
INSERT INTO animes_favoritos (usuario_id, anime_id, titulo, poster_url, fixado)
VALUES
  (3, 154587, 'Sousou no Frieren', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gviomerpgqmU.jpg', TRUE),
  (2, 16498, 'Shingeki no Kyojin', 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg', TRUE)
ON DUPLICATE KEY UPDATE fixado = VALUES(fixado);

-- Inserção de Comentários
INSERT INTO comentarios (usuario_id, anime_id, texto)
VALUES
  (2, 154587, 'Obra-prima absoluta da animação e narrativa contemporânea. Trilha sonora e ritmo impecáveis.'),
  (3, 154587, 'Um dos melhores animes de todos os tempos! A jornada de Frieren emociona do início ao fim.'),
  (3, 151807, 'A animação das lutas está simplesmente insana!')
ON DUPLICATE KEY UPDATE texto = VALUES(texto);
