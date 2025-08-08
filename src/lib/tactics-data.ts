import type { TacticsPlayer, TacticalFormation } from '@/types';
import { icons } from 'lucide-react';

export const HOME_TEAM_PLAYERS: TacticsPlayer[] = [
  { id: 'H-GK-1', name: 'A. Becker', number: 1, position: 'Portero', team: 'home', color: '#3B82F6' },
  { id: 'H-DF-2', name: 'T. Alexander-Arnold', number: 66, position: 'Defensa', team: 'home', color: '#3B82F6' },
  { id: 'H-DF-3', name: 'I. Konaté', number: 5, position: 'Defensa', team: 'home', color: '#3B82F6' },
  { id: 'H-DF-4', name: 'V. van Dijk', number: 4, position: 'Defensa', team: 'home', color: '#3B82F6' },
  { id: 'H-DF-5', name: 'A. Robertson', number: 26, position: 'Defensa', team: 'home', color: '#3B82F6' },
  { id: 'H-MF-6', name: 'A. Mac Allister', number: 10, position: 'Centrocampista', team: 'home', color: '#3B82F6' },
  { id: 'H-MF-7', name: 'D. Szoboszlai', number: 8, position: 'Centrocampista', team: 'home', color: '#3B82F6' },
  { id: 'H-MF-8', name: 'W. Endō', number: 3, position: 'Centrocampista', team: 'home', color: '#3B82F6' },
  { id: 'H-FW-9', name: 'M. Salah', number: 11, position: 'Delantero', team: 'home', color: '#3B82F6' },
  { id: 'H-FW-10', name: 'D. Núñez', number: 9, position: 'Delantero', team: 'home', color: '#3B82F6' },
  { id: 'H-FW-11', name: 'L. Díaz', number: 7, position: 'Delantero', team: 'home', color: '#3B82F6' },
  // Substitutes
  { id: 'H-GK-12', name: 'C. Kelleher', number: 62, position: 'Portero', team: 'home', color: '#3B82F6' },
  { id: 'H-DF-13', name: 'J. Gomez', number: 2, position: 'Defensa', team: 'home', color: '#3B82F6' },
  { id: 'H-MF-14', name: 'H. Elliott', number: 19, position: 'Centrocampista', team: 'home', color: '#3B82F6' },
  { id: 'H-FW-15', name: 'C. Gakpo', number: 18, position: 'Delantero', team: 'home', color: '#3B82F6' },
  { id: 'H-FW-16', name: 'D. Jota', number: 20, position: 'Delantero', team: 'home', color: '#3B82F6' },
];

export const AWAY_TEAM_PLAYERS: TacticsPlayer[] = Array.from({ length: 11 }, (_, i) => ({
  id: `A-PLY-${i + 1}`,
  name: '',
  number: i + 1,
  position: 'Delantero', // Default position, can be adjusted
  team: 'away',
  color: '#F97316',
}));


export const DRAWING_COLORS = [
  { value: '#EF4444', label: 'Rojo' }, // red-500
  { value: '#3B82F6', label: 'Azul' }, // blue-500
  { value: '#22C55E', label: 'Verde' }, // green-500
  { value: '#EAB308', label: 'Amarillo' }, // yellow-500
  { value: '#F97316', label: 'Naranja' }, // orange-500
  { value: '#A855F7', label: 'Púrpura' }, // purple-500
  { value: '#EC4899', label: 'Rosa' }, // pink-500
  { value: '#14B8A6', label: 'Turquesa' }, // teal-500
  { value: '#F8FAFC', label: 'Blanco' }, // slate-50
  { value: '#1E293B', label: 'Negro' }, // slate-800
];

export const STROKE_WIDTHS = [
  { value: 2, label: 'XS' },
  { value: 4, label: 'S' },
  { value: 6, label: 'M' },
  { value: 10, label: 'L' },
  { value: 16, label: 'XL' },
];

export const TRAINING_OBJECTS = [
  { id: 'ball', imageUrl: '/balon.png', baseSize: 32 },
  { id: 'cone', imageUrl: '/cono.png', baseSize: 42 },
  { id: 'goal', imageUrl: '/porteria_1.png', baseSize: 105 },
  { id: 'flag', imageUrl: '/banderin_rojo.png', baseSize: 42 },
  { id: 'marker_x', imageUrl: '/marker-x.png', baseSize: 42 },
  { id: 'marker_o', imageUrl: '/marker-o.png', baseSize: 42 },
  { id: 'small_goal', imageUrl: '/porteria_p.png', baseSize: 64 },
];
