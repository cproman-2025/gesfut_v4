
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Users, BarChart3, CalendarDays, Newspaper, ArrowRight, BookOpenCheck, Trophy, ClipboardCheck, Dumbbell, Loader2, LayoutDashboard, Presentation, CalendarClock, Clock, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  getActiveUserClub,
} from "@/lib/placeholder-data";
import type { Match, TrainingSession, Post, Club, User, Team, Player } from "@/types";
import { isFuture, format, formatDistanceToNow, parseISO, isPast } from "date-fns";
import { es } from 'date-fns/locale';
import { useState, useEffect, useMemo, useRef } from "react";
import AuthGuard from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";


interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  link?: string;
  linkLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, link, linkLabel }) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
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

interface QuickLinkProps {
  title: string;
  href: string;
  icon: React.ElementType;
}

const QuickLinkButton: React.FC<QuickLinkProps> = ({ title, href, icon: Icon }) => (
  <Link href={href}>
    <Button variant="outline" className="flex flex-col items-center justify-center h-28 w-full text-center shadow-sm hover:shadow-md transition-shadow">
      <Icon className="h-8 w-8 mb-2 text-primary" />
      <span className="text-sm font-medium">{title}</span>
    </Button>
  </Link>
);

interface CombinedEvent {
  id: string;
  type: 'match' | 'training';
  date: Date;
  title: string;
  time: string;
  location?: string;
  icon: React.ElementType;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamLogoUrl?: string | null;
  awayTeamLogoUrl?: string | null;
}

function DashboardPageContent() {
  const { userProfile, isLoading: authIsLoading } = useAuth();
  const [activeClub, setActiveClub] = useState<Club | undefined>(undefined);
  const [clubLoading, setClubLoading] = useState(true);
  const [dashboardDataLoading, setDashboardDataLoading] = useState(true);

  const [allFirestorePlayers, setAllFirestorePlayers] = useState<Player[]>([]);
  const [allFirestorePosts, setAllFirestorePosts] = useState<Post[]>([]);
  const [allFirestoreMatches, setAllFirestoreMatches] = useState<Match[]>([]);
  const [allFirestoreTrainingSessions, setAllFirestoreTrainingSessions] = useState<TrainingSession[]>([]);
  const [allFirestoreTeams, setAllFirestoreTeams] = useState<Team[]>([]);
  const matchCarouselRef = useRef<HTMLDivElement>(null);


  const [userUpcomingEvents, setUserUpcomingEvents] = useState<CombinedEvent[]>([]);
  const { setHeader } = usePageHeader();

  const welcomeMessage = userProfile ? `¡Bienvenido, ${userProfile.name}!` : `¡Bienvenido a ${activeClub?.name || 'GesFUT'}!`;
  const welcomeDescription = "Tu centro de mando para la gestión de equipos de fútbol.";

  useEffect(() => {
    setHeader({
      title: welcomeMessage,
      description: welcomeDescription,
      icon: LayoutDashboard,
      action: undefined,
    });
  }, [setHeader, welcomeMessage, welcomeDescription]);

  useEffect(() => {
    const fetchClubData = async () => {
      setClubLoading(true);
      try {
        let clubData: Club | undefined;
        if (userProfile) {
          clubData = await getActiveUserClub(userProfile.id);
        } else if (!authIsLoading) {
          clubData = await getActiveUserClub(undefined);
        }
        setActiveClub(clubData);
      } catch (error) {
        console.error("Error fetching active club in dashboard:", error);
        setActiveClub(undefined);
      } finally {
        setClubLoading(false);
      }
    };
    fetchClubData();
  }, [userProfile, authIsLoading]);


  useEffect(() => {
    if (!activeClub) {
        setDashboardDataLoading(false);
        return;
    };
    setDashboardDataLoading(true);

    const unsubscribers = [
      onSnapshot(query(collection(db, "players"), where("clubId", "==", activeClub.id)), snapshot => {
        setAllFirestorePlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
      }),
      onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), snapshot => {
        setAllFirestorePosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: (doc.data().timestamp as Timestamp).toDate() } as Post)));
      }),
      onSnapshot(query(collection(db, "teams"), where("clubId", "==", activeClub.id)), async (teamsSnapshot) => {
        const clubTeamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setAllFirestoreTeams(clubTeamsData);
        
        const clubTeamIds = clubTeamsData.map(t => t.id);

        if (clubTeamIds.length > 0) {
            const matchesQuery = query(collection(db, "matches"), where('date', '>=', new Date()), orderBy("date", "asc"));
            const matchesSnap = await getDocs(matchesQuery);
            const allMatchesData = matchesSnap.docs.map(doc => {
              const data = doc.data();
              const matchDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
              return ({ id: doc.id, ...data, date: matchDate } as Match);
            });
            const clubMatches = allMatchesData.filter(m => (m.homeTeamId && clubTeamIds.includes(m.homeTeamId)) || (m.awayTeamId && clubTeamIds.includes(m.awayTeamId)));
            setAllFirestoreMatches(clubMatches);
        } else {
            setAllFirestoreMatches([]);
        }

        const sessionsSnap = await getDocs(query(collection(db, "trainingSessions"), where("clubId", "==", activeClub.id)));
        setAllFirestoreTrainingSessions(sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate()} as TrainingSession)));
      }),
    ];
    
    setDashboardDataLoading(false); // Consider loading complete after initial setup
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, [activeClub]);


  const getTeamName = (teamId: string): string => {
    return allFirestoreTeams.find(t => t.id === teamId)?.name || 'Equipo Desconocido';
  }
  
  const getStatusBadgeVariant = (status: Match['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Programado': return 'default';
      case 'En Progreso': return 'secondary';
      case 'Finalizado': return 'outline';
      case 'Pospuesto': return 'destructive';
      case 'Cancelado': return 'destructive';
      default: return 'default';
    }
  };
  
   const scrollCarousel = (direction: 'left' | 'right') => {
    if (matchCarouselRef.current) {
        const scrollAmount = matchCarouselRef.current.clientWidth * 0.75;
        matchCarouselRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    }
  };


  useEffect(() => {
    if (authIsLoading || clubLoading || dashboardDataLoading || !activeClub) return;

    // Upcoming Events Logic
    let filteredMatchesForUser: Match[] = [];
    let filteredTrainingsForUser: TrainingSession[] = [];

    if (userProfile) {
        switch (userProfile.role) {
        case 'Administrador':
        case 'Directivo Club':
            filteredMatchesForUser = allFirestoreMatches; // Already filtered by club
            filteredTrainingsForUser = allFirestoreTrainingSessions; // Already filtered by club
            break;
        case 'Entrenador':
            if (userProfile.managedTeamIds?.length) {
            filteredMatchesForUser = allFirestoreMatches.filter(m =>
                (m.homeTeamId && userProfile.managedTeamIds!.includes(m.homeTeamId)) ||
                (m.awayTeamId && userProfile.managedTeamIds!.includes(m.awayTeamId))
            );
            filteredTrainingsForUser = allFirestoreTrainingSessions.filter(s => s.teamId && userProfile.managedTeamIds!.includes(s.teamId));
            }
            break;
        case 'Jugador':
            if (userProfile.teamId) {
            filteredMatchesForUser = allFirestoreMatches.filter(m => m.homeTeamId === userProfile.teamId || m.awayTeamId === userProfile.teamId);
            filteredTrainingsForUser = allFirestoreTrainingSessions.filter(s => s.teamId === userProfile.teamId);
            }
            break;
        case 'Tutor':
            if (userProfile.linkedPlayerIds?.length) {
            const linkedPlayerTeamIds = Array.from(new Set(
                allFirestorePlayers
                .filter(p => userProfile.linkedPlayerIds!.includes(p.id))
                .map(p => p.teamId)
            ));
            filteredMatchesForUser = allFirestoreMatches.filter(m =>
                (m.homeTeamId && linkedPlayerTeamIds.includes(m.homeTeamId)) ||
                (m.awayTeamId && linkedPlayerTeamIds.includes(m.awayTeamId))
            );
            filteredTrainingsForUser = allFirestoreTrainingSessions.filter(s => s.teamId && linkedPlayerTeamIds.includes(s.teamId));
            }
            break;
        default:
            filteredMatchesForUser = allFirestoreMatches;
            filteredTrainingsForUser = allFirestoreTrainingSessions;
        }
    } else { // Not logged in, show all club events
        filteredMatchesForUser = allFirestoreMatches;
        filteredTrainingsForUser = allFirestoreTrainingSessions;
    }


    const futureUserMatches: CombinedEvent[] = filteredMatchesForUser
      .filter(match => match.status === 'Programado' && isFuture(match.date as Date))
      .map(match => ({
        id: match.id,
        type: 'match',
        date: match.date as Date,
        title: `${match.homeTeamName || getTeamName(match.homeTeamId!)} vs ${match.awayTeamName || getTeamName(match.awayTeamId!)}`,
        time: match.time,
        location: match.location || 'Por definir',
        icon: Trophy,
        homeTeamName: match.homeTeamName || getTeamName(match.homeTeamId!),
        awayTeamName: match.awayTeamName || getTeamName(match.awayTeamId!),
        homeTeamLogoUrl: match.homeTeamLogoUrl,
        awayTeamLogoUrl: match.awayTeamLogoUrl,
        href: `/calendar?date=${format(match.date as Date, 'yyyy-MM-dd')}`
      }));

    const futureUserTrainings: CombinedEvent[] = filteredTrainingsForUser
      .filter(session => isFuture(session.date as Date))
      .map(session => ({
        id: session.id,
        type: 'training',
        date: session.date as Date,
        title: `Entrenamiento ${getTeamName(session.teamId)}`,
        time: session.time,
        location: session.location || 'Por definir',
        icon: BookOpenCheck,
        href: `/attendance?date=${format(session.date as Date, 'yyyy-MM-dd')}`
      }));

    const combinedUserEvents = [...futureUserMatches, ...futureUserTrainings]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5); // Increased to 5 for better dashboard view

    setUserUpcomingEvents(combinedUserEvents);
  }, [userProfile, activeClub, allFirestorePlayers, allFirestorePosts, allFirestoreMatches, allFirestoreTrainingSessions, allFirestoreTeams, authIsLoading, clubLoading, dashboardDataLoading]);



  if (authIsLoading || clubLoading || dashboardDataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
         <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
        <div className="mb-8">
            <h3 className="text-xl font-headline mb-3">Próximos Partidos</h3>
            {allFirestoreMatches.length > 0 ? (
                <div className="relative group">
                     <div ref={matchCarouselRef} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                      {allFirestoreMatches.map((match) => {
                         const isOurTeamHome = allFirestoreTeams.some(t => t.id === match.homeTeamId);
                          return (
                            <Card key={match.id} className={cn("min-w-[280px] sm:min-w-[300px] snap-center flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300")}>
                                <CardHeader className="p-4"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"><div><h3 className="text-base font-semibold font-headline text-primary">{match.homeTeamName} vs {match.awayTeamName}</h3>{match.competition && (<p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="h-3 w-3" /> {match.competition}</p>)}</div><Badge variant={getStatusBadgeVariant(match.status)} className="mt-2 sm:mt-0 text-xs px-2 py-0.5 h-auto">{match.status}</Badge></div></CardHeader>
                                <CardContent className="p-4 pt-0 flex-grow"><div className="flex items-center justify-around"><div className="flex flex-col items-center text-center w-1/3"><Avatar className="h-14 w-16 mb-2 rounded-md"><AvatarImage src={match.homeTeamLogoUrl || `https://placehold.co/80x60.png`} alt={`${match.homeTeamName} Logo`} className="object-contain" data-ai-hint="team logo"/><AvatarFallback className="rounded-md">{match.homeTeamName?.[0]}</AvatarFallback></Avatar><p className="font-medium text-sm truncate max-w-full">{match.homeTeamName}</p></div>
                                    <div className="text-center w-1/3 px-2"><p className="text-xl font-bold text-muted-foreground font-headline">VS</p></div>
                                    <div className="flex flex-col items-center text-center w-1/3"><Avatar className="h-14 w-16 mb-2 rounded-md"><AvatarImage src={match.awayTeamLogoUrl || `https://placehold.co/80x60.png`} alt={`${match.awayTeamName} Logo`} className="object-contain" data-ai-hint="team logo"/><AvatarFallback className="rounded-md">{match.awayTeamName?.[0]}</AvatarFallback></Avatar><p className="font-medium text-sm truncate max-w-full">{match.awayTeamName}</p></div></div>
                                    <div className="text-center text-xs text-muted-foreground mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1"><p className="flex items-center justify-center gap-1"><CalendarClock className="h-3 w-3" />{format(new Date(match.date as Date), "EEE, dd MMM", { locale: es })}</p><p className="flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Hora: {match.time}</p>{match.convocationTime && <p className="sm:col-span-2 flex items-center justify-center gap-1"><UsersIcon className="h-3 w-3"/> Conv.: {match.convocationTime}</p>}{match.location && <p className="sm:col-span-2 flex items-center justify-center gap-1"><MapPin className="h-3 w-3" />{match.location}</p>}</div>
                                </CardContent>
                                <CardFooter className="p-3 border-t bg-muted/30 flex justify-end gap-2">
                                    <Button asChild size="sm" variant="default">
                                      <Link href={`/calendar?date=${format(match.date as Date, 'yyyy-MM-dd')}`}>
                                        <ClipboardCheck className="mr-2 h-4 w-4" /> Ver Convocatoria
                                      </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                      })}
                     </div>
                     <Button variant="outline" size="icon" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('left')}><ChevronLeft className="h-4 w-4"/></Button>
                     <Button variant="outline" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('right')}><ChevronRight className="h-4 w-4"/></Button>
                </div>
            ) : (
                <Card className="text-center p-4 shadow-sm mb-6"><ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No hay partidos próximos</h3><p className="mt-1 text-xs text-muted-foreground">No hay partidos programados en el futuro cercano.</p></Card>
            )}
        </div>
      <div className="grid gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Últimas Noticias</CardTitle>
            <CardDescription>Las publicaciones más recientes del club y los equipos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allFirestorePosts.slice(0, 2).length > 0 ? (
              allFirestorePosts.slice(0, 2).map(post => (
                <Link key={post.id} href="/team-wall" className="block cursor-pointer">
                    <div className="flex items-start gap-4 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
                    {post.imageUrl && (
                        <div className="relative w-24 h-16 flex-shrink-0 hidden sm:block">
                        <Image 
                            src={post.imageUrl} 
                            alt="Imagen de la noticia" 
                            fill
                            className="rounded-md object-cover"
                            data-ai-hint="team event"
                        />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5 border">
                            <AvatarImage src={post.authorAvatarUrl} alt={post.authorName} />
                            <AvatarFallback className="text-xs">{post.authorName?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{post.authorName}</span>
                        <span>&middot;</span>
                        <span>
                            {formatDistanceToNow(post.timestamp instanceof Timestamp ? post.timestamp.toDate() : post.timestamp, { addSuffix: true, locale: es })}
                        </span>
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                        {post.content}
                        </p>
                    </div>
                    </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hay noticias publicadas.</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end pt-0">
            <Link href="/team-wall" className={cn(buttonVariants({ variant: "link" }), "text-sm")}>
              Ver todas las noticias <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </CardFooter>
        </Card>
      </div>

      <Card id="quick-links-section" className="shadow-lg scroll-mt-20">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Accesos Rápidos</CardTitle>
          <CardDescription>Navega rápidamente a las secciones más importantes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <QuickLinkButton title="Ver Jugadores" href="/players" icon={Users} />
            <QuickLinkButton title="Convocatorias" href="/calendar" icon={ClipboardCheck} />
            <QuickLinkButton title="Entrenamientos" href="/attendance" icon={Dumbbell} />
            <QuickLinkButton title="Pizarra Táctica" href="/tactics" icon={Presentation} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardPageContent />
    </AuthGuard>
  );
}
