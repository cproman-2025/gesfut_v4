import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_POSTGREST_URL || 'http://localhost:3000';
const supabaseKey = 'your-anon-key'; // For PostgREST, you might not need this

// Create Supabase client configured to work with PostgREST
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Disable auth since we're using PostgREST directly
  },
  realtime: {
    enabled: false, // Disable realtime features
  },
});

// Database helper functions
export class DatabaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_POSTGREST_URL || 'http://localhost:3000';
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Database request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Generic CRUD operations
  async select(table: string, filters?: Record<string, any>, orderBy?: string) {
    let endpoint = `/${table}`;
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });
    }

    if (orderBy) {
      params.append('order', orderBy);
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.request(endpoint);
  }

  async insert(table: string, data: any) {
    return this.request(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(table: string, id: string, data: any) {
    return this.request(`/${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(table: string, id: string) {
    return this.request(`/${table}?id=eq.${id}`, {
      method: 'DELETE',
    });
  }

  // Specific methods for complex queries
  async getClubTeams(clubId: string) {
    return this.select('teams', { club_id: clubId }, 'name');
  }

  async getTeamPlayers(teamId: string) {
    return this.select('players', { team_id: teamId }, 'name');
  }

  async getClubPlayers(clubId: string) {
    return this.select('players', { club_id: clubId }, 'name');
  }

  async getUsersByClub(clubId: string) {
    return this.select('users', { club_id: clubId }, 'name');
  }

  async getMatchesByTeam(teamId: string) {
    const homeMatches = await this.request(`/matches?home_team_id=eq.${teamId}&order=date.desc`);
    const awayMatches = await this.request(`/matches?away_team_id=eq.${teamId}&order=date.desc`);
    return [...homeMatches, ...awayMatches].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getTrainingSessionsByClub(clubId: string) {
    return this.select('training_sessions', { club_id: clubId }, 'date.desc');
  }

  async getPostsOrderedByDate() {
    return this.select('posts', undefined, 'timestamp.desc');
  }
}

export const db = new DatabaseService();