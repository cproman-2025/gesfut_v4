// Simple authentication service for local development
// In production, you'd want to use a proper auth service like Auth0, Clerk, or implement JWT

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: ((user: AuthUser | null) => void)[] = [];

  constructor() {
    // Load user from localStorage on initialization
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('gesfut_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    // Simple mock authentication - replace with real auth
    // For now, we'll just check if user exists in database
    try {
      const users = await fetch(`${process.env.NEXT_PUBLIC_POSTGREST_URL}/users?email=eq.${email}`)
        .then(res => res.json());
      
      if (users.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const user = users[0];
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      this.currentUser = authUser;
      localStorage.setItem('gesfut_user', JSON.stringify(authUser));
      this.notifyListeners();
      
      return authUser;
    } catch (error) {
      throw new Error('Error de autenticación');
    }
  }

  async signUp(email: string, password: string, name: string): Promise<AuthUser> {
    // Simple mock registration
    try {
      const newUser = await fetch(`${process.env.NEXT_PUBLIC_POSTGREST_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          email,
          name,
          role: 'Jugador',
          status: 'Active',
        }),
      }).then(res => res.json());

      const authUser: AuthUser = {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
      };

      this.currentUser = authUser;
      localStorage.setItem('gesfut_user', JSON.stringify(authUser));
      this.notifyListeners();
      
      return authUser;
    } catch (error) {
      throw new Error('Error al crear cuenta');
    }
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('gesfut_user');
    this.notifyListeners();
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.push(callback);
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }
}

export const auth = new AuthService();