
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Match, TrainingSession, Club, User, Team, Player, UserRole, PlayerCallUp, InjuryRecord, TrainingAttendanceRecord } from '@/types';
import { isFuture, format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Users, UsersRound, CalendarDays, Trophy, ArrowRight, UserCog, PieChart as PieChartIcon, ListChecksIcon, Goal, TrendingUp, BarChartHorizontalBig, Activity, BarChart as BarChartLucideIcon, ActivitySquare, Percent, FileText } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from '@/components/ui/progress';
import AuthGuard from '@/components/auth/auth-guard';
import { useAuth } from '@/contexts/auth-context'; 
import { Skeleton } from '@/components/ui/skeleton';
import { TeamReportDialog } from '@/components/reports/team-report-dialog';
import { placeholderUserRoles, getActiveUserClub } from '@/lib/placeholder-data';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/contexts/page-header-context';


interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  link?: string;
  linkLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, link, linkLabel }) => (
  <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold font-headline">{value}</div>
      {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      {link && linkLabel && (
        <Link href={link} className="text-sm text-primary hover:underline flex items-center pt-2">
          {linkLabel} <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      )}
    </CardContent>
  </Card>
);

interface CombinedEvent {
  id: string;
  type: 'match' | 'training';
  date: Date;
  title: string;
  time: string;
  location?: string;
  icon: React.ElementType;
  href: string;
}

interface TeamMatchStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
];


function ReportsPageContent() {
  const { userProfile: currentUser, isLoading: authIsLoading } = useAuth(); 
  const { setHeader } = usePageHeader();
  const [activeClub, setActiveClub] = useState<Club | undefined>(undefined);
  const [clubLoading, setClubLoading] = useState(true);
  const [allTeamsFromFirestore, setAllTeamsFromFirestore] = useState<Team[]>([]);
  const [allPlayersFromFirestore, setAllPlayersFromFirestore] = useState<Player[]>([]);
  const [allMatchesFromFirestore, setAllMatchesFromFirestore] = useState<Match[]>([]);
  const [allTrainingSessionsFromFirestore, setAllTrainingSessionsFromFirestore] = useState<TrainingSession[]>([]);
  const [allUsersFromFirestore, setAllUsersFromFirestore] = useState<User[]>([]);
  const [allAttendanceFromFirestore, setAllAttendanceFromFirestore] = useState<TrainingAttendanceRecord[]>([]);

  const [isTeamReportDialogOpen, setIsTeamReportDialogOpen] = useState(false);


  const [clubTeams, setClubTeams] = useState<Team[]>([]);
  const [clubPlayersCount, setClubPlayersCount] = useState<number>(0);
  const [clubCoachesCount, setClubCoachesCount] = useState<number>(0);
  const [clubUsersCount, setClubUsersCount] = useState<number>(0);

  const [playersByCategory, setPlayersByCategory] = useState<{ category: string, count: number, fill: string }[]>([]);
  const [usersByRole, setUsersByRole] = useState<{ role: UserRole, count: number, fill: string }[]>([]);
  const [clubMatchStatusData, setClubMatchStatusData] = useState<{ name: string, value: number, fill: string }[]>([]);
  
  const [selectedTeamIdForReport, setSelectedTeamIdForReport] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedTeamPlayers, setSelectedTeamPlayers] = useState<Player[]>([]);
  const [selectedTeamUpcomingMatches, setSelectedTeamUpcomingMatches] = useState<Match[]>([]);
  const [selectedTeamRecentResults, setSelectedTeamRecentResults] = useState<Match[]>([]);
  const [selectedTeamTopScorers, setSelectedTeamTopScorers] = useState<{ playerId: string, name: string, avatarUrl?: string, goals: number }[]>([]);
  const [selectedTeamMatchStats, setSelectedTeamMatchStats] = useState<TeamMatchStats | null>(null);
  const [teamPerformanceData, setTeamPerformanceData] = useState<{ name: string, value: number, fill: string }[]>([]);
  
  const [teamPlayerPositionData, setTeamPlayerPositionData] = useState<{ position: string, count: number, fill: string }[]>([]);
  const [teamAttendanceStats, setTeamAttendanceStats] = useState<{ attended: number, totalPossible: number, percentage: number } | null>(null);
  const [teamInjuryStats, setTeamInjuryStats] = useState<{ active: number, recovering: number } | null>(null);
  
  // State for chart types
  const [playersByCategoryChartType, setPlayersByCategoryChartType] = useState<'pie' | 'bar'>('pie');
  const [usersByRoleChartType, setUsersByRoleChartType] = useState<'pie' | 'bar'>('pie');
  const [clubMatchStatusChartType, setClubMatchStatusChartType] = useState<'bar' | 'pie'>('bar');
  const [teamPerformanceChartType, setTeamPerformanceChartType] = useState<'bar' | 'pie'>('bar');
  const [teamPlayerPositionChartType, setTeamPlayerPositionChartType] = useState<'pie' | 'bar'>('pie');


  useEffect(() => {
    if (activeClub) {
      setHeader({
        title: `Informes y Estadísticas: ${activeClub.name}`,
        description: 'Resumen de la actividad y composición del club.',
        icon: BarChart3,
      });
    } else if (!clubLoading) {
       setHeader({
        title: 'Informes y Estadísticas',
        description: 'Selecciona un club para ver los informes.',
        icon: BarChart3,
      });
    }
  }, [setHeader, activeClub, clubLoading]);


  const playersByCategoryChartConfig = {
    count: { label: "Jugadores" },
    ...playersByCategory.reduce((acc, cur) => {
      acc[cur.category] = { label: cur.category, color: cur.fill };
      return acc;
    }, {} as ChartConfig)
  } satisfies ChartConfig;
  
  const usersByRoleChartConfig = {
    count: { label: "Usuarios" },
    ...usersByRole.reduce((acc, cur) => {
        acc[cur.role] = { label: cur.role, color: cur.fill };
        return acc;
    }, {} as ChartConfig)
  } satisfies ChartConfig;

  const matchStatusChartConfig = {
    value: { label: "Partidos" },
    ...clubMatchStatusData.reduce((acc, cur) => {
        acc[cur.name] = { label: cur.name, color: cur.fill };
        return acc;
    }, {} as ChartConfig)
  } satisfies ChartConfig;
  
  const teamPerformanceChartConfig = {
    value: { label: "Partidos" },
    ...teamPerformanceData.reduce((acc,cur) => {
        acc[cur.name] = { label: cur.name, color: cur.fill };
        return acc;
    }, {} as ChartConfig)
  } satisfies ChartConfig;

  const teamPlayerPositionChartConfig = {
    count: { label: "Jugadores" },
    ...teamPlayerPositionData.reduce((acc, cur) => {
        acc[cur.position] = { label: cur.position, color: cur.fill };
        return acc;
    }, {} as ChartConfig)
  } satisfies ChartConfig;

  const fetchDataFromFirestore = async (clubId: string) => {
    try {
      const teamsSnap = await getDocs(query(collection(db, "teams"), where("clubId", "==", clubId)));
      const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      teamsData.sort((a,b) => a.name.localeCompare(b.name));
      setAllTeamsFromFirestore(teamsData);
      
      const playersSnap = await getDocs(query(collection(db, "players"), where("clubId", "==", clubId)));
      const playersData = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      playersData.sort((a,b) => a.name.localeCompare(b.name));
      setAllPlayersFromFirestore(playersData);
      
      const usersSnap = await getDocs(query(collection(db, "users"), where("clubId", "==", clubId)));
      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      usersData.sort((a,b) => a.name.localeCompare(b.name));
      setAllUsersFromFirestore(usersData);
      
      const matchesSnap = await getDocs(query(collection(db, "matches"), orderBy("date", "desc")));
      setAllMatchesFromFirestore(matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as any).toDate() } as Match)));
      
      const sessionsQuery = query(collection(db, "trainingSessions"), where("clubId", "==", clubId));
      const sessionsSnap = await getDocs(sessionsQuery);
      const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as any).toDate() } as TrainingSession));
      sessionsData.sort((a,b) => (b.date as Date).getTime() - (a.date as Date).getTime());
      setAllTrainingSessionsFromFirestore(sessionsData);


      const attendanceSnap = await getDocs(collection(db, "trainingAttendance"));
      setAllAttendanceFromFirestore(attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAttendanceRecord)));

    } catch (error) {
        console.error("Error fetching data for reports:", error);
    }
  };


  useEffect(() => {
    const fetchClub = async () => {
      setClubLoading(true);
      let club;
      if (currentUser) {
        club = await getActiveUserClub(currentUser.id);
      } else if (!authIsLoading) { 
        club = await getActiveUserClub(undefined);
      }
      setActiveClub(club);
      if (club) {
        await fetchDataFromFirestore(club.id);
      }
      setClubLoading(false);
    };
    fetchClub();
  }, [currentUser, authIsLoading]);

  useEffect(() => {
    if (!activeClub || clubLoading) { 
      setClubTeams([]);
      setClubPlayersCount(0);
      setClubCoachesCount(0);
      setClubUsersCount(0);
      setPlayersByCategory([]);
      setUsersByRole([]);
      setClubMatchStatusData([]);
      setSelectedTeamIdForReport(null);
      return;
    }

    const teamsInClub = allTeamsFromFirestore.filter(t => t.clubId === activeClub.id);
    setClubTeams(teamsInClub);

    if (teamsInClub.length > 0) {
      setSelectedTeamIdForReport(teamsInClub[0].id);
    }

    const teamIdsInClub = teamsInClub.map(t => t.id);
    const playersInClub = allPlayersFromFirestore.filter(p => p.teamId && teamIdsInClub.includes(p.teamId));
    setClubPlayersCount(playersInClub.length);

    const usersInClub = allUsersFromFirestore.filter(u => u.clubId === activeClub.id);
    const coachesInClub = usersInClub.filter(u => u.role === 'Entrenador');
    setClubCoachesCount(coachesInClub.length);
    setClubUsersCount(usersInClub.length);


    const categoryCounts: Record<string, number> = {};
    teamsInClub.forEach(team => {
        const category = team.category || 'Sin Categoría';
        const playersInTeam = allPlayersFromFirestore.filter(p => p.teamId === team.id).length;
        categoryCounts[category] = (categoryCounts[category] || 0) + playersInTeam;
    });
    const playersByCategoryData = Object.entries(categoryCounts)
        .map(([category, count], index) => ({ category, count, fill: CHART_COLORS[index % CHART_COLORS.length] }))
        .sort((a,b) => b.count - a.count);
    setPlayersByCategory(playersByCategoryData);

    const roleCounts: Record<UserRole, number> = {} as Record<UserRole, number>;
    placeholderUserRoles.forEach(role => roleCounts[role] = 0);
    usersInClub.forEach(user => {
        roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    });
    const usersByRoleData = placeholderUserRoles
        .map((role, index) => ({ role, count: roleCounts[role], fill: CHART_COLORS[(index + playersByCategoryData.length) % CHART_COLORS.length] }))
        .filter(r => r.count > 0)
        .sort((a,b) => b.count - a.count);
    setUsersByRole(usersByRoleData);

    let finalizedCount = 0;
    let scheduledCount = 0;
    allMatchesFromFirestore.forEach(match => {
        const involvesClubTeam = (match.homeTeamId && teamIdsInClub.includes(match.homeTeamId)) ||
                                 (match.awayTeamId && teamIdsInClub.includes(match.awayTeamId));
        if (involvesClubTeam) {
            if (match.status === 'Finalizado') finalizedCount++;
            else if (match.status === 'Programado') scheduledCount++;
        }
    });
    setClubMatchStatusData([
        { name: 'Finalizados', value: finalizedCount, fill: CHART_COLORS[0] },
        { name: 'Programados', value: scheduledCount, fill: CHART_COLORS[1] },
    ]);
    
    if (teamsInClub.length > 0 && !selectedTeamIdForReport && !allTeamsFromFirestore.find(t => t.id === selectedTeamIdForReport)) {
    } else if (!teamsInClub.find(t => t.id === selectedTeamIdForReport)) {
      setSelectedTeamIdForReport(null); 
    }


  }, [activeClub, clubLoading, allTeamsFromFirestore, allPlayersFromFirestore, allMatchesFromFirestore, allTrainingSessionsFromFirestore, allUsersFromFirestore]);


  useEffect(() => {
    if (!selectedTeamIdForReport) {
      setSelectedTeam(null);
      setSelectedTeamPlayers([]);
      setSelectedTeamUpcomingMatches([]);
      setSelectedTeamRecentResults([]);
      setSelectedTeamTopScorers([]);
      setSelectedTeamMatchStats(null);
      setTeamPerformanceData([]);
      setTeamPlayerPositionData([]);
      setTeamAttendanceStats(null);
      setTeamInjuryStats(null);
      return;
    }
    
    setSelectedTeam(allTeamsFromFirestore.find(t => t.id === selectedTeamIdForReport) || null);

    const playersOfSelectedTeam = allPlayersFromFirestore.filter(p => p.teamId === selectedTeamIdForReport);
    setSelectedTeamPlayers(playersOfSelectedTeam);

    const upcomingTeamMatches = allMatchesFromFirestore
      .filter(m => m.status === 'Programado' && isFuture(m.date as Date) && (m.homeTeamId === selectedTeamIdForReport || m.awayTeamId === selectedTeamIdForReport))
      .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime())
      .slice(0, 3);
    setSelectedTeamUpcomingMatches(upcomingTeamMatches);
    
    const recentTeamResults = allMatchesFromFirestore
        .filter(m => m.status === 'Finalizado' && (m.homeTeamId === selectedTeamIdForReport || m.awayTeamId === selectedTeamIdForReport))
        .sort((a,b) => (b.date as Date).getTime() - (a.date as Date).getTime())
        .slice(0,3);
    setSelectedTeamRecentResults(recentTeamResults);

    const scorers: Record<string, { playerId: string, name: string, avatarUrl?: string, goals: number }> = {};
    playersOfSelectedTeam.forEach(player => {
      player.callUpHistory?.forEach(callUp => {
        if (callUp.goals && callUp.goals > 0) {
          if (!scorers[player.id]) {
            scorers[player.id] = { playerId: player.id, name: player.name, avatarUrl: player.avatarUrl, goals: 0 };
          }
          scorers[player.id].goals += callUp.goals;
        }
      });
    });
    const sortedScorers = Object.values(scorers).sort((a, b) => b.goals - a.goals).slice(0, 3);
    setSelectedTeamTopScorers(sortedScorers);
    
    const teamStats: TeamMatchStats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
    allMatchesFromFirestore
        .filter(m => m.status === 'Finalizado' && (m.homeTeamId === selectedTeamIdForReport || m.awayTeamId === selectedTeamIdForReport))
        .forEach(m => {
            teamStats.played++;
            const isHomeTeam = m.homeTeamId === selectedTeamIdForReport;
            if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
                if (isHomeTeam) {
                    teamStats.goalsFor += m.homeScore;
                    teamStats.goalsAgainst += m.awayScore;
                    if (m.homeScore > m.awayScore) teamStats.won++;
                    else if (m.homeScore < m.awayScore) teamStats.lost++;
                    else teamStats.drawn++;
                } else { 
                    teamStats.goalsFor += m.awayScore;
                    teamStats.goalsAgainst += m.homeScore;
                    if (m.awayScore > m.homeScore) teamStats.won++;
                    else if (m.awayScore < m.homeScore) teamStats.lost++;
                    else teamStats.drawn++;
                }
            }
        });
    setSelectedTeamMatchStats(teamStats);
    setTeamPerformanceData([
        { name: 'Victorias', value: teamStats.won, fill: CHART_COLORS[0] },
        { name: 'Empates', value: teamStats.drawn, fill: CHART_COLORS[1] },
        { name: 'Derrotas', value: teamStats.lost, fill: CHART_COLORS[2] },
    ]);

    const positionCounts: Record<string, number> = { 'Portero': 0, 'Defensa': 0, 'Centrocampista': 0, 'Delantero': 0, 'Otro': 0 };
    playersOfSelectedTeam.forEach(p => {
      const pos = p.position || 'Otro';
      if (positionCounts.hasOwnProperty(pos)) {
        positionCounts[pos]++;
      } else {
        positionCounts['Otro']++;
      }
    });
    setTeamPlayerPositionData(
      Object.entries(positionCounts)
        .filter(([, count]) => count > 0)
        .map(([position, count], index) => ({ position, count, fill: CHART_COLORS[index % CHART_COLORS.length] }))
    );

    const teamSessions = allTrainingSessionsFromFirestore.filter(s => s.teamId === selectedTeamIdForReport);
    let totalAttended = 0;
    let totalPossibleAttendances = 0;
    if (teamSessions.length > 0 && playersOfSelectedTeam.length > 0) {
        totalPossibleAttendances = teamSessions.length * playersOfSelectedTeam.length;
        teamSessions.forEach(session => {
            playersOfSelectedTeam.forEach(player => {
                const attendanceRecord = allAttendanceFromFirestore.find(
                    att => att.sessionId === session.id && att.playerId === player.id
                );
                if (attendanceRecord && (attendanceRecord.status === 'Presente' || attendanceRecord.status === 'Tarde')) {
                    totalAttended++;
                }
            });
        });
    }
    setTeamAttendanceStats({
        attended: totalAttended,
        totalPossible: totalPossibleAttendances,
        percentage: totalPossibleAttendances > 0 ? Math.round((totalAttended / totalPossibleAttendances) * 100) : 0,
    });

    let activeInjuries = 0;
    let recoveringInjuries = 0;
    playersOfSelectedTeam.forEach(player => {
        player.injuryHistory?.forEach(injury => {
            if (injury.status === 'Activa') activeInjuries++;
            if (injury.status === 'En Recuperación') recoveringInjuries++;
        });
    });
    setTeamInjuryStats({ active: activeInjuries, recovering: recoveringInjuries });


  }, [selectedTeamIdForReport, allTeamsFromFirestore, allPlayersFromFirestore, allMatchesFromFirestore, allTrainingSessionsFromFirestore, allAttendanceFromFirestore]);

  if (authIsLoading || clubLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }


  if (!activeClub) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Selecciona o configura un club activo para ver los informes.</p>
        <Link href="/clubs">
          <Button className="mt-4">Ir a Gestión de Clubes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline">Resumen General del Club</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Equipos" value={String(clubTeams.length)} icon={UsersRound} link="/teams" linkLabel="Ver Equipos"/>
            <StatCard title="Total Jugadores" value={String(clubPlayersCount)} icon={Users} link="/players" linkLabel="Ver Jugadores"/>
            <StatCard title="Total Entrenadores" value={String(clubCoachesCount)} icon={Users} description="Usuarios con rol Entrenador." />
            <StatCard title="Total Usuarios" value={String(clubUsersCount)} icon={UserCog} description="Usuarios asociados al club." />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Jugadores por Categoría</CardTitle>
                <RadioGroup defaultValue="pie" value={playersByCategoryChartType} onValueChange={(v) => setPlayersByCategoryChartType(v as any)} className="flex items-center gap-1">
                  <Label htmlFor="pie-cat-chart" className={cn(buttonVariants({ variant: playersByCategoryChartType === 'pie' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="pie" id="pie-cat-chart" className="sr-only"/><PieChartIcon className="h-4 w-4"/></Label>
                  <Label htmlFor="bar-cat-chart" className={cn(buttonVariants({ variant: playersByCategoryChartType === 'bar' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="bar" id="bar-cat-chart" className="sr-only"/><BarChartLucideIcon className="h-4 w-4"/></Label>
                </RadioGroup>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
                {playersByCategory.length > 0 ? (
                  playersByCategoryChartType === 'pie' ? (
                    <ChartContainer config={playersByCategoryChartConfig} className={cn("mx-auto h-[200px] w-full sm:h-[250px]", "aspect-square")}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="category" />} />
                          <Pie data={playersByCategory} dataKey="count" nameKey="category" innerRadius={60} strokeWidth={2}>
                            {playersByCategory.map((entry) => ( <Cell key={`cell-${entry.category}`} fill={entry.fill} /> ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <ChartContainer config={playersByCategoryChartConfig} className="mx-auto h-[200px] w-full sm:h-[250px]">
                        <RechartsBarChart data={playersByCategory} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid horizontal={false}/>
                          <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} className="text-xs"/>
                          <XAxis dataKey="count" type="number" hide />
                          <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                          <Bar dataKey="count" radius={5}>
                              {playersByCategory.map((entry) => (<Cell key={`cell-bar-${entry.category}`} fill={entry.fill}/>))}
                          </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                  )
                ) : <p className="text-sm text-muted-foreground text-center">No hay jugadores para mostrar.</p>}
            </CardContent>
        </Card>
        <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><UserCog className="h-5 w-5 text-primary"/>Usuarios por Rol</CardTitle>
                <RadioGroup defaultValue="pie" value={usersByRoleChartType} onValueChange={(v) => setUsersByRoleChartType(v as any)} className="flex items-center gap-1">
                  <Label htmlFor="pie-role-chart" className={cn(buttonVariants({ variant: usersByRoleChartType === 'pie' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="pie" id="pie-role-chart" className="sr-only"/><PieChartIcon className="h-4 w-4"/></Label>
                  <Label htmlFor="bar-role-chart" className={cn(buttonVariants({ variant: usersByRoleChartType === 'bar' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="bar" id="bar-role-chart" className="sr-only"/><BarChartLucideIcon className="h-4 w-4"/></Label>
                </RadioGroup>
            </CardHeader>
             <CardContent className="flex items-center justify-center">
                {usersByRole.length > 0 ? (
                    usersByRoleChartType === 'pie' ? (
                        <ChartContainer config={usersByRoleChartConfig} className={cn("mx-auto h-[200px] w-full sm:h-[250px]", "aspect-square")}>
                            <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="role" />}/>
                                <Pie data={usersByRole} dataKey="count" nameKey="role" innerRadius={60} strokeWidth={2}>
                                {usersByRole.map((entry) => (<Cell key={`cell-role-${entry.role}`} fill={entry.fill} /> ))}
                                </Pie>
                            </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <ChartContainer config={usersByRoleChartConfig} className="mx-auto h-[200px] w-full sm:h-[250px]">
                            <RechartsBarChart data={usersByRole} layout="vertical" margin={{ left: 20, right: 20 }}>
                              <CartesianGrid horizontal={false}/>
                              <YAxis dataKey="role" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} className="text-xs"/>
                              <XAxis dataKey="count" type="number" hide />
                              <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                              <Bar dataKey="count" radius={5}>
                                  {usersByRole.map((entry) => (<Cell key={`cell-bar-${entry.role}`} fill={entry.fill}/>))}
                              </Bar>
                            </RechartsBarChart>
                        </ChartContainer>
                    )
                ) : <p className="text-sm text-muted-foreground text-center">No hay usuarios para mostrar.</p>}
            </CardContent>
        </Card>
        <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>Estado de Partidos</CardTitle>
                 <RadioGroup defaultValue="bar" value={clubMatchStatusChartType} onValueChange={(v) => setClubMatchStatusChartType(v as any)} className="flex items-center gap-1">
                  <Label htmlFor="pie-match-chart" className={cn(buttonVariants({ variant: clubMatchStatusChartType === 'pie' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="pie" id="pie-match-chart" className="sr-only"/><PieChartIcon className="h-4 w-4"/></Label>
                  <Label htmlFor="bar-match-chart" className={cn(buttonVariants({ variant: clubMatchStatusChartType === 'bar' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="bar" id="bar-match-chart" className="sr-only"/><BarChartLucideIcon className="h-4 w-4"/></Label>
                </RadioGroup>
            </CardHeader>
            <CardContent>
              {clubMatchStatusData.some(d => d.value > 0) ? (
                clubMatchStatusChartType === 'bar' ? (
                <ChartContainer config={matchStatusChartConfig} className="mx-auto h-[200px] w-full sm:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={clubMatchStatusData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide/>
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} strokeWidth={1} className="text-xs" interval={0} width={80}/>
                      <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="value" radius={5}>
                        {clubMatchStatusData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} />))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
                ) : (
                <ChartContainer config={matchStatusChartConfig} className={cn("mx-auto h-[200px] w-full sm:h-[250px]", "aspect-square")}>
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Pie data={clubMatchStatusData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={2}>
                        {clubMatchStatusData.map((entry) => (<Cell key={`cell-pie-match-${entry.name}`} fill={entry.fill} />))}
                        </Pie>
                    </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
                )
              ) : <p className="text-sm text-muted-foreground text-center">No hay datos de partidos para mostrar.</p>}
            </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="text-xl font-headline">Informes por Equipo</CardTitle>
                <div className="w-full sm:w-auto sm:min-w-[250px] flex gap-2">
                    <Select value={selectedTeamIdForReport || ''} onValueChange={setSelectedTeamIdForReport}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un equipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="placeholder-disabled" disabled>Selecciona un equipo</SelectItem>
                            {clubTeams.map(team => (
                                <SelectItem key={team.id} value={team.id}>{team.name} ({team.category})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Button onClick={() => setIsTeamReportDialogOpen(true)} disabled={!selectedTeamIdForReport}>
                       <FileText className="mr-2 h-4 w-4" /> Generar Informe
                    </Button>
                </div>
            </div>
            {selectedTeamIdForReport && allTeamsFromFirestore.find(t => t.id === selectedTeamIdForReport) && (
                 <CardDescription>Mostrando informes para el equipo: {allTeamsFromFirestore.find(t => t.id === selectedTeamIdForReport)?.name}</CardDescription>
            )}
        </CardHeader>
        {selectedTeamIdForReport && (
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard title="Jugadores en Equipo" value={String(selectedTeamPlayers.length)} icon={Users} />
                    {selectedTeamMatchStats && (
                        <Card className="md:col-span-2 lg:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-primary"/>Rendimiento del Equipo</CardTitle>
                                <RadioGroup defaultValue="bar" value={teamPerformanceChartType} onValueChange={(v) => setTeamPerformanceChartType(v as any)} className="flex items-center gap-1">
                                  <Label htmlFor="pie-perf-chart" className={cn(buttonVariants({ variant: teamPerformanceChartType === 'pie' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="pie" id="pie-perf-chart" className="sr-only"/><PieChartIcon className="h-4 w-4"/></Label>
                                  <Label htmlFor="bar-perf-chart" className={cn(buttonVariants({ variant: teamPerformanceChartType === 'bar' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="bar" id="bar-perf-chart" className="sr-only"/><BarChartLucideIcon className="h-4 w-4"/></Label>
                                </RadioGroup>
                            </CardHeader>
                            <CardContent>
                                {teamPerformanceData.some(d => d.value > 0) ? (
                                    teamPerformanceChartType === 'bar' ? (
                                    <ChartContainer config={teamPerformanceChartConfig} className="mx-auto h-[200px] w-full sm:h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsBarChart data={teamPerformanceData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                            <CartesianGrid horizontal={false} strokeDasharray="3 3"/>
                                            <XAxis type="number" hide/>
                                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} strokeWidth={1} className="text-xs" width={70} interval={0}/>
                                            <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                            <Bar dataKey="value" radius={4}>
                                                {teamPerformanceData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} />))}
                                            </Bar>
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                    ) : (
                                    <ChartContainer config={teamPerformanceChartConfig} className={cn("mx-auto h-[200px] w-full sm:h-[250px]", "aspect-square")}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart><RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} /><Pie data={teamPerformanceData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={2}>{teamPerformanceData.map((entry) => (<Cell key={`cell-pie-perf-${entry.name}`} fill={entry.fill} />))}</Pie></PieChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                    )
                                ) : <p className="text-xs text-muted-foreground text-center">No hay datos de rendimiento para mostrar.</p>}
                                <ul className="text-xs space-y-0.5 mt-2 text-muted-foreground">
                                  <li>GF: {selectedTeamMatchStats.goalsFor}, GC: {selectedTeamMatchStats.goalsAgainst}, DG: {selectedTeamMatchStats.goalsFor - selectedTeamMatchStats.goalsAgainst}</li>
                                  <li>Total Partidos: {selectedTeamMatchStats.played}</li>
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                     <Card>
                        <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Goal className="h-5 w-5 text-primary"/>Máximos Goleadores</CardTitle></CardHeader>
                        <CardContent>
                            {selectedTeamTopScorers.length > 0 ? (
                                <Table>
                                <TableHeader><TableRow><TableHead className="w-[40px]"></TableHead><TableHead>Jugador</TableHead><TableHead className="text-right">Goles</TableHead></TableRow></TableHeader>
                                <TableBody>
                                {selectedTeamTopScorers.map(scorer => (
                                    <TableRow key={scorer.playerId}>
                                        <TableCell>
                                            <Avatar className="h-7 w-7"><AvatarImage src={scorer.avatarUrl || `https://placehold.co/28x28.png`} alt={scorer.name} data-ai-hint="player avatar"/><AvatarFallback>{scorer.name.substring(0,1)}</AvatarFallback></Avatar>
                                        </TableCell>
                                        <TableCell className="text-xs"><Link href={`/players/${scorer.playerId}`} className="hover:underline">{scorer.name}</Link></TableCell>
                                        <TableCell className="text-right font-semibold text-xs">{scorer.goals}</TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                                </Table>
                            ) : <p className="text-xs text-muted-foreground text-center">No hay goleadores registrados.</p>}
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Card>
                        <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Percent className="h-5 w-5 text-primary"/>Asistencia General a Entrenamientos</CardTitle></CardHeader>
                        <CardContent>
                            {teamAttendanceStats && teamAttendanceStats.totalPossible > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-sm">Porcentaje de Asistencia: <span className="font-bold text-xl">{teamAttendanceStats.percentage}%</span></p>
                                    <Progress value={teamAttendanceStats.percentage} className="w-full h-3" />
                                    <p className="text-xs text-muted-foreground">
                                        Basado en {teamAttendanceStats.attended} asistencias de {teamAttendanceStats.totalPossible} posibles.
                                    </p>
                                </div>
                            ) : <p className="text-xs text-muted-foreground text-center">No hay suficientes datos de asistencia.</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Distribución de Posiciones</CardTitle>
                             <RadioGroup defaultValue="pie" value={teamPlayerPositionChartType} onValueChange={(v) => setTeamPlayerPositionChartType(v as any)} className="flex items-center gap-1">
                                <Label htmlFor="pie-pos-chart" className={cn(buttonVariants({ variant: teamPlayerPositionChartType === 'pie' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="pie" id="pie-pos-chart" className="sr-only"/><PieChartIcon className="h-4 w-4"/></Label>
                                <Label htmlFor="bar-pos-chart" className={cn(buttonVariants({ variant: teamPlayerPositionChartType === 'bar' ? 'secondary' : 'ghost', size: 'icon' }), 'h-7 w-7 cursor-pointer')}><RadioGroupItem value="bar" id="bar-pos-chart" className="sr-only"/><BarChartLucideIcon className="h-4 w-4"/></Label>
                            </RadioGroup>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                             {teamPlayerPositionData.length > 0 ? (
                                teamPlayerPositionChartType === 'pie' ? (
                                <ChartContainer config={teamPlayerPositionChartConfig} className={cn("mx-auto h-[200px] w-full sm:h-[250px]", "aspect-square")}>
                                    <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="position" />} />
                                        <Pie data={teamPlayerPositionData} dataKey="count" nameKey="position" innerRadius={50} strokeWidth={2}>
                                        {teamPlayerPositionData.map((entry) => (<Cell key={`cell-pos-${entry.position}`} fill={entry.fill} />))}
                                        </Pie>
                                    </PieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                                ) : (
                                <ChartContainer config={teamPlayerPositionChartConfig} className="mx-auto h-[200px] w-full sm:h-[250px]">
                                    <RechartsBarChart data={teamPlayerPositionData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid horizontal={false}/>
                                    <YAxis dataKey="position" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} className="text-xs"/>
                                    <XAxis dataKey="count" type="number" hide />
                                    <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                    <Bar dataKey="count" radius={5}>
                                        {teamPlayerPositionData.map((entry) => (<Cell key={`cell-bar-pos-${entry.position}`} fill={entry.fill}/>))}
                                    </Bar>
                                    </RechartsBarChart>
                                </ChartContainer>
                                )
                            ) : <p className="text-xs text-muted-foreground text-center">No hay jugadores en este equipo.</p>}
                        </CardContent>
                    </Card>
                     <Card className="md:col-span-2 lg:col-span-1">
                        <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><ActivitySquare className="h-5 w-5 text-primary"/>Estado de Lesiones</CardTitle></CardHeader>
                        <CardContent>
                            {teamInjuryStats ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Jugadores con Lesión Activa:</span>
                                        <span className="font-bold text-lg text-destructive">{teamInjuryStats.active}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Jugadores en Recuperación:</span>
                                        <span className="font-bold text-lg text-yellow-600">{teamInjuryStats.recovering}</span>
                                    </div>
                                    {teamInjuryStats.active === 0 && teamInjuryStats.recovering === 0 && (
                                        <p className="text-xs text-muted-foreground text-center pt-2">No hay jugadores lesionados o en recuperación.</p>
                                    )}
                                </div>
                            ) : <p className="text-xs text-muted-foreground text-center">No hay datos de lesiones.</p>}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Próximos Partidos del Equipo</CardTitle></CardHeader>
                        <CardContent>
                            {selectedTeamUpcomingMatches.length > 0 ? (
                                <ul className="space-y-2">
                                {selectedTeamUpcomingMatches.map(match => (
                                    <li key={match.id} className="text-xs border-b pb-1 last:border-b-0">
                                        <Link href={`/calendar?date=${format(match.date as Date, 'yyyy-MM-dd')}`} className="hover:text-primary">
                                        <p className="font-medium">{match.homeTeamName} vs {match.awayTeamName}</p>
                                        <p className="text-muted-foreground">{format(match.date as Date, "dd MMM, HH:mm", { locale: es })} {match.location && `- ${match.location}`}</p>
                                        </Link>
                                    </li>
                                ))}
                                </ul>
                            ) : <p className="text-xs text-muted-foreground text-center">No hay próximos partidos programados.</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><ListChecksIcon className="h-5 w-5 text-primary"/>Resultados Recientes del Equipo</CardTitle></CardHeader>
                        <CardContent>
                             {selectedTeamRecentResults.length > 0 ? (
                                <ul className="space-y-2">
                                {selectedTeamRecentResults.map(match => (
                                    <li key={match.id} className="text-xs border-b pb-1 last:border-b-0">
                                         <Link href={`/calendar?date=${format(match.date as Date, 'yyyy-MM-dd')}`} className="hover:text-primary">
                                        <p className="font-medium">{match.homeTeamName} vs {match.awayTeamName}</p>
                                        <p className="font-semibold text-sm">{match.homeScore} - {match.awayScore}</p>
                                        <p className="text-muted-foreground">{format(match.date as Date, "dd MMM yyyy", { locale: es })}</p>
                                        </Link>
                                    </li>
                                ))}
                                </ul>
                            ) : <p className="text-xs text-muted-foreground text-center">No hay resultados recientes.</p>}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        )}
      </Card>

      <TeamReportDialog
        open={isTeamReportDialogOpen}
        onOpenChange={setIsTeamReportDialogOpen}
        team={selectedTeam}
        players={selectedTeamPlayers}
      />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard allowedRoles={['Administrador', 'Directivo Club', 'Entrenador']}>
      <ReportsPageContent />
    </AuthGuard>
  );
}
