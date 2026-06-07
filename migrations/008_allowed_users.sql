CREATE TABLE IF NOT EXISTS allowed_users (
  id         SERIAL PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO allowed_users (email, name, role) VALUES
  ('marlondev986@gmail.com', 'Marlon',           'superadmin'),
  ('gabrielzamr@gmail.com',  'Gabriel Zambrano', 'owner')
ON CONFLICT (email) DO NOTHING;
