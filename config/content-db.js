const { pool } = require('./database');

async function initContentDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section VARCHAR(50) NOT NULL DEFAULT 'studio',
      subsection VARCHAR(100),
      content TEXT,
      media_type VARCHAR(20),
      media_url TEXT,
      title VARCHAR(255),
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS post_media (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      media_type VARCHAR(20) NOT NULL,
      media_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_post_media_post_id
      ON post_media(post_id);

    CREATE INDEX IF NOT EXISTS idx_post_media_sort_order
      ON post_media(post_id, sort_order);

    CREATE TABLE IF NOT EXISTS post_likes (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS post_shares (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS subsection VARCHAR(100);

    CREATE INDEX IF NOT EXISTS idx_posts_section
      ON posts(section);

    CREATE INDEX IF NOT EXISTS idx_posts_subsection
      ON posts(subsection);

    CREATE INDEX IF NOT EXISTS idx_posts_created_at
      ON posts(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
      ON post_comments(post_id);

    CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
      ON post_likes(post_id);
  `);

  console.log('✅ Content database initialized');
}

module.exports = { initContentDatabase };

