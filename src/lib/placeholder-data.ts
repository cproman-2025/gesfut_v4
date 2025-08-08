

import type { Player, User, Post, PostComment, Notification, PlayerProfileField, UserRole, Club, Team, Match, TrainingSession, TrainingAttendanceRecord, PlayerCallUp, MatchCallSheetItem, MatchDayPlayerStatus, TrainingTask, TrainingTaskCategory, LeagueCompetition, RivalTeam, PlayerEvaluation, InjuryRecord, InjuryStatus } from '@/types';
import { Users, BarChart3, CalendarDays, ShieldCheck } from 'lucide-react';
import { db } from './database'; // Import database service

export let placeholderDataVersion = 0; 

export let placeholderClubs: Club[] = [
  { id: 'club1', name: 'A.D. Alhóndiga', logoUrl: 'https://placehold.co/100x100.png?text=ADA', isDefault: true },
  { id: 'club2', name: 'Real Ejemplo CF', logoUrl: 'https://placehold.co/100x100.png?text=RECF', isDefault: false },
  { id: 'club3', name: 'Atlético Demo', logoUrl: 'https://placehold.co/100x100.png?text=AD', isDefault: false },
  { id: 'u6club', name: 'Club de Carlos', logoUrl: 'https://placehold.co/100x100.png?text=CCP', isDefault: false },
].sort((a,b) => a.name.localeCompare(b.name));

export function addPlaceholderClub(newClub: Club) { /* Firestore direct */ }
export function updatePlaceholderClub(updatedClub: Club) { /* Firestore direct */ }
export function deletePlaceholderClub(clubId: string) { /* Firestore direct */ }


export let placeholderTeams: Team[] = [
  { id: 'team1', name: 'A.D. Alhóndiga Sub-18', clubId: 'club1', category: 'Sub-18', coachId: 'u2', logoUrl: 'https://placehold.co/80x80.png?text=ADAS18' },
  { id: 'team2', name: 'A.D. Alhóndiga Senior', clubId: 'club1', category: 'Senior', coachId: 'u2', logoUrl: 'https://placehold.co/80x80.png?text=ADASEN' },
  { id: 'team3', name: 'Real Ejemplo Juvenil', clubId: 'club2', category: 'Juvenil', coachId: 'u5', logoUrl: 'https://placehold.co/80x80.png?text=REJ' },
].sort((a,b) => a.name.localeCompare(b.name));

export function addPlaceholderTeam(newTeam: Team) { /* Firestore direct */ }
export function updatePlaceholderTeam(updatedTeam: Team) { /* Firestore direct */ }
export function deletePlaceholderTeam(teamId: string) { /* Firestore direct, cascade handled in component */ }


export let placeholderPlayers: Player[] = [
   { id: 'p1', name: 'Leo Messi', teamId: 'team1', clubId: 'club1', position: 'Delantero', dateOfBirth: '1987-06-24', jerseyNumber: 10, avatarUrl: 'https://placehold.co/80x80.png?text=LM', callUpHistory: [], playerEvaluations: [], injuryHistory: [] },
   { id: 'p2', name: 'Cristiano Ronaldo', teamId: 'team2', clubId: 'club1', position: 'Delantero', dateOfBirth: '1985-02-05', jerseyNumber: 7, avatarUrl: 'https://placehold.co/80x80.png?text=CR', callUpHistory: [], playerEvaluations: [], injuryHistory: [] },
   { id: 'p3', name: 'Neymar Jr', teamId: 'team3', clubId: 'club2', position: 'Delantero', dateOfBirth: '1992-02-05', jerseyNumber: 11, avatarUrl: 'https://placehold.co/80x80.png?text=NJ', callUpHistory: [], playerEvaluations: [], injuryHistory: [] },
];

export function updatePlaceholderPlayer(updatedPlayer: Player) { /* Firestore direct */ }
export function addPlaceholderPlayer(newPlayer: Player) { /* Firestore direct */ }
export function deletePlaceholderPlayer(playerId: string) { /* Firestore direct */ }


export const initialSeedUsers: User[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@example.com', role: 'Administrador', avatarUrl: 'https://placehold.co/40x40.png?text=AU' },
  { id: 'u2', name: 'Coach Pep', email: 'coach@example.com', role: 'Entrenador', clubId: 'club1', managedTeamIds: ['team1', 'team2'], avatarUrl: 'https://placehold.co/40x40.png?text=CP' },
  { id: 'u3', name: 'Player Leo (User)', email: 'player.leo@example.com', role: 'Jugador', clubId: 'club1', teamId: 'team1', playerId: 'p1', avatarUrl: 'https://placehold.co/40x40.png?text=PL' },
  { id: 'u4', name: 'Tutor Jorge', email: 'parent.jorge@example.com', role: 'Tutor', clubId: 'club1', teamId: 'team1', linkedPlayerIds: ['p1'], avatarUrl: 'https://placehold.co/40x40.png?text=TJ' },
  { id: 'u5', name: 'Manager Ana', email: 'manager.ana@example.com', role: 'Directivo Club', clubId: 'club2', avatarUrl: 'https://placehold.co/40x40.png?text=MA' },
  { id: 'u6', name: 'Carlos Proman', email: 'cproman@gmail.com', role: 'Administrador', avatarUrl: 'https://placehold.co/40x40.png?text=CP' },
];

export let users: User[] = []; // Populated from Firestore or seeded by AuthProvider

export async function getActiveUserClub(userId?: string): Promise<Club | undefined> {
    let userClubId: string | undefined;

    if (userId) {
        const users = await db.select('users', { id: userId });
        if (users.length > 0) {
            const userData = users[0] as User;
            userClubId = userData.club_id;
        }
    }

    if (userClubId) {
        const clubs = await db.select('clubs', { id: userClubId });
        if (clubs.length > 0) {
            return clubs[0] as Club;
        } else {
            console.warn(`getActiveUserClub: User ${userId} has clubId ${userClubId}, but club not found in database.`);
        }
    }
    
    // Fallback to default club from database
    const defaultClubs = await db.select('clubs', { is_default: true });

    if (defaultClubs.length > 0) {
        return defaultClubs[0] as Club;
    } else {
        console.warn("getActiveUserClub: No default club found in database. Falling back to hardcoded placeholder if available.");
        // Final fallback to hardcoded placeholder (less ideal)
        const hardcodedDefault = placeholderClubs.find(c => c.isDefault === true);
        if (hardcodedDefault) return hardcodedDefault;
        return placeholderClubs.length > 0 ? placeholderClubs[0] : undefined;
    }
}


export function updatePlaceholderUserRole(userId: string, newRole: UserRole) { console.warn("updatePlaceholderUserRole is deprecated. Use Firestore."); }
export function updatePlaceholderUser(updatedUser: User) { console.warn("updatePlaceholderUser is deprecated. Use Firestore."); }
export function deletePlaceholderUser(userId: string) { console.warn("deletePlaceholderUser is deprecated. Use Firestore."); }
export function addPlaceholderUser(newUser: User) { console.warn("addPlaceholderUser is deprecated. Use Firestore."); }


export const placeholderUserRoles: UserRole[] = ['Administrador', 'Entrenador', 'Jugador', 'Tutor', 'Directivo Club'];


export let placeholderPosts: Post[] = [
  { id: 'post1', authorId: 'u2', authorName: 'Coach Pep', authorAvatarUrl: initialSeedUsers.find(u => u.id === 'u2')?.avatarUrl, content: '¡Gran victoria hoy equipo! Demostraron mucho coraje y trabajo en equipo. #VamosAlhóndiga', imageUrl: 'https://placehold.co/600x400.png?text=Victoria!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), likes: 15, commentsCount: 2, likedBy: [] },
  { id: 'post2', authorId: 'u1', authorName: 'Admin User', authorAvatarUrl: initialSeedUsers.find(u => u.id === 'u1')?.avatarUrl, content: 'Recordatorio: La cuota de inscripción para la nueva temporada vence la próxima semana. ¡No se olviden!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), likes: 5, commentsCount: 0, likedBy: [] },
];
export function deletePlaceholderPost(postId: string) {
  placeholderPosts = placeholderPosts.filter(p => p.id !== postId);
  placeholderDataVersion++;
}
export function updatePlaceholderPost(updatedPost: Post) {
  placeholderPosts = placeholderPosts.map(p => p.id === updatedPost.id ? updatedPost : p);
  placeholderDataVersion++;
}
export let placeholderPostComments: PostComment[] = [
    {id: 'pc1', postId: 'post1', authorId: 'u3', authorName: 'Player Leo (User)', content: '¡Gran partido, coach!', timestamp: new Date(Date.now() - 1000 * 60 * 50), authorAvatarUrl: initialSeedUsers.find(u => u.id === 'u3')?.avatarUrl },
    {id: 'pc2', postId: 'post1', authorId: 'u4', authorName: 'Tutor Jorge', content: 'Felicidades a todos los chicos, un esfuerzo increíble.', timestamp: new Date(Date.now() - 1000 * 60 * 45), authorAvatarUrl: initialSeedUsers.find(u => u.id === 'u4')?.avatarUrl },
];
export function deletePlaceholderPostComments(postId: string) {
  placeholderPostComments = placeholderPostComments.filter(c => c.postId !== postId);
  placeholderDataVersion++;
}

// placeholderNotifications is removed as it's now Firestore-based.

export let defaultPlayerProfileFields: PlayerProfileField[] = [
  { key: 'name', label: 'Nombre Completo', type: 'text', section: 'Personal', isDefault: true, isActive: true },
  { key: 'dateOfBirth', label: 'Fecha de Nacimiento', type: 'date', section: 'Personal', isDefault: true, isActive: true },
  { key: 'phone', label: 'Teléfono Principal', type: 'number', section: 'Personal', isDefault: false, isActive: true },
  { key: 'secondaryPhone', label: 'Teléfono Secundario', type: 'number', section: 'Personal', isDefault: false, isActive: true },
  { key: 'email', label: 'Email', type: 'text', section: 'Personal', isDefault: false, isActive: true },
  { key: 'passportNumber', label: 'Pasaporte / DNI', type: 'text', section: 'Personal', isDefault: false, isActive: true },
  { key: 'nationality', label: 'Nacionalidad', type: 'text', section: 'Personal', isDefault: false, isActive: true },
  { key: 'address', label: 'Dirección', type: 'textarea', section: 'Personal', isDefault: false, isActive: true },
  { key: 'position', label: 'Posición Principal', type: 'select', options: ['Portero', 'Defensa', 'Centrocampista', 'Delantero'], section: 'Deportivo', isDefault: true, isActive: true },
  { key: 'secondaryPosition', label: 'Posición Secundaria', type: 'select', options: ['Portero', 'Defensa', 'Centrocampista', 'Delantero'], section: 'Deportivo', isDefault: false, isActive: true },
  { key: 'jerseyNumber', label: 'Número de Camiseta', type: 'number', section: 'Deportivo', isDefault: true, isActive: true },
  { key: 'preferredFoot', label: 'Pie Preferido', type: 'select', options: ['Izquierdo', 'Derecho', 'Ambidiestro'], section: 'Deportivo', isDefault: false, isActive: true },
  { key: 'height', label: 'Altura (cm)', type: 'number', section: 'Deportivo', isDefault: false, isActive: true },
  { key: 'weight', label: 'Peso (kg)', type: 'number', section: 'Deportivo', isDefault: false, isActive: true },
  { key: 'joiningDate', label: 'Fecha de Ingreso al Club', type: 'date', section: 'Deportivo', isDefault: false, isActive: false },
  { key: 'medicalExamDate', label: 'Fecha Último Examen Médico', type: 'date', section: 'Médico', isDefault: false, isActive: true },
  { key: 'bloodType', label: 'Grupo Sanguíneo', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], section: 'Médico', isDefault: false, isActive: true },
  { key: 'allergies', label: 'Alergias', type: 'textarea', section: 'Médico', isDefault: false, isActive: true },
  { key: 'medicalConditions', label: 'Condiciones Médicas Relevantes', type: 'textarea', section: 'Médico', isDefault: false, isActive: true },
  { key: 'emergencyContactName', label: 'Nombre Contacto Emergencia', type: 'text', section: 'Médico', isDefault: true, isActive: true },
  { key: 'emergencyContactPhone', label: 'Teléfono Contacto Emergencia', type: 'text', section: 'Médico', isDefault: true, isActive: true },
  { key: 'insuranceProvider', label: 'Proveedor de Seguro Médico', type: 'text', section: 'Médico', isDefault: false, isActive: true },
  { key: 'insurancePolicyNumber', label: 'Número de Póliza', type: 'text', section: 'Médico', isDefault: false, isActive: true },
];
// Removed the update function, as it's now handled by Firestore.
// export function updateDefaultPlayerProfileFields(newFields: PlayerProfileField[]) {
//   defaultPlayerProfileFields = newFields; 
//   placeholderDataVersion++;
// }

export const MAX_CONVOCADOS = 18;

export const placeholderMatches: Match[] = [ /* This is now primarily managed by Firestore */ ];

export const trainingTaskCategories: TrainingTaskCategory[] = ['Calentamiento', 'Técnica', 'Táctica', 'Físico', 'Partido', 'Otro'];

export let placeholderTrainingSessions: TrainingSession[] = [ /* Data now from Firestore */ ];
export let placeholderTrainingAttendance: TrainingAttendanceRecord[] = [ /* Data now from Firestore */ ];

export type MatchDayPlayerStatus =
  | 'Presente y Disponible'
  | 'Presente (No disponible - Lesión)'
  | 'Presente (No disponible - Otro)'
  | 'Ausente (Aviso Previo)'
  | 'Ausente (Sin Aviso)'
  | 'Retraso';

export let placeholderMatchDayPresence: MatchDayPresenceRecord[] = [ /* This will be migrated */ ];

export const CATEGORY_RULES: Record<string, { duration: number; playersOnField: number }> = {
  'Benjamín': { duration: 50, playersOnField: 7 }, 'Alevín': { duration: 60, playersOnField: 11 },
  'Infantil': { duration: 70, playersOnField: 11 }, 'Cadete': { duration: 80, playersOnField: 11 },
  'Juvenil': { duration: 90, playersOnField: 11 }, 'Senior': { duration: 90, playersOnField: 11 },
  'Sub-18': { duration: 90, playersOnField: 11 }, 'Default': { duration: 90, playersOnField: 11 },
};

export let placeholderLeagueCompetitions: LeagueCompetition[] = [ /* This will be migrated */ ];
export function addLeagueCompetition(newCompetition: LeagueCompetition) { /* Firestore direct */ }
export function updateLeagueCompetition(updatedCompetition: LeagueCompetition) { /* Firestore direct */ }
export function deleteLeagueCompetition(competitionId: string) { /* Firestore direct */ }
export function addRivalToCompetition(competitionId: string, newRival: RivalTeam) { /* Firestore direct */ }
export function updateRivalInCompetition(competitionId: string, updatedRival: RivalTeam) { /* Firestore direct */ }
export function deleteRivalFromCompetition(competitionId: string, rivalId: string) { /* Firestore direct */ }

export let placeholderDrillsLibrary: TrainingTask[] = [ /* Data now from Firestore */ ];
export function addDrillToLibrary(newDrill: TrainingTask) { /* Firestore direct */ }
export function updateDrillInLibrary(updatedDrill: TrainingTask) { /* Firestore direct */ }
export function deleteDrillFromLibrary(drillId: string) { /* Firestore direct */ }


export function setGlobalUsers(fetchedUsers: User[]) {
  users = fetchedUsers;
}
