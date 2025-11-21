-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert seed data
INSERT INTO users (id, name, avatar_url) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Eoin', '/Users/Eoin.png'),
  ('00000000-0000-0000-0000-000000000002', 'Katie', '/Users/Katie.png'),
  ('00000000-0000-0000-0000-000000000003', 'Conor', '/Users/Conor.png')
ON CONFLICT (id) DO NOTHING;

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

