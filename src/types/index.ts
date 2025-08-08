

import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

export interface Club {
  id: string;
  name: string;
  logoUrl?: string;
  isDefault?: boolean;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface Team {
  id: string;
  name: string;
  clubId: string;
  logoUrl?: string;
  category?: string;
  coachId?: string;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface PlayerCallUp {
  matchId: string;
  opponentName: string;
  matchDate: string; // ISO date string
  status: 'Convocado' | 'No Convocado';
  playerTeamName: string;
  competition?: string | null;
  finalScore?: string;
  minutesPlayed?: number | null;
  goals?: number | null;
  assists?: number | null;
  yellowCards?: number | null;
  redCard?: boolean | null; 
  rating?: number | null;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamLogoUrl?: string | null;
  awayTeamLogoUrl?: string | null;
}

export interface PlayerEvaluation {
  id: string; // Unique ID for the evaluation entry
  season: string;
  period: 'Inicio Temporada' | 'Mitad Temporada' | 'Final Temporada';
  notes: string;
  evaluationDate: string; // ISO date string
  coachId: string;
  coachName?: string;
}

export type InjuryStatus = 'Activa' | 'En Recuperación' | 'Recuperado' | 'Secuelas';

export interface InjuryRecord {
  id: string; // Unique ID for the injury entry
  playerId: string;
  injuryType: string;
  description?: string;
  startDate: string; // ISO date string
  estimatedReturnDate?: string; // ISO date string
  actualReturnDate?: string; // ISO date string
  status: InjuryStatus;
  notes?: string;
}

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  position: 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero' | string;
  dateOfBirth: string; // YYYY-MM-DD
  teamId: string;
  clubId?: string;
  jerseyNumber?: number;

  passportNumber?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;

  medicalExamDate?: string; // YYYY-MM-DD

  [key: string]: any; // For dynamic profile fields

  height?: string;
  weight?: string;
  preferredFoot?: 'Izquierdo' | 'Derecho' | 'Ambidiestro';

  allergies?: string;
  medicalConditions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  avatarUrl?: string;
  
  callUpHistory?: PlayerCallUp[];
  playerEvaluations?: PlayerEvaluation[];
  injuryHistory?: InjuryRecord[];

  isActive?: boolean;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export type UserRole = 'Administrador' | 'Entrenador' | 'Jugador' | 'Tutor' | 'Directivo Club';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: 'Active' | 'Pending'; // Added for unified user/invitation list
  password?: string;
  phone?: string;
  avatarUrl?: string;
  clubId?: string | null; // Allow null for Admin
  teamId?: string | null; // Allow null
  managedTeamIds?: string[];
  playerId?: string | null; // Allow null
  linkedPlayerIds?: string[];
  lightTheme?: string;
  darkTheme?: string;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  imageUrl?: string;
  timestamp: FirestoreTimestamp | Date;
  likes: number;
  commentsCount: number;
  likedBy?: string[];
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  timestamp: FirestoreTimestamp | Date; // Updated for Firestore
  createdAt?: FirestoreTimestamp | Date;
}

export interface Notification {
  id: string;
  userId: string; 
  title: string;
  message: string;
  timestamp: FirestoreTimestamp | Date; 
  read: boolean;
  link?: string;
  iconName?: string; // Changed from icon: React.ElementType
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface PlayerProfileField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  section: 'Personal' | 'Deportivo' | 'Médico';
  isDefault: boolean;
  isActive: boolean;
}


export interface MatchCallSheetItem {
  playerId: string;
  status: 'Convocado' | 'No Convocado';
  minutesPlayed?: number | null;
  goals?: number | null;
  assists?: number | null;
  yellowCards?: number | null;
  redCard?: boolean | null; 
  rating?: number | null;
}


export interface Match {
  id: string;
  date: FirestoreTimestamp | Date;
  time: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogoUrl?: string | null;
  awayTeamLogoUrl?: string | null;
  location?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: 'Programado' | 'En Progreso' | 'Finalizado' | 'Pospuesto' | 'Cancelado';
  competition?: string | null;
  notes?: string | null;
  callSheet?: MatchCallSheetItem[];
  matchIncidents?: string | null;
  rivalTeamInfo?: string | null;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
  competitionId?: string | null;
}

export type TrainingTaskCategory = 'Calentamiento' | 'Técnica' | 'Táctica' | 'Físico' | 'Partido' | 'Otro';

export interface TrainingTask {
  id: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  category?: TrainingTaskCategory;
  imageUrl?: string;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface TrainingSessionTask {
  drillId: string;
  durationMinutes?: number;
}

export interface TrainingSession {
  id: string;
  teamId: string;
  clubId?: string;
  date: FirestoreTimestamp | Date; 
  time: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  coachNotes?: string;
  tasks?: TrainingSessionTask[]; 
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface TrainingAttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  status: 'Presente' | 'Ausente' | 'Tarde';
  justified: boolean;
  notes?: string;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date; 
  rating?: number;
}

export type MatchDayPlayerStatus =
  | 'Presente y Disponible'
  | 'Presente (No disponible - Lesión)'
  | 'Presente (No disponible - Otro)'
  | 'Ausente (Aviso Previo)'
  | 'Ausente (Sin Aviso)'
  | 'Retraso';

export interface MatchDayPresenceRecord {
  id: string;
  matchId: string;
  playerId: string;
  status: MatchDayPlayerStatus;
  notes?: string;
  createdAt?: FirestoreTimestamp | Date;
}

export interface RivalTeam {
  id: string;
  name: string;
  logoUrl?: string;
  fieldLocation?: string;
}

export interface LeagueCompetition {
  id: string;
  name: string;
  assignedClubTeamId: string;
  rivals: RivalTeam[];
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface MatchCallSheetItem as GenkitMatchCallSheetItem {
  playerId: string;
  status: string;
  goals?: number;
}

export interface AppSettings {
  isRegistrationEnabled?: boolean;
  menuPermissions?: Record<string, UserRole[]>; // Key is nav item href, value is array of allowed roles
  authPagesLogoClubId?: string; 
  authPagesCustomLogoUrl?: string; // For the custom uploaded logo Data URI
  defaultLightTheme?: string;
  defaultDarkTheme?: string;
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}

export interface ReportTemplate {
  id: string;
  name: string;
  clubId: string;
  selectedFields: string[];
  createdAt?: FirestoreTimestamp | Date;
  updatedAt?: FirestoreTimestamp | Date;
}


// --- Tactical Board Pro Types ---

export type TacticsPlayer = {
  id: string;
  name: string;
  nickname?: string;
  number: number;
  position: 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero' | string;
  team: 'home' | 'away';
  color: string;
  avatarUrl?: string;
};

export type DrawingType = 'pencil' | 'line' | 'arrow' | 'circle' | 'rectangle' | 'text' | 'dashed-line' | 'curved-arrow' | 'shaded-area';
export type BoardTool = DrawingType | 'move' | 'eraser' | 'selection';
export type BoardElementType = 'player' | 'ball' | 'cone' | 'goal' | 'text' | 'shape';

export type Drawing = {
  id: string;
  type: DrawingType;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  text?: string;
};

export type BoardItem = {
  id: string; // Unique ID for the item on the board
  type: BoardElementType;
  elementId: string; // ID of the player or object type
  position: { x: number; y: number }; // Position as percentage (0 to 1)
  data: any; // Can be TacticsPlayer, shape data, etc.
  scale?: number;
  rotation?: number;
};


export interface TacticalFormation {
  id: string;
  name: string;
  isCustom: boolean;
  authorId?: string;
  positions: {
    home: { x: number; y: number }[];
  };
  createdAt?: FirestoreTimestamp;
}


export interface Tactic {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  teamId?: string;
  previewImageUrl?: string;
  orientation?: 'horizontal' | 'vertical';
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
