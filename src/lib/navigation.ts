import { LayoutDashboard, Users, UserCog, Newspaper, Bell, Settings2, Shield, UsersRound, CalendarClock, ClipboardCheck, type LucideIcon, Dumbbell, Trophy, BarChart3, LibraryBig, UserCircle, Presentation } from 'lucide-react';
import type { UserRole } from '@/types'; // Importar UserRole

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  segment?: string | null;
  tooltip?: string;
  subItems?: NavItem[];
}

// allowedRoles is removed from here and will be managed in Firestore
export const mainNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, segment: null, tooltip: 'Dashboard' },
  { href: '/reports', label: 'Informes', icon: BarChart3, segment: 'reports', tooltip: 'Informes y Estadísticas' },
  { href: '/attendance', label: 'Entrenamientos', icon: Dumbbell, segment: 'attendance', tooltip: 'Gestión de Sesiones de Entrenamiento' },
  { href: '/drills-library', label: 'Biblioteca Ejercicios', icon: LibraryBig, segment: 'drills-library', tooltip: 'Biblioteca de Ejercicios de Entrenamiento' },
  { href: '/teams', label: 'Equipos', icon: UsersRound, segment: 'teams', tooltip: 'Gestión de Equipos' },
  { href: '/players', label: 'Jugadores', icon: Users, segment: 'players', tooltip: 'Gestión de Jugadores' },
  { href: '/clubs', label: 'Clubes', icon: Shield, segment: 'clubs', tooltip: 'Gestión de Clubes' },
  { href: '/users', label: 'Usuarios', icon: UserCog, segment: 'users', tooltip: 'Gestión de Usuarios y Roles' },
  { href: '/calendar', label: 'Convocatorias', icon: ClipboardCheck, segment: 'calendar', tooltip: 'Gestión de Convocatorias y Partidos' },
  { href: '/competitions', label: 'Competiciones', icon: Trophy, segment: 'competitions', tooltip: 'Gestión de Ligas y Competiciones' },
  { href: '/team-wall', label: 'Noticias', icon: Newspaper, segment: 'team-wall', tooltip: 'Noticias y Actualizaciones' },
  { href: '/tactics', label: 'Pizarra Táctica', icon: Presentation, segment: 'tactics', tooltip: 'Pizarra Táctica' },
  { href: '/settings', label: 'Configuración', icon: Settings2, segment: 'settings', tooltip: 'Configuración de la Aplicación' },
].sort((a, b) => {
  if (a.label === 'Dashboard') return -1;
  if (b.label === 'Dashboard') return 1;
  if (a.label === 'Configuración') return 1;
  if (b.label === 'Configuración') return -1;
  return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
});

export const secondaryNavItems: NavItem[] = [];

export function getPageTitle(pathname: string): string {
  const allNavItems = [...mainNavItems, ...secondaryNavItems];

  if (pathname === '/login') return 'Iniciar Sesión';
  if (pathname === '/register') return 'Crear Cuenta';
  if (pathname.startsWith('/players/configure')) return 'Configurar Perfil de Jugador';
  if (pathname.match(/^\/players\/[^/]+$/)) return 'Detalle del Jugador';


  const exactMatchItem = allNavItems.find(navItem => navItem.href === pathname);
  if (exactMatchItem) return exactMatchItem.label;

  const sortedNavItems = allNavItems
    .filter(item => item.href !== '/')
    .sort((a, b) => b.href.length - a.href.length);

  const prefixMatchItem = sortedNavItems.find(navItem => pathname.startsWith(navItem.href));
  if (prefixMatchItem) return prefixMatchItem.label;

  if (pathname.startsWith('/clubs')) return 'Gestión de Clubes';
  if (pathname.startsWith('/teams')) return 'Gestión de Equipos';
  if (pathname.startsWith('/calendar')) return 'Convocatorias y Partidos';
  if (pathname.startsWith('/attendance')) return 'Entrenamientos';
  if (pathname.startsWith('/drills-library')) return 'Biblioteca de Ejercicios';
  if (pathname.startsWith('/competitions')) return 'Competiciones';
  if (pathname.startsWith('/reports')) return 'Informes y Estadísticas';
  if (pathname.startsWith('/team-wall')) return 'Noticias';
  if (pathname.startsWith('/settings')) return 'Configuración';
  if (pathname.startsWith('/tactics')) return 'Pizarra Táctica';


  return 'A.D. Alhóndiga';
}
