-- GesFUT Database Schema
-- This script initializes the PostgreSQL database with all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('Administrador', 'Entrenador', 'Jugador', 'Tutor', 'Directivo Club');
CREATE TYPE match_status AS ENUM ('Programado', 'En Progreso', 'Finalizado', 'Pospuesto', 'Cancelado');
CREATE TYPE training_task_category AS ENUM ('Calentamiento', 'Técnica', 'Táctica', 'Físico', 'Partido', 'Otro');
CREATE TYPE injury_status AS ENUM ('Activa', 'En Recuperación', 'Recuperado', 'Secuelas');
CREATE TYPE attendance_status AS ENUM ('Presente', 'Ausente', 'Tarde');
CREATE TYPE callup_status AS ENUM ('Convocado', 'No Convocado');

-- Clubs table
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    category TEXT,
    coach_id UUID,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'Jugador',
    status TEXT DEFAULT 'Active',
    phone TEXT,
    avatar_url TEXT,
    club_id UUID REFERENCES clubs(id),
    team_id UUID REFERENCES teams(id),
    managed_team_ids UUID[],
    player_id UUID,
    linked_player_ids UUID[],
    light_theme TEXT DEFAULT 'default',
    dark_theme TEXT DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    nickname TEXT,
    position TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id),
    jersey_number INTEGER,
    passport_number TEXT,
    nationality TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    medical_exam_date DATE,
    height TEXT,
    weight TEXT,
    preferred_foot TEXT,
    allergies TEXT,
    medical_conditions TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMPTZ NOT NULL,
    time TEXT NOT NULL,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    home_team_name TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    home_team_logo_url TEXT,
    away_team_logo_url TEXT,
    location TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status match_status DEFAULT 'Programado',
    competition TEXT,
    notes TEXT,
    match_incidents TEXT,
    rival_team_info TEXT,
    competition_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training sessions table
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id),
    date TIMESTAMPTZ NOT NULL,
    time TEXT NOT NULL,
    duration_minutes INTEGER,
    location TEXT,
    description TEXT,
    coach_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training attendance table
CREATE TABLE training_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status attendance_status NOT NULL,
    justified BOOLEAN DEFAULT FALSE,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar_url TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    likes INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    liked_by UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar_url TEXT,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player call-up history table
CREATE TABLE player_callups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    opponent_name TEXT NOT NULL,
    match_date DATE NOT NULL,
    status callup_status NOT NULL,
    player_team_name TEXT NOT NULL,
    competition TEXT,
    final_score TEXT,
    minutes_played INTEGER,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_card BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    home_team_name TEXT,
    away_team_name TEXT,
    home_team_logo_url TEXT,
    away_team_logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player evaluations table
CREATE TABLE player_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    period TEXT NOT NULL,
    notes TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    coach_id UUID NOT NULL,
    coach_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Injury records table
CREATE TABLE injury_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    injury_type TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    estimated_return_date DATE,
    actual_return_date DATE,
    status injury_status NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training tasks library table
CREATE TABLE training_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER,
    category training_task_category,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- League competitions table
CREATE TABLE league_competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    assigned_club_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    rivals JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tactics table
CREATE TABLE tactics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    team_id UUID REFERENCES teams(id),
    preview_image_url TEXT,
    orientation TEXT DEFAULT 'horizontal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tactic board items table
CREATE TABLE tactic_board_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tactic_id UUID REFERENCES tactics(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    type TEXT NOT NULL,
    element_id TEXT NOT NULL,
    position_x DECIMAL NOT NULL,
    position_y DECIMAL NOT NULL,
    data JSONB NOT NULL,
    scale DECIMAL DEFAULT 1,
    rotation DECIMAL DEFAULT 0
);

-- Tactic drawings table
CREATE TABLE tactic_drawings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tactic_id UUID REFERENCES tactics(id) ON DELETE CASCADE,
    drawing_id TEXT NOT NULL,
    type TEXT NOT NULL,
    points JSONB NOT NULL,
    color TEXT NOT NULL,
    stroke_width INTEGER NOT NULL,
    text TEXT
);

-- App settings table
CREATE TABLE app_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    is_registration_enabled BOOLEAN DEFAULT TRUE,
    menu_permissions JSONB DEFAULT '{}'::jsonb,
    auth_pages_logo_club_id UUID,
    auth_pages_custom_logo_url TEXT,
    default_light_theme TEXT DEFAULT 'default',
    default_dark_theme TEXT DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player profile fields configuration
CREATE TABLE player_profile_fields (
    id TEXT PRIMARY KEY DEFAULT 'config',
    fields JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_teams_club_id ON teams(club_id);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_club_id ON players(club_id);
CREATE INDEX idx_users_club_id ON users(club_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_training_sessions_team_id ON training_sessions(team_id);
CREATE INDEX idx_training_sessions_date ON training_sessions(date);
CREATE INDEX idx_training_attendance_session_id ON training_attendance(session_id);
CREATE INDEX idx_training_attendance_player_id ON training_attendance(player_id);
CREATE INDEX idx_posts_timestamp ON posts(timestamp);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_player_callups_player_id ON player_callups(player_id);
CREATE INDEX idx_player_callups_match_id ON player_callups(match_id);
CREATE INDEX idx_tactics_author_id ON tactics(author_id);

-- Create RLS policies (Row Level Security)
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (you can customize these based on your needs)
CREATE POLICY "Allow all operations for authenticated users" ON clubs FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON training_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON training_attendance FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON posts FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON comments FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON tactics FOR ALL USING (true);

-- Insert default data
INSERT INTO clubs (name, logo_url, is_default) VALUES 
('A.D. Alhóndiga', 'https://placehold.co/100x100.png?text=ADA', true);

INSERT INTO app_settings (id, is_registration_enabled) VALUES 
('global', true);