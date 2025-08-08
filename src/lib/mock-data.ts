export type Player = {
    name: string;
    avatar: string;
    team: string;
    position: string;
    age: number;
    overall: number;
    status: string;
    statusKey: "Active" | "On-loan" | "Injured";
};

export const players: Player[] = [
    { name: "Leo Messi", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Delantero", age: 36, overall: 93, status: "Activo", statusKey: "Active" },
    { name: "Cristiano Ronaldo", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Delantero", age: 39, overall: 92, status: "Activo", statusKey: "Active" },
    { name: "Kevin De Bruyne", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Centrocampista", age: 32, overall: 91, status: "Activo", statusKey: "Active" },
    { name: "Jamal Musiala", avatar: "https://placehold.co/40x40.png", team: "Sub-19", position: "Centrocampista", age: 21, overall: 86, status: "Activo", statusKey: "Active" },
    { name: "Lamine Yamal", avatar: "https://placehold.co/40x40.png", team: "Sub-17", position: "Delantero", age: 16, overall: 78, status: "Cedido", statusKey: "On-loan" },
    { name: "Sergio Ramos", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Defensa", age: 38, overall: 84, status: "Activo", statusKey: "Active" },
    { name: "Marc-André ter Stegen", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Portero", age: 32, overall: 89, status: "Activo", statusKey: "Active" },
    { name: "Kyle Walker", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Defensa", age: 34, overall: 86, status: "Activo", statusKey: "Active" },
    { name: "Virgil van Dijk", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Defensa", age: 32, overall: 90, status: "Activo", statusKey: "Active" },
    { name: "Andrew Robertson", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Defensa", age: 30, overall: 87, status: "Activo", statusKey: "Active" },
    { name: "N'Golo Kanté", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Centrocampista", age: 33, overall: 88, status: "Activo", statusKey: "Active" },
    { name: "Luka Modrić", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Centrocampista", age: 38, overall: 89, status: "Activo", statusKey: "Active" },
    { name: "Mohamed Salah", avatar: "https://placehold.co/40x40.png", team: "Equipo A", position: "Delantero", age: 31, overall: 90, status: "Activo", statusKey: "Active" },
    { name: "Thibaut Courtois", avatar: "https://placehold.co/40x40.png", team: "Equipo B", position: "Portero", age: 32, overall: 90, status: "Lesionado", statusKey: "Injured"},
    { name: "Neymar Jr.", avatar: "https://placehold.co/40x40.png", team: "Equipo B", position: "Delantero", age: 32, overall: 89, status: "Activo", statusKey: "Active" },
];


export const teams = [
    { name: "Equipo A", players: 25, competition: "Primera División", manager: "Entrenador A" },
    { name: "Equipo B", players: 23, competition: "Segunda División", manager: "Entrenador B" },
    { name: "Sub-19", players: 20, competition: "Liga Juvenil Sub-19", manager: "Entrenador C" },
    { name: "Sub-17", players: 22, competition: "Liga Juvenil Sub-17", manager: "Entrenador D" },
];

export const matches = [
    { id: '1', teamA: 'Equipo A', teamB: 'Rival FC', score: '3-1', date: '2024-05-20', competition: 'Liga', status: 'Victoria' },
    { id: '2', teamA: 'Sub-19', teamB: 'Academy Stars', score: '2-2', date: '2024-05-18', competition: 'Copa Juvenil', status: 'Empate' },
    { id: '3', teamA: 'Equipo B', teamB: 'City United', score: '0-1', date: '2024-05-17', competition: 'Liga', status: 'Derrota' },
    { id: '4', teamA: 'Equipo A', teamB: 'Metropolis FC', score: '2-0', date: '2024-05-12', competition: 'Liga', status: 'Victoria' },
    { id: '5', teamA: 'Sub-17', teamB: 'Junior Pros', score: '4-2', date: '2024-05-11', competition: 'Liga Juvenil', status: 'Victoria' },
];


export const teamPerformanceData = [
  { name: 'Equipo A', Victorias: 12, Empates: 5, Derrotas: 3 },
  { name: 'Equipo B', Victorias: 10, Empates: 6, Derrotas: 4 },
  { name: 'Sub-19', Victorias: 15, Empates: 2, Derrotas: 3 },
  { name: 'Sub-17', Victorias: 9, Empates: 8, Derrotas: 3 },
];

export const playerGoalsData = [
  { month: 'Ene', 'Jugador 1': 4, 'Jugador 2': 2 },
  { month: 'Feb', 'Jugador 1': 3, 'Jugador 2': 5 },
  { month: 'Mar', 'Jugador 1': 5, 'Jugador 2': 3 },
  { month: 'Abr', 'Jugador 1': 7, 'Jugador 2': 4 },
  { month: 'May', 'Jugador 1': 6, 'Jugador 2': 8 },
];

export const recentMatches = [
    { teamA: 'Equipo A', teamB: 'Rival FC', score: '3-1', date: '2024-05-20', competition: 'Liga', status: 'Victoria' },
    { teamA: 'Sub-19', teamB: 'Academy Stars', score: '2-2', date: '2024-05-18', competition: 'Copa Juvenil', status: 'Empate' },
    { teamA: 'Equipo B', teamB: 'City United', score: '0-1', date: '2024-05-17', competition: 'Liga', status: 'Derrota' },
];
