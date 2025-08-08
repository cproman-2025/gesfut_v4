

'use client';

import { useState, useEffect, type ChangeEvent, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; 
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, 
  serverTimestamp, query, orderBy, where, Timestamp, getDoc, writeBatch,
  arrayUnion, arrayRemove, limit
} from 'firebase/firestore';
import { 
  CATEGORY_RULES,
  MAX_CONVOCADOS, 
} from '@/lib/placeholder-data';
import type { Match, Team, Player, PlayerCallUp, MatchCallSheetItem, Club, LeagueCompetition, RivalTeam, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    CalendarClock, PlusCircle, MapPin, Trophy, ClipboardList, Calendar as CalendarIcon, 
    Users as UsersIcon, CheckCircle2, XCircle, MinusCircle, FileText, Info, Clock, Filter, 
    ShieldAlert, Star, Zap, Award, Edit2, Sparkles, LayoutGrid, List as ListIconLucide, Link as LinkIconLucide, UploadCloud, X as XIcon, Trash2, Search as SearchIcon, ClipboardCheck, HandHelping, Goal, Camera, Download, EyeOff, Eye, Save, NotebookPen, BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, startOfMonth, isFuture, isPast, isSameDay, parseISO, isValid, startOfDay, startOfWeek, endOfWeek, getMonth, getYear, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleRadix } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as ShadCalendar } from '@/components/ui/calendar'; 
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { summarizeMatch, type SummarizeMatchInput } from '@/ai/flows/summarize-match-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { usePageHeader } from '@/contexts/page-header-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toJpeg } from 'html-to-image';
import { ModernDialog } from '@/components/ui/modern-dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Textarea } from '@/components/ui/textarea';


const initialMatchFormData: Partial<Match> & { selectedCompetitionId?: string } = {
  id: undefined,
  selectedCompetitionId: undefined, 
  homeTeamId: undefined, 
  awayTeamId: undefined, 
  homeTeamName: '', 
  awayTeamName: '', 
  homeTeamLogoUrl: '',
  awayTeamLogoUrl: '',
  date: undefined,
  time: '',
  status: 'Programado',
  homeScore: undefined,
  awayScore: undefined,
  location: '',
  convocationTime: '',
  matchIncidents: '',
  rivalTeamInfo: '',
};

const MAX_UPCOMING_MATCHES_DISPLAYED = 3;

interface PlayerCardProps {
  player: Player;
  isSelected: boolean;
  onToggleSelection: (playerId: string) => void;
  isSelectionDisabled: boolean;
  isReadOnly: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, isSelected, onToggleSelection, isSelectionDisabled, isReadOnly }) => {
    const isDisabled = (isSelectionDisabled && !isSelected) || isReadOnly;
  
    return (
      <div 
        className={cn(
          'relative group aspect-[3/4] rounded-lg overflow-hidden transition-all duration-300 ease-in-out drop-shadow-lg',
          isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100' : 'opacity-80 grayscale',
          isDisabled ? 'cursor-not-allowed opacity-60 hover:opacity-60' : 'cursor-pointer'
        )}
        onClick={() => !isDisabled && onToggleSelection(player.id)}
      >
        <Image 
        src={player.avatarUrl || `https://placehold.co/150x200.png?text=${player.name[0]}`}
        alt={`Foto de ${player.name}`}
        fill
        className={cn(
            "object-cover object-top transition-all duration-300",
            !isDisabled && "group-hover:scale-105"
        )}
        data-ai-hint="player photo"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        <div 
            className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-lg border border-white/50 pointer-events-none"
        >
            {player.jerseyNumber}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-1.5 text-white pointer-events-none">
        <h3 className="font-headline text-xs font-bold truncate">{player.nickname || player.name}</h3>
        <p className="text-[10px] text-white/80">{player.position}</p>
        </div>
      </div>
    );
};

const StarRating: React.FC<{ value: number; onValueChange: (newValue: number) => void; readOnly?: boolean; }> = ({ value, onValueChange, readOnly=false }) => (
    <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => !readOnly && onValueChange(star)} disabled={readOnly} className={cn(!readOnly && "cursor-pointer")}>
                <Star className={cn("h-5 w-5 transition-colors", star <= value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50", !readOnly && "hover:text-yellow-300")} />
            </button>
        ))}
    </div>
);

const CardSelector: React.FC<{
  yellowCards: number;
  redCard: boolean;
  onYellowChange: (count: number) => void;
  onRedChange: (hasRed: boolean) => void;
  isReadOnly?: boolean;
}> = ({ yellowCards, redCard, onYellowChange, onRedChange, isReadOnly = false }) => {
  const handleYellowClick = () => {
    if (isReadOnly) return;
    const newCount = yellowCards >= 2 ? 0 : yellowCards + 1;
    onYellowChange(newCount);
    if (newCount >= 2) {
      onRedChange(true);
    } else if (!redCard) {
      onRedChange(false);
    }
  };

  const handleRedClick = () => {
    if (isReadOnly) return;
    const newRedState = !redCard;
    onRedChange(newRedState);
    if (!newRedState) {
      onYellowChange(0);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg p-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={handleYellowClick} className={cn("relative w-7 h-10 bg-yellow-400 rounded-sm shadow-md transition-all duration-200", yellowCards === 0 && "opacity-40 grayscale", !isReadOnly && "hover:scale-105", isReadOnly && "cursor-not-allowed")}>
              {yellowCards > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-white text-[10px] font-bold">
                  {yellowCards}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Añadir/Quitar Tarjeta Amarilla</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={handleRedClick} className={cn("relative w-7 h-10 bg-red-600 rounded-sm shadow-md transition-transform", !redCard && "opacity-40 grayscale", !isReadOnly && "hover:scale-105", isReadOnly && "cursor-not-allowed")}>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Añadir/Quitar Tarjeta Roja Directa</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};


export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const pathname = usePathname();
  const { userProfile, isLoading: authIsLoading } = useAuth();
  const { setHeader } = usePageHeader();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  
  const [teamsData, setTeamsData] = useState<Team[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<LeagueCompetition[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isMatchFormDialogOpen, setIsMatchFormDialogOpen] = useState(false);
  const [matchFormData, setMatchFormData] = useState(initialMatchFormData);
  const [isEditingMatch, setIsEditingMatch] = useState(false);
  
  const [selectedMatchForCallUp, setSelectedMatchForCallUp] = useState<Match | null>(null);
  const [callUpMatchData, setCallUpMatchData] = useState<Partial<Match>>({});
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [managedTeamPlayers, setManagedTeamPlayers] = useState<Player[]>([]);
  const [callUpViewMode, setCallUpViewMode] = useState<'card' | 'list'>('card');

  const [currentMinutesPlayedData, setCurrentMinutesPlayedData] = useState<Record<string, string | number>>({});
  const [currentGoalsData, setCurrentGoalsData] = useState<Record<string, string | number>>({});
  const [currentYellowCardsData, setCurrentYellowCardsData] = useState<Record<string, number>>({});
  const [currentRedCardData, setCurrentRedCardData] = useState<Record<string, boolean>>({});
  const [currentRatingData, setCurrentRatingData] = useState<Record<string, string | number>>({});
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [filterDateForList, setFilterDateForList] = useState<Date | undefined>(undefined);
  const [eventsViewMode, setEventsViewMode] = useState<'card' | 'list'>('card');

  const [availableTeamsForMatchDialog, setAvailableTeamsForMatchDialog] = useState<{id: string, name: string, logoUrl?: string, type: 'our_team' | 'rival'}[]>([]);
  
  const [allClubs, setAllClubs] = useState<Club[]>([]); 
  const [ourClubId, setOurClubId] = useState<string | undefined>(undefined); 
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotFilter, setSnapshotFilter] = useState<'convocados' | 'no-convocados' | 'all'>('convocados');
  const [snapshotViewMode, setSnapshotViewMode] = useState<'card' | 'list'>('card');
  const [snapshotDataType, setSnapshotDataType] = useState<'convocatoria' | 'resumen'>('convocatoria');
  const snapshotRef = useRef<HTMLDivElement>(null);
  const matchCarouselRef = useRef<HTMLDivElement>(null);

  const openAddMatchDialog = useCallback(() => {
    setIsEditingMatch(false);
    setMatchFormData(initialMatchFormData);
    setAvailableTeamsForMatchDialog([]); 
    setIsMatchFormDialogOpen(true);
  }, []);
  
  const headerAction = useMemo(() => {
    const canCreate = userProfile?.role === 'Administrador' || userProfile?.role === 'Directivo Club' || userProfile?.role === 'Entrenador';
    if (!canCreate) return null;

    return (
        <Button onClick={openAddMatchDialog} size={isMobile ? "icon" : "default"} className={cn(!isMobile && "px-2 sm:px-3")}>
            <PlusCircle className={cn("h-4 w-4", !isMobile && "sm:mr-2")} /> 
            <span className={cn(isMobile && "sr-only", "hidden sm:inline")}>Añadir Partido</span>
        </Button>
    )
  }, [openAddMatchDialog, isMobile, userProfile]);

  const canUserModifyMatch = (match: Match | null): boolean => {
    if (!userProfile || !match) return false;
    if (userProfile.role === 'Administrador' || userProfile.role === 'Directivo Club') return true;
    if (userProfile.role === 'Entrenador') {
        const isHomeCoach = match.homeTeamId && userProfile.managedTeamIds?.includes(match.homeTeamId);
        const isAwayCoach = match.awayTeamId && userProfile.managedTeamIds?.includes(match.awayTeamId);
        return !!(isHomeCoach || isAwayCoach);
    }
    return false;
  };
  
  const canUserManageCallUp = useMemo((): boolean => {
    if (!userProfile || !selectedMatchForCallUp) return false;
    return canUserModifyMatch(selectedMatchForCallUp);
  }, [userProfile, selectedMatchForCallUp]);


  const handleDeleteMatchRequest = (match: Match) => {
    if (canUserModifyMatch(match)) {
      setMatchToDelete(match);
    } else {
      toast({ title: "Acción no permitida", description: "No tienes permisos para eliminar este partido.", variant: "destructive" });
    }
  };

  const handleSaveCallUp = useCallback(async () => {
    if (!selectedMatchForCallUp || !selectedMatchForCallUp.id || !canUserManageCallUp) return;
    
    let totalGoals = 0;
    Object.values(currentGoalsData).forEach(g => { totalGoals += Number(g) || 0; });
    
    const managedTeam = teamsData.find(t => t.id === managedTeamPlayers[0]?.teamId);
    const isHomeTeam = selectedMatchForCallUp.homeTeamId === managedTeam?.id;
    const teamScore = isHomeTeam ? callUpMatchData.homeScore : callUpMatchData.awayScore;
    
    if (typeof teamScore === 'number' && totalGoals > teamScore) {
      toast({ title: "Error de Validación", description: `La suma de goles de los jugadores (${totalGoals}) no puede superar el marcador del equipo (${teamScore}).`, variant: "destructive", duration: 7000 });
      return;
    }

    const updatedCallSheet: MatchCallSheetItem[] = managedTeamPlayers.map(player => ({
        playerId: player.id,
        status: selectedPlayerIds.includes(player.id) ? 'Convocado' : 'No Convocado',
        minutesPlayed: Number(currentMinutesPlayedData[player.id]) || null,
        goals: Number(currentGoalsData[player.id]) || null,
        assists: null, // Note: assists are not captured in the current UI
        yellowCards: Number(currentYellowCardsData[player.id]) || 0,
        redCard: currentRedCardData[player.id] || false,
        rating: Number(currentRatingData[player.id]) || null,
    }));

    try {
      const matchDocRef = doc(db, "matches", selectedMatchForCallUp.id);
      const matchUpdates: Partial<Match> = {
        callSheet: updatedCallSheet,
        status: callUpMatchData.status,
        homeScore: callUpMatchData.status === 'Finalizado' ? (callUpMatchData.homeScore ?? null) : null,
        awayScore: callUpMatchData.status === 'Finalizado' ? (callUpMatchData.awayScore ?? null) : null,
        matchIncidents: callUpMatchData.matchIncidents || null,
        rivalTeamInfo: callUpMatchData.rivalTeamInfo || null,
        updatedAt: serverTimestamp()
      };
      await updateDoc(matchDocRef, matchUpdates as any);

      const batch = writeBatch(db);
      for (const item of updatedCallSheet) {
        const playerDocRef = doc(db, "players", item.playerId);
        const playerDoc = await getDoc(playerDocRef);
        if (playerDoc.exists()) {
          const playerData = playerDoc.data() as Player;
          const playerTeam = teamsData.find(t => t.id === playerData.teamId);
          let opponentNameDisplay = selectedMatchForCallUp.homeTeamId === playerTeam?.id ? selectedMatchForCallUp.awayTeamName : selectedMatchForCallUp.homeTeamName;
         
          const newCallUpRecord: PlayerCallUp = {
            matchId: selectedMatchForCallUp.id,
            opponentName: opponentNameDisplay,
            matchDate: (selectedMatchForCallUp.date as Date).toISOString(),
            status: item.status,
            playerTeamName: playerTeam?.name || 'Equipo del Jugador',
            competition: selectedMatchForCallUp.competition ?? null,
            minutesPlayed: item.minutesPlayed,
            goals: item.goals,
            assists: item.assists,
            yellowCards: item.yellowCards,
            redCard: item.redCard,
            rating: item.rating
          };
          
          const existingHistory = playerData.callUpHistory || [];
          const updatedHistory = existingHistory.filter(ch => ch.matchId !== selectedMatchForCallUp.id);
          updatedHistory.push(newCallUpRecord);
          updatedHistory.sort((a,b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
          batch.update(playerDocRef, { callUpHistory: updatedHistory, updatedAt: serverTimestamp() });
        }
      }
      await batch.commit();

      fetchPageData(); 
      toast({ title: "Convocatoria y Estadísticas Guardadas", description: `Info guardada para ${selectedMatchForCallUp.homeTeamName} vs ${selectedMatchForCallUp.awayTeamName}.` });
      setSelectedMatchForCallUp(null);
    } catch (error) {
      console.error("Error saving call-up:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar la información de convocatoria.", variant: "destructive" });
    }
  }, [selectedMatchForCallUp, callUpMatchData, selectedPlayerIds, currentMinutesPlayedData, currentGoalsData, currentYellowCardsData, currentRedCardData, currentRatingData, managedTeamPlayers, teamsData, toast, canUserManageCallUp]);

  const CallUpDialogHeader = useMemo(() => (
    canUserManageCallUp ? (
      <div className="flex items-center gap-1">
          <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleSaveCallUp} className="text-white hover:bg-white/20">
                          <Save className="h-4 w-4" />
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Guardar</p></TooltipContent>
              </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setIsSnapshotDialogOpen(true)} className="text-white hover:bg-white/20">
                          <Camera className="h-4 w-4" />
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Snapshot</p></TooltipContent>
              </Tooltip>
          </TooltipProvider>
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => selectedMatchForCallUp && handleDeleteMatchRequest(selectedMatchForCallUp)}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent><p>Eliminar Partido</p></TooltipContent>
             </Tooltip>
           </TooltipProvider>
      </div>
    ) : null
  ), [selectedMatchForCallUp, handleSaveCallUp, handleDeleteMatchRequest, canUserManageCallUp]);
  
  useEffect(() => {
    setHeader({
      title: 'Convocatorias',
      description: 'Gestiona convocatorias, partidos, resultados y estadísticas.',
      icon: ClipboardCheck,
      action: headerAction,
    });
  }, [setHeader, headerAction]);
  
  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const clubsSnapshot = await getDocs(query(collection(db, "clubs"), orderBy("name")));
      const loadedClubs = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
      setAllClubs(loadedClubs);

      let identifiedClubId: string | undefined = undefined;
      if (userProfile && userProfile.clubId) {
          identifiedClubId = userProfile.clubId;
      } else {
          const defaultClubQuery = query(collection(db, "clubs"), where("isDefault", "==", true), limit(1));
          const defaultClubSnapshot = await getDocs(defaultClubQuery);
          if (!defaultClubSnapshot.empty) {
              identifiedClubId = defaultClubSnapshot.docs[0].id;
          } else {
              const adAlhondigaClubByName = loadedClubs.find(c => c.name.toLowerCase().includes("a.d. alhóndiga"));
              if (adAlhondigaClubByName) {
                  identifiedClubId = adAlhondigaClubByName.id;
              }
          }
      }
      setOurClubId(identifiedClubId);


      const teamsSnapshot = await getDocs(query(collection(db, "teams"), orderBy("name")));
      const loadedTeams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeamsData(loadedTeams);

      const playersSnapshot = await getDocs(query(collection(db, "players"), orderBy("name")));
      const loadedPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(loadedPlayers);

      const matchesSnapshot = await getDocs(query(collection(db, "matches"), orderBy("date", "desc")));
      const enrichedMatches = matchesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const matchDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        let displayStatus = data.status;
        if (data.status === 'Programado' && isPast(matchDate)) {
            displayStatus = 'Finalizado';
        }

        const homeTeam = loadedTeams.find(t => t.id === data.homeTeamId);
        const awayTeam = loadedTeams.find(t => t.id === data.awayTeamId);

        return {
          id: docSnap.id,
          ...data,
          date: matchDate,
          status: displayStatus,
          homeTeamName: homeTeam?.name || data.homeTeamName,
          awayTeamName: awayTeam?.name || data.awayTeamName,
          homeTeamLogoUrl: homeTeam?.logoUrl || data.homeTeamLogoUrl,
          awayTeamLogoUrl: awayTeam?.logoUrl || data.awayTeamLogoUrl,
          callSheet: data.callSheet || [],
        } as Match;
      });
      setAllMatches(enrichedMatches);
      
      const competitionsSnapshot = await getDocs(query(collection(db, "leagueCompetitions"), orderBy("name")));
      setAllCompetitions(competitionsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as LeagueCompetition)));


    } catch (error) {
      console.error("Error fetching page data from Firestore:", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getTeamNameForDisplay = useCallback((teamId: string | undefined, teamNameDirect: string) => {
    return teamsData.find(t => t.id === teamId)?.name || teamNameDirect || 'Equipo Desconocido';
  }, [teamsData]);

  useEffect(() => {
    if (!authIsLoading) { 
      fetchPageData();
    }
  }, [authIsLoading, userProfile]); 

  useEffect(() => {
    const dateFromUrl = searchParams.get('date');
    if (dateFromUrl) {
      const parsedDate = parseISO(dateFromUrl);
      if (isValid(parsedDate)) {
        setFilterDateForList(startOfDay(parsedDate)); 
        setCurrentMonth(startOfMonth(parsedDate)); 
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (matchFormData.selectedCompetitionId) {
        const comp = allCompetitions.find(c => c.id === matchFormData.selectedCompetitionId);
        if (comp) {
            const ourTeamInComp = teamsData.find(t => t.id === comp.assignedClubTeamId);
            let teamsList: {id: string, name: string, logoUrl?: string, type: 'our_team' | 'rival'}[] = [];
            if (ourTeamInComp) {
                teamsList.push({ id: ourTeamInComp.id, name: ourTeamInComp.name, logoUrl: ourTeamInComp.logoUrl, type: 'our_team' });
            }
            comp.rivals.forEach(rival => {
                teamsList.push({ id: rival.id, name: rival.name, logoUrl: rival.logoUrl, type: 'rival' });
            });
            setAvailableTeamsForMatchDialog(teamsList);
        } else {
            setAvailableTeamsForMatchDialog([]);
        }
    } else {
        setAvailableTeamsForMatchDialog([]);
    }
  }, [matchFormData.selectedCompetitionId, allCompetitions, teamsData]);

  const matchesForUser = useMemo(() => {
    if (!userProfile || authIsLoading) return [];
    if (userProfile.role === 'Administrador' || userProfile.role === 'Directivo Club') {
      return allMatches;
    }
    
    let userTeamIds = userProfile.managedTeamIds || [];

    if (userProfile.teamId && !userTeamIds.includes(userProfile.teamId)) {
        userTeamIds.push(userProfile.teamId);
    }
    
    if (userProfile.role === 'Tutor' && userProfile.linkedPlayerIds && userProfile.linkedPlayerIds.length > 0) {
        const linkedPlayerTeams = players
            .filter(p => userProfile.linkedPlayerIds!.includes(p.id))
            .map(p => p.teamId);
        
        linkedPlayerTeams.forEach(teamId => {
            if (teamId && !userTeamIds.includes(teamId)) {
                userTeamIds.push(teamId);
            }
        });
    }

    if (userTeamIds.length > 0) {
        return allMatches.filter(match => 
            (match.homeTeamId && userTeamIds.includes(match.homeTeamId)) ||
            (match.awayTeamId && userTeamIds.includes(match.awayTeamId))
        );
    }

    return [];
  }, [allMatches, players, userProfile, authIsLoading]);

  const searchedMatches = useMemo(() => {
      if (!searchTerm.trim()) return matchesForUser;
      const lowerSearchTerm = searchTerm.trim().toLowerCase();
      return matchesForUser.filter(match => 
          match.homeTeamName.toLowerCase().includes(lowerSearchTerm) ||
          match.awayTeamName.toLowerCase().includes(lowerSearchTerm) ||
          (match.competition && match.competition.toLowerCase().includes(lowerSearchTerm))
      );
  }, [matchesForUser, searchTerm]);


 const displayedMatchesForMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    return searchedMatches
        .filter(match => {
            const matchDate = new Date(match.date as Date);
            return matchDate >= start && matchDate <= end;
        })
        .sort((a,b) => new Date(a.date as Date).getTime() - new Date(b.date as Date).getTime());
  }, [searchedMatches, currentMonth]);


  const scheduledMatchDates = useMemo(() => allMatches
    .filter(match => match.status === 'Programado')
    .map(match => startOfDay(new Date(match.date as Date))), [allMatches]);

  const finalizedMatchDates = useMemo(() => allMatches
    .filter(match => match.status === 'Finalizado')
    .map(match => startOfDay(new Date(match.date as Date))), [allMatches]);

  const currentWeek = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { locale: es });
    const end = endOfWeek(today, { locale: es });
    return { from: start, to: end };
  }, []);

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
  
  const handleMatchFormTeamSelect = (teamSelectionValue: string, teamType: 'home' | 'away') => {
    const [type, id] = teamSelectionValue.split(':');
    let selectedTeamData: { name: string, logoUrl?: string, id?: string } | undefined;

    if (type === 'our_team') {
        selectedTeamData = teamsData.find(t => t.id === id);
        if (selectedTeamData) {
            setMatchFormData(prev => ({
                ...prev,
                [`${teamType}TeamId`]: selectedTeamData!.id,
                [`${teamType}TeamName`]: selectedTeamData!.name,
                [`${teamType}TeamLogoUrl`]: selectedTeamData!.logoUrl || '',
            }));
        }
    } else if (type === 'rival') {
        const competition = allCompetitions.find(c => c.id === matchFormData.selectedCompetitionId);
        selectedTeamData = competition?.rivals.find(r => r.id === id); 
        if (selectedTeamData) {
             setMatchFormData(prev => ({
                ...prev,
                [`${teamType}TeamId`]: undefined, 
                [`${teamType}TeamName`]: selectedTeamData!.name,
                [`${teamType}TeamLogoUrl`]: selectedTeamData!.logoUrl || '',
            }));
        }
    }
  };


  const handleMatchFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if (name === 'selectedCompetitionId') {
        setMatchFormData(prev => ({ 
            ...initialMatchFormData,
            ...prev,
            selectedCompetitionId: value,
            homeTeamId: undefined, homeTeamName: '', homeTeamLogoUrl: '',
            awayTeamId: undefined, awayTeamName: '', awayTeamName: '',
        }));
    } else {
       setMatchFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMatchFormDateChange = (date: Date | undefined) => {
    setMatchFormData(prev => ({ ...prev, date }));
  };
  
  const handleMatchFormStatusChange = (status: Match['status']) => {
    setMatchFormData(prev => ({ ...prev, status }));
  };
  
  const handleMatchFormScoreChange = (value: string, teamType: 'homeScore' | 'awayScore') => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (value === '' || (numValue !== undefined && !isNaN(numValue) && numValue >= 0 && numValue <= 99)) {
      setMatchFormData(prev => ({ ...prev, [teamType]: numValue }));
    }
  };

  const openEditMatchDialog = (match: Match) => {
    setIsEditingMatch(true);
    const competitionForMatch = allCompetitions.find(c => c.id === match.competitionId);

    setMatchFormData({
      id: match.id,
      selectedCompetitionId: competitionForMatch?.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      homeTeamLogoUrl: match.homeTeamLogoUrl || '',
      awayTeamLogoUrl: match.awayTeamLogoUrl || '',
      date: new Date(match.date as Date), 
      time: match.time,
      location: match.location || '',
      status: match.status,
      homeScore: match.homeScore === null ? undefined : match.homeScore,
      awayScore: match.awayScore === null ? undefined : match.awayScore,
      convocationTime: match.convocationTime,
      matchIncidents: match.matchIncidents || '',
      rivalTeamInfo: match.rivalTeamInfo || '',
    });
    setIsMatchFormDialogOpen(true);
  };

  const handleSaveMatch = async () => {
    if (!matchFormData.homeTeamName?.trim() || !matchFormData.awayTeamName?.trim() || !matchFormData.date || !matchFormData.time || !matchFormData.selectedCompetitionId) {
      toast({ title: "Campos incompletos", description: "Competición, equipos, fecha y hora de partido son obligatorios.", variant: "destructive" });
      return;
    }
    if (matchFormData.homeTeamName.trim().toLowerCase() === matchFormData.awayTeamName.trim().toLowerCase()) {
      toast({ title: "Error en equipos", description: "Local y visitante no pueden ser el mismo.", variant: "destructive" });
      return;
    }
    
    const selectedCompetition = allCompetitions.find(c => c.id === matchFormData.selectedCompetitionId);

    const matchDataToSave = {
      homeTeamName: matchFormData.homeTeamName.trim(),
      awayTeamName: matchFormData.awayTeamName.trim(),
      homeTeamId: matchFormData.homeTeamId || null, 
      awayTeamId: matchFormData.awayTeamId || null, 
      homeTeamLogoUrl: matchFormData.homeTeamLogoUrl.trim() || null,
      awayTeamLogoUrl: matchFormData.awayTeamLogoUrl.trim() || null,
      date: Timestamp.fromDate(matchFormData.date!),
      time: matchFormData.time,
      convocationTime: matchFormData.convocationTime || null,
      location: matchFormData.location || null,
      competition: selectedCompetition?.name || null, 
      competitionId: matchFormData.selectedCompetitionId || null, 
      status: matchFormData.status,
      homeScore: matchFormData.status === 'Finalizado' ? (matchFormData.homeScore ?? null) : null,
      awayScore: matchFormData.status === 'Finalizado' ? (matchFormData.awayScore ?? null) : null,
      notes: matchFormData.status === 'Finalizado' ? allMatches.find(m => m.id === matchFormData.id)?.notes || null : null, 
      callSheet: isEditingMatch ? allMatches.find(m => m.id === matchFormData.id)?.callSheet || [] : [],
      matchIncidents: matchFormData.matchIncidents || null,
      rivalTeamInfo: matchFormData.rivalTeamInfo || null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEditingMatch && matchFormData.id) {
        const matchRef = doc(db, "matches", matchFormData.id);
        await updateDoc(matchRef, matchDataToSave as any);
        toast({ title: "Partido Actualizado", description: `El partido ${matchDataToSave.homeTeamName} vs ${matchDataToSave.awayTeamName} ha sido actualizado.` });
      } else {
        await addDoc(collection(db, "matches"), { ...matchDataToSave, createdAt: serverTimestamp() });
        toast({ title: "Partido Añadido", description: `El partido ${matchDataToSave.homeTeamName} vs ${matchDataToSave.awayTeamName} ha sido programado.` });
      }
      fetchPageData(); 
      setIsMatchFormDialogOpen(false);
      setMatchFormData(initialMatchFormData);
    } catch (error) {
      console.error("Error saving match to Firestore:", error);
      toast({ title: "Error al Guardar Partido", description: "No se pudo guardar el partido.", variant: "destructive" });
    }
  };
  
  const openCallUpDialog = (match: Match) => {
    setSelectedMatchForCallUp(match);
    setCallUpMatchData({
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      matchIncidents: match.matchIncidents || '',
      rivalTeamInfo: match.rivalTeamInfo || '',
    });

    let teamToManageId: string | null = null;
    if (ourClubId) {
        const homeTeam = teamsData.find(t => t.id === match.homeTeamId);
        const awayTeam = teamsData.find(t => t.id === match.awayTeamId);

        if (homeTeam && homeTeam.clubId === ourClubId) {
            teamToManageId = homeTeam.id;
        } else if (awayTeam && awayTeam.clubId === ourClubId) {
            teamToManageId = awayTeam.id;
        }
    }

    let teamPlayers: Player[] = [];
    if (!teamToManageId) {
        console.warn('openCallUpDialog: Could not identify a manageable team for this match.', { matchId: match.id, ourClubId });
    } else {
        teamPlayers = players.filter(p => p.teamId === teamToManageId);
    }
    
    teamPlayers.sort((a,b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));
    setManagedTeamPlayers(teamPlayers);
    
    const initialSelectedIds = match.callSheet?.filter(item => item.status === 'Convocado').map(item => item.playerId) || [];
    setSelectedPlayerIds(initialSelectedIds);
    
    const statsData: { [key: string]: Record<string, any> } = { minutes: {}, goals: {}, yellow: {}, red: {}, rating: {} };
    match.callSheet?.forEach(item => {
        statsData.minutes[item.playerId] = item.minutesPlayed ?? '';
        statsData.goals[item.playerId] = item.goals ?? '';
        statsData.yellow[item.playerId] = item.yellowCards ?? 0;
        statsData.red[item.playerId] = item.redCard ?? false;
        statsData.rating[item.playerId] = item.rating ?? '';
    });
    
    setCurrentMinutesPlayedData(statsData.minutes);
    setCurrentGoalsData(statsData.goals);
    setCurrentYellowCardsData(statsData.yellow);
    setCurrentRedCardData(statsData.red);
    setCurrentRatingData(statsData.rating);
  };
  
  const handleTogglePlayerSelection = (playerId: string) => {
    if (!canUserManageCallUp) return;
    setSelectedPlayerIds(prev => {
      const isSelected = prev.includes(playerId);
      if (isSelected) {
        return prev.filter(id => id !== playerId);
      } else {
        if (prev.length >= MAX_CONVOCADOS) {
          toast({ title: `Límite de ${MAX_CONVOCADOS} jugadores alcanzado`, variant: "destructive" });
          return prev;
        }
        return [...prev, playerId];
      }
    });
  };
  
  const confirmDeleteMatch = async () => {
    if (!matchToDelete || !matchToDelete.id) return;
    if (!canUserModifyMatch(matchToDelete)) {
       toast({ title: "Error de Permisos", description: "No tienes permiso para eliminar este partido.", variant: "destructive" });
       setMatchToDelete(null);
       return;
    }

    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, "matches", matchToDelete.id);
      batch.delete(matchRef);

      const playersCollection = collection(db, "players");
      const playersSnapshot = await getDocs(playersCollection); 
      
      playersSnapshot.forEach(playerDoc => {
        const playerData = playerDoc.data() as Player;
        if (playerData.callUpHistory && playerData.callUpHistory.some(ch => ch.matchId === matchToDelete.id)) {
          const updatedHistory = playerData.callUpHistory.filter(ch => ch.matchId !== matchToDelete.id);
          batch.update(playerDoc.ref, { callUpHistory: updatedHistory, updatedAt: serverTimestamp() });
        }
      });
      
      await batch.commit();
      toast({ title: "Partido Eliminado", description: `El partido ${matchToDelete.homeTeamName} vs ${matchToDelete.awayTeamName} y su historial de convocatorias asociado han sido eliminados.` });
      fetchPageData(); 
    } catch (error) {
      console.error("Error deleting match:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el partido.", variant: "destructive" });
    } finally {
      setMatchToDelete(null);
      if (isMatchFormDialogOpen && matchFormData.id === matchToDelete?.id) setIsMatchFormDialogOpen(false);
      if (selectedMatchForCallUp && selectedMatchForCallUp.id === matchToDelete?.id) setSelectedMatchForCallUp(null);
    }
  };
  
  const handleDownloadSnapshot = useCallback(async () => {
    if (!snapshotRef.current) return;
    try {
      const dataUrl = await toJpeg(snapshotRef.current, { 
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: 'white',
        style: {
          margin: '0',
          padding: '16px'
        }
      });
      const link = document.createElement('a');
      const dataType = snapshotDataType === 'convocatoria' ? 'convocatoria' : 'resumen';
      link.download = `${dataType}-${selectedMatchForCallUp?.homeTeamName}-vs-${selectedMatchForCallUp?.awayTeamName}.jpeg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error al generar snapshot:', error);
      toast({
        title: "Error al generar imagen",
        description: "No se pudo crear la imagen de la convocatoria.",
        variant: "destructive",
      });
    }
  }, [selectedMatchForCallUp, toast, snapshotDataType]);
  
  const snapshotPlayers = useMemo(() => {
    if (!selectedMatchForCallUp) return [];
    if (snapshotFilter === 'all') return managedTeamPlayers;
    if (snapshotFilter === 'convocados') return managedTeamPlayers.filter(p => selectedPlayerIds.includes(p.id));
    if (snapshotFilter === 'no-convocados') return managedTeamPlayers.filter(p => !selectedPlayerIds.includes(p.id));
    return [];
  }, [snapshotFilter, managedTeamPlayers, selectedPlayerIds, selectedMatchForCallUp]);
  
  const snapshotTeamStats = useMemo(() => {
    if (!selectedMatchForCallUp) return { goals: 0, yellowCards: 0, redCards: 0 };
    
    let goals = 0;
    let yellowCards = 0;
    let redCards = 0;

    selectedMatchForCallUp.callSheet?.forEach(item => {
        goals += item.goals || 0;
        yellowCards += item.yellowCards || 0;
        if (item.redCard) redCards++;
    });

    return { goals, yellowCards, redCards };
  }, [selectedMatchForCallUp]);
  
   const scrollCarousel = (direction: 'left' | 'right') => {
    if (matchCarouselRef.current) {
        const scrollAmount = matchCarouselRef.current.clientWidth * 0.75;
        matchCarouselRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    }
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardContent className="p-2 sm:p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                  <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por equipo, competición..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="flex items-center gap-2 justify-end">
                  <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={eventsViewMode === 'card' ? 'default' : 'outline'} size="icon" onClick={() => setEventsViewMode('card')} aria-label="Tarjetas"><LayoutGrid className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Tarjetas</p></TooltipContent></Tooltip></TooltipProvider>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={eventsViewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setEventsViewMode('list')} aria-label="Lista"><ListIconLucide className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Lista</p></TooltipContent></Tooltip></TooltipProvider>
              </div>
          </div>
          <ShadCalendar
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={filterDateForList}
            onSelect={(date) => {
              setFilterDateForList(date);
              if (date) router.replace(`${pathname}?date=${format(date, 'yyyy-MM-dd')}`, { scroll: false });
              else router.replace(pathname, { scroll: false });
            }}
            modifiers={{ 
                scheduled: scheduledMatchDates,
                finalized: finalizedMatchDates,
                currentWeek: currentWeek,
            }}
            modifiersClassNames={{ 
                scheduled: 'day-scheduled',
                finalized: 'day-finalized',
                currentWeek: 'day-current-week',
                today: 'day-today',
                selected: 'day-selected'
            }}
            locale={es}
            className="rounded-md border"
            showOutsideDays={false}
          />
          {filterDateForList && (
            <div className="text-center">
              <Button variant="ghost" onClick={() => { setFilterDateForList(undefined); router.replace(pathname, { scroll: false }); }}>
                <Filter className="mr-2 h-4 w-4" /> Limpiar filtro fecha
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mb-8">
        <h3 className="text-xl font-headline mb-3">
          {`Partidos de ${format(currentMonth, "MMMM 'de' yyyy", { locale: es })}`}
        </h3>
          {displayedMatchesForMonth.length > 0 ? (
            eventsViewMode === 'card' ? (
              <div className="relative group">
                 <div ref={matchCarouselRef} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                  {displayedMatchesForMonth.map((match) => {
                     const isOurTeamHome = teamsData.some(t => t.id === match.homeTeamId);
                     const result = match.status === 'Finalizado' && typeof match.homeScore === 'number' && typeof match.awayScore === 'number'
                        ? (isOurTeamHome && match.homeScore > match.awayScore) || (!isOurTeamHome && match.awayScore > match.homeScore) ? 'win'
                        : (isOurTeamHome && match.homeScore < match.awayScore) || (!isOurTeamHome && match.awayScore < match.homeScore) ? 'loss' : 'draw'
                        : null;
                      const isSelected = filterDateForList && isSameDay(new Date(match.date), filterDateForList);
                      return (
                        <Card key={match.id} className={cn(
                          "min-w-[280px] sm:min-w-[300px] snap-center flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300", 
                          isSelected ? 'ring-2 ring-primary border-primary' : '',
                          result === 'win' && 'bg-green-500/10 border-green-500/20',
                          result === 'loss' && 'bg-red-500/10 border-red-500/20',
                          result === 'draw' && 'bg-blue-500/10 border-blue-500/20'
                        )}>
                            <CardHeader className="p-4"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"><div><h3 className="text-base font-semibold font-headline text-primary">{match.homeTeamName} vs {match.awayTeamName}</h3>{match.competition && (<p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="h-3 w-3" /> {match.competition}</p>)}</div><Badge variant={getStatusBadgeVariant(match.status)} className="mt-2 sm:mt-0 text-xs px-2 py-0.5 h-auto">{match.status}</Badge></div></CardHeader>
                            <CardContent className="p-4 pt-0 flex-grow"><div className="flex items-center justify-around"><div className="flex flex-col items-center text-center w-1/3"><Avatar className="h-14 w-16 mb-2 rounded-md"><AvatarImage src={match.homeTeamLogoUrl || `https://placehold.co/80x60.png`} alt={`${match.homeTeamName} Logo`} className="object-contain" data-ai-hint="team logo"/><AvatarFallback className="rounded-md">{match.homeTeamName?.[0]}</AvatarFallback></Avatar><p className="font-medium text-sm truncate max-w-full">{match.homeTeamName}</p></div>
                                <div className="text-center w-1/3 px-2">{match.status === 'Finalizado' && (typeof match.homeScore === 'number' && typeof match.awayScore === 'number') ? (<p className="text-2xl font-bold font-headline">{match.homeScore} - {match.awayScore}</p>) : match.status === 'Programado' || match.status === 'En Progreso' ? (<p className="text-xl font-bold text-muted-foreground font-headline">VS</p>) : (<p className="text-sm text-muted-foreground">-</p>)}</div>
                                <div className="flex flex-col items-center text-center w-1/3"><Avatar className="h-14 w-16 mb-2 rounded-md"><AvatarImage src={match.awayTeamLogoUrl || `https://placehold.co/80x60.png`} alt={`${match.awayTeamName} Logo`} className="object-contain" data-ai-hint="team logo"/><AvatarFallback className="rounded-md">{match.awayTeamName?.[0]}</AvatarFallback></Avatar><p className="font-medium text-sm truncate max-w-full">{match.awayTeamName}</p></div></div>
                                <div className="text-center text-xs text-muted-foreground mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1"><p className="flex items-center justify-center gap-1"><CalendarClock className="h-3 w-3" />{format(new Date(match.date as Date), "EEE, dd MMM", { locale: es })}</p><p className="flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Hora: {match.time}</p>{match.convocationTime && <p className="sm:col-span-2 flex items-center justify-center gap-1"><UsersIcon className="h-3 w-3"/> Conv.: {match.convocationTime}</p>}{match.location && <p className="sm:col-span-2 flex items-center justify-center gap-1"><MapPin className="h-3 w-3" />{match.location}</p>}</div>
                            </CardContent>
                            <CardFooter className="p-3 border-t bg-muted/30 flex justify-end gap-1">
                                {canUserModifyMatch(match) && (<TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => openEditMatchDialog(match)}><Edit2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar Partido</p></TooltipContent></Tooltip></TooltipProvider>)}
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => openCallUpDialog(match)}><BarChart3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>{match.status === 'Programado' ? "Gestionar" : "Stats"}</p></TooltipContent></Tooltip></TooltipProvider>
                            </CardFooter>
                        </Card>
                    );
                  })}
                 </div>
                 <Button variant="outline" size="icon" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('left')}><ChevronLeft className="h-4 w-4"/></Button>
                 <Button variant="outline" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('right')}><ChevronRight className="h-4 w-4"/></Button>
              </div>
            ) : (
                <div className="rounded-md border shadow-sm"><Table><TableHeader><TableRow><TableHead className="w-[80px] hidden sm:table-cell">Local</TableHead><TableHead className="w-[80px] hidden sm:table-cell">Visitante</TableHead><TableHead>Detalles</TableHead><TableHead className="hidden md:table-cell text-center">Resultado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                    <TableBody>{displayedMatchesForMonth.map((match) => (
                          <TableRow key={match.id} className={cn(
                            'h-16',
                            match.status === 'Finalizado' && (() => {
                                const isOurTeamHome = teamsData.some(t => t.id === match.homeTeamId);
                                const result = (isOurTeamHome && match.homeScore! > match.awayScore!) || (!isOurTeamHome && match.awayScore! > match.homeScore!) ? 'win'
                                    : (isOurTeamHome && match.homeScore! < match.awayScore!) || (!isOurTeamHome && match.awayScore! < match.homeScore!) ? 'loss' : 'draw';
                                return result === 'win' ? 'bg-green-500/10' : result === 'loss' ? 'bg-red-500/10' : 'bg-blue-500/10';
                            })()
                          )}>
                              <TableCell className="hidden sm:table-cell"><div className="flex items-center gap-2"><Avatar className="h-9 w-12 rounded-md"><AvatarImage src={match.homeTeamLogoUrl || `https://placehold.co/48x36.png`} alt={match.homeTeamName} className="object-contain" data-ai-hint="team logo" /><AvatarFallback className="rounded-md">{match.homeTeamName.substring(0,1)}</AvatarFallback></Avatar><span className="font-medium truncate max-w-[100px]">{match.homeTeamName}</span></div></TableCell>
                              <TableCell className="hidden sm:table-cell"><div className="flex items-center gap-2"><Avatar className="h-9 w-12 rounded-md"><AvatarImage src={match.awayTeamLogoUrl || `https://placehold.co/48x36.png`} alt={match.awayTeamName} className="object-contain" data-ai-hint="team logo" /><AvatarFallback className="rounded-md">{match.awayTeamName.substring(0,1)}</AvatarFallback></Avatar><span className="font-medium truncate max-w-[100px]">{match.awayTeamName}</span></div></TableCell>
                              <TableCell><div className="font-medium sm:hidden">{match.homeTeamName} vs {match.awayTeamName}</div><div className="text-xs text-muted-foreground">{format(new Date(match.date as Date), "dd MMM yy", { locale: es })} - {match.time}</div><div className="text-xs text-muted-foreground truncate max-w-[150px]">{match.competition}</div>{match.location && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{match.location}</div>}</TableCell>
                              <TableCell className="hidden md:table-cell text-center">{match.status === 'Finalizado' && (typeof match.homeScore === 'number' && typeof match.awayScore === 'number') ? (<span className="font-semibold">{match.homeScore} - {match.awayScore}</span>) : (<Badge variant={getStatusBadgeVariant(match.status)} className="text-xs">{match.status}</Badge>)}</TableCell>
                              <TableCell className="text-right"><div className="flex gap-1 justify-end">
                                {canUserModifyMatch(match) && (<TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => openEditMatchDialog(match)} aria-label="Editar"><Edit2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip></TooltipProvider>)}
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => openCallUpDialog(match)}><BarChart3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>{match.status === 'Programado' ? "Gestionar" : "Stats"}</p></TooltipContent></Tooltip></TooltipProvider>
                                {canUserModifyMatch(match) && (<TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8" onClick={() => handleDeleteMatchRequest(match)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Eliminar Partido</p></TooltipContent></Tooltip></TooltipProvider>)}
                              </div></TableCell>
                          </TableRow>
                    ))}</TableBody>
                </Table>
                </div>
            )
          ) : (
             <Card className="text-center p-4 shadow-sm mb-6"><ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No hay partidos</h3><p className="mt-1 text-xs text-muted-foreground">No hay partidos programados o jugados en este mes.</p></Card>
          )}
      </div>

          
      <Dialog open={isMatchFormDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setMatchFormData(initialMatchFormData); } setIsMatchFormDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl">{isEditingMatch ? 'Editar Partido' : 'Crear Nuevo Partido'}</DialogTitle>
                <DialogDescription>{isEditingMatch ? 'Modifica los detalles del partido.' : 'Programa un nuevo partido para una competición.'}</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-1"><Label htmlFor="competition-dialog-select">Competición*</Label><Select name="selectedCompetitionId" value={matchFormData.selectedCompetitionId || ''} onValueChange={(value) => handleMatchFormInputChange({ target: { name: 'selectedCompetitionId', value } } as any)}><SelectTrigger id="competition-dialog-select"><SelectValue placeholder="Selecciona competición" /></SelectTrigger><SelectContent>{allCompetitions.map(comp => (<SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="home-team-dialog-select">Equipo Local*</Label><Select value={ matchFormData.homeTeamId ? `our_team:${matchFormData.homeTeamId}` : availableTeamsForMatchDialog.find(t => t.name === matchFormData.homeTeamName)?.id ? `rival:${availableTeamsForMatchDialog.find(t => t.name === matchFormData.homeTeamName)!.id}` : '' } onValueChange={(value) => handleMatchFormTeamSelect(value, 'home')} disabled={!matchFormData.selectedCompetitionId}><SelectTrigger id="home-team-dialog-select"><SelectValue placeholder="Selecciona equipo" /></SelectTrigger><SelectContent>{availableTeamsForMatchDialog.map(team => (<SelectItem key={`${team.type}-${team.id}`} value={`${team.type}:${team.id}`}>{team.name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="away-team-dialog-select">Equipo Visitante*</Label><Select value={ matchFormData.awayTeamId ? `our_team:${matchFormData.awayTeamId}` : availableTeamsForMatchDialog.find(t => t.name === matchFormData.awayTeamName)?.id ? `rival:${availableTeamsForMatchDialog.find(t => t.name === matchFormData.awayTeamName)!.id}` : '' } onValueChange={(value) => handleMatchFormTeamSelect(value, 'away')} disabled={!matchFormData.selectedCompetitionId}><SelectTrigger id="away-team-dialog-select"><SelectValue placeholder="Selecciona equipo" /></SelectTrigger><SelectContent>{availableTeamsForMatchDialog.map(team => (<SelectItem key={`${team.type}-${team.id}`} value={`${team.type}:${team.id}`}>{team.name}</SelectItem>))}</SelectContent></Select></div></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="match-date">Fecha*</Label><Popover><PopoverTrigger asChild><Button id="match-date" variant="outline" className={cn("w-full justify-start text-left font-normal", !matchFormData.date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{matchFormData.date ? format(matchFormData.date, "PPP", { locale: es }) : <span>Selecciona fecha</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><ShadCalendar mode="single" selected={matchFormData.date as Date} onSelect={handleMatchFormDateChange} initialFocus /></PopoverContent></Popover></div><div className="space-y-1"><Label htmlFor="match-time">Hora Partido*</Label><Input id="match-time" name="time" type="time" value={matchFormData.time || ''} onChange={handleMatchFormInputChange} /></div></div>
                 <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="match-location">Lugar</Label><Input id="match-location" name="location" value={matchFormData.location || ''} onChange={handleMatchFormInputChange} placeholder="Estadio, campo, etc." /></div><div className="space-y-1"><Label htmlFor="match-convocation-time">Hora Convocatoria</Label><Input id="match-convocation-time" name="convocationTime" type="time" value={matchFormData.convocationTime || ''} onChange={handleMatchFormInputChange} /></div></div>
                <div className="space-y-1"><Label htmlFor="match-status">Estado</Label><Select name="status" value={matchFormData.status || 'Programado'} onValueChange={(value) => handleMatchFormStatusChange(value as Match['status'])}><SelectTrigger id="match-status"><SelectValue placeholder="Estado del partido" /></SelectTrigger><SelectContent><SelectItem value="Programado">Programado</SelectItem><SelectItem value="En Progreso">En Progreso</SelectItem><SelectItem value="Finalizado">Finalizado</SelectItem><SelectItem value="Pospuesto">Pospuesto</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
                {matchFormData.status === 'Finalizado' && (<div className="space-y-2"><Label>Marcador Final</Label><div className="grid grid-cols-2 gap-4"><Input id="homeScore" type="number" placeholder={`Goles ${matchFormData.homeTeamName || 'Local'}`} value={matchFormData.homeScore ?? ''} onChange={(e) => handleMatchFormScoreChange(e.target.value, 'homeScore')} /><Input id="awayScore" type="number" placeholder={`Goles ${matchFormData.awayTeamName || 'Visitante'}`} value={matchFormData.awayScore ?? ''} onChange={(e) => handleMatchFormScoreChange(e.target.value, 'awayScore')} /></div></div>)}
            </div>
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="button" onClick={handleSaveMatch}>Guardar Partido</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {selectedMatchForCallUp && (
        <ModernDialog isOpen={!!selectedMatchForCallUp} onClose={() => setSelectedMatchForCallUp(null)} title="Convocatorias" size="2xl" type="info" headerActions={CallUpDialogHeader} footerContent={ <div className="flex flex-col-reverse sm:flex-row sm:justify-between w-full p-4 border-t shrink-0 items-center gap-2"><div className="flex items-center gap-2"><span className="text-sm font-medium text-muted-foreground hidden md:inline">Convocados: <span className="font-bold text-foreground">{selectedPlayerIds.length} / {MAX_CONVOCADOS}</span> | Total: <span className="font-bold text-foreground">{managedTeamPlayers.length}</span></span></div><div className="flex items-center gap-2 justify-center sm:justify-end"><Button variant={callUpViewMode === 'card' ? 'secondary' : 'outline'} size='icon' className='h-8 w-8' onClick={()=> setCallUpViewMode('card')}><LayoutGrid className='h-4 w-4'/></Button><Button variant={callUpViewMode === 'list' ? 'secondary' : 'outline'} size='icon' className='h-8 w-8' onClick={()=> setCallUpViewMode('list')}><ListIconLucide className='h-4 w-4'/></Button></div></div> }>
          <div className="flex-1 min-h-0 flex flex-col"><div className="p-4 border-b shrink-0"><div className="flex items-center justify-around text-center"><div className="flex-1 space-y-1"><Avatar className="h-16 w-20 mx-auto rounded-md border-2"><AvatarImage src={selectedMatchForCallUp.homeTeamLogoUrl || `https://placehold.co/80x60.png`} alt={selectedMatchForCallUp.homeTeamName} className="object-contain" data-ai-hint="team logo"/><AvatarFallback>{selectedMatchForCallUp.homeTeamName?.[0] || 'L'}</AvatarFallback></Avatar><h3 className="font-semibold text-sm truncate">{selectedMatchForCallUp.homeTeamName}</h3></div><div className="px-4"><p className="text-2xl font-bold">{callUpMatchData.status === 'Finalizado' ? `${callUpMatchData.homeScore ?? '-'} - ${callUpMatchData.awayScore ?? '-'}`: 'VS'}</p><p className="text-xs text-muted-foreground">{format(new Date(selectedMatchForCallUp.date as Date), "dd MMM yyyy", { locale: es })}</p></div><div className="flex-1 space-y-1"><Avatar className="h-16 w-20 mx-auto rounded-md border-2"><AvatarImage src={selectedMatchForCallUp.awayTeamLogoUrl || `https://placehold.co/80x60.png`} alt={selectedMatchForCallUp.awayTeamName} className="object-contain" data-ai-hint="team logo"/><AvatarFallback>{selectedMatchForCallUp.awayTeamName?.[0] || 'V'}</AvatarFallback></Avatar><h3 className="font-semibold text-sm truncate">{selectedMatchForCallUp.awayTeamName}</h3></div></div></div>
          <Tabs defaultValue="call-up" className="flex-1 min-h-0 flex flex-col"><TabsList className="grid w-full grid-cols-3 shrink-0 rounded-none border-b px-4"><TabsTrigger value="call-up">Convocatoria</TabsTrigger><TabsTrigger value="stats">Estadísticas</TabsTrigger><TabsTrigger value="notes">Observaciones</TabsTrigger></TabsList>
            <div className="flex-1 min-h-0 overflow-hidden">
                <TabsContent value="call-up" className="h-full"><ScrollArea className="h-full">{callUpViewMode === 'card' ? (<div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">{managedTeamPlayers.length > 0 ? (managedTeamPlayers.map(player => (<PlayerCard key={player.id} player={player} isSelected={selectedPlayerIds.includes(player.id)} onToggleSelection={handleTogglePlayerSelection} isSelectionDisabled={selectedPlayerIds.length >= MAX_CONVOCADOS} isReadOnly={!canUserManageCallUp} />))) : (<div className="col-span-full flex-grow flex items-center justify-center p-8"><Alert variant="default" className="w-auto"><Info className="h-4 w-4" /><AlertDescription>No hay jugadores para el equipo gestionable en este partido.</AlertDescription></Alert></div>)}</div>) : (<Table><TableHeader><TableRow><TableHead className="w-[80px]">Jugador</TableHead><TableHead className="w-auto">Nombre</TableHead><TableHead className="text-center">Posición</TableHead><TableHead className="text-center">Dorsal</TableHead></TableRow></TableHeader><TableBody>{managedTeamPlayers.map(player => (<TableRow key={player.id} onClick={() => handleTogglePlayerSelection(player.id)} className={cn(canUserManageCallUp && "cursor-pointer", selectedPlayerIds.includes(player.id) && "bg-green-100/50 dark:bg-green-900/20")}><TableCell><div className={cn("relative w-12 h-16 rounded-md overflow-hidden shrink-0 bg-muted border-2", selectedPlayerIds.includes(player.id) ? "border-green-500" : "border-transparent")}><Image src={player.avatarUrl || 'https://placehold.co/64x80.png'} alt={player.name} fill className={cn("object-cover object-top", !selectedPlayerIds.includes(player.id) && "grayscale")} data-ai-hint="player avatar"/></div></TableCell><TableCell><span className="font-medium">{player.nickname || player.name}</span></TableCell><TableCell className="text-center">{player.position}</TableCell><TableCell className="text-center">{player.jerseyNumber}</TableCell></TableRow>))}</TableBody></Table>)}</ScrollArea></TabsContent>
                <TabsContent value="stats" className="h-full"><ScrollArea className="h-full"><div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">{selectedPlayerIds.length > 0 ? (<>{managedTeamPlayers.filter(p => selectedPlayerIds.includes(p.id)).map(player => { const playerTeam = teamsData.find(t => t.id === player.teamId); const category = playerTeam?.category || 'Default'; const maxMinutes = CATEGORY_RULES[category]?.duration || 90; const minuteOptions = Array.from({ length: (maxMinutes / 5) + 1 }, (_, i) => i * 5); return (<Card key={player.id} className="p-3 shadow-sm bg-muted/30"><div className="flex flex-col md:flex-row items-center gap-3"><div className="flex flex-col md:flex-row items-center gap-3 flex-1 w-full"><div className="relative w-20 h-24 shrink-0 rounded-md overflow-hidden border-2 border-background shadow-lg group"><Image src={player.avatarUrl || 'https://placehold.co/80x96.png'} alt={player.name} fill className="object-cover" data-ai-hint="player avatar" /><div className="absolute top-0 right-0 flex h-7 w-7 items-center justify-center rounded-bl-md rounded-tr-sm bg-black/80 text-white text-sm font-bold shadow-md">{player.jerseyNumber}</div></div><div className="flex-1 space-y-0.5 w-full text-center md:text-left"><p className="font-semibold leading-tight">{player.nickname || player.name}</p><p className="text-xs text-muted-foreground">{player.position}</p><StarRating value={Number(currentRatingData[player.id]) || 0} onValueChange={(r) => setCurrentRatingData(p => ({ ...p, [player.id]: r }))} readOnly={!canUserManageCallUp || currentRedCardData[player.id] || (currentYellowCardsData[player.id] as number >= 2)} /></div></div><div className="grid grid-cols-3 gap-x-3 gap-y-2 pt-2 border-t md:border-t-0 md:border-l md:pl-3 w-full md:w-auto"><div className="space-y-1 col-span-3 md:col-span-1"><Label htmlFor={`min-${player.id}`} className="text-xs">Minutos</Label><Select value={String(currentMinutesPlayedData[player.id] || '')} onValueChange={v => setCurrentMinutesPlayedData(p => ({ ...p, [player.id]: v }))} disabled={!canUserManageCallUp}><SelectTrigger id={`min-${player.id}`} className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger><SelectContent><ScrollArea className="h-48">{minuteOptions.map(m => (<SelectItem key={m} value={String(m)}>{m}</SelectItem>))}</ScrollArea></SelectContent></Select></div><div className="space-y-1 col-span-3 md:col-span-1"><Label htmlFor={`goals-${player.id}`} className="text-xs">Goles</Label><Input id={`goals-${player.id}`} type="number" value={currentGoalsData[player.id] || ''} onChange={e => setCurrentGoalsData(p => ({ ...p, [player.id]: e.target.value }))} className="h-8 text-xs" disabled={!canUserManageCallUp}/></div><div className="col-span-3 md:col-span-1 self-center justify-self-center pt-2"><CardSelector yellowCards={Number(currentYellowCardsData[player.id]) || 0} redCard={currentRedCardData[player.id] || false} onYellowChange={count => setCurrentYellowCardsData(p => ({ ...p, [player.id]: count }))} onRedChange={hasRed => setCurrentRedCardData(p => ({ ...p, [player.id]: hasRed }))} isReadOnly={!canUserManageCallUp}/></div></div></div></Card>)})}</>) : (<div className="text-center py-8 text-muted-foreground flex items-center justify-center h-full md:col-span-2"><p>No hay jugadores convocados para añadir estadísticas.</p></div>)}</div></ScrollArea></TabsContent>
                <TabsContent value="notes" className="h-full"><ScrollArea className="h-full"><div className="p-4 space-y-4"><div className="space-y-2"><Label htmlFor="matchIncidents" className="flex items-center gap-2 font-semibold text-base"><NotebookPen className="h-5 w-5"/> Incidencias del Partido</Label><Textarea id="matchIncidents" name="matchIncidents" placeholder="Anotaciones sobre eventos clave, decisiones arbitrales, comportamiento, etc." rows={6} value={callUpMatchData.matchIncidents || ''} onChange={(e) => setCallUpMatchData(p => ({...p, matchIncidents: e.target.value}))} readOnly={!canUserManageCallUp} /></div><div className="space-y-2"><Label htmlFor="rivalTeamInfo" className="flex items-center gap-2 font-semibold text-base"><Eye className="h-5 w-5"/> Información del Equipo Rival</Label><Textarea id="rivalTeamInfo" name="rivalTeamInfo" placeholder="Análisis del rival, puntos fuertes, debilidades, tácticas observadas..." rows={6} value={callUpMatchData.rivalTeamInfo || ''} onChange={(e) => setCallUpMatchData(p => ({...p, rivalTeamInfo: e.target.value}))} readOnly={!canUserManageCallUp}/></div></div></ScrollArea></TabsContent>
            </div>
          </Tabs>
        </div>
        </ModernDialog>
      )}

      {isSnapshotDialogOpen && selectedMatchForCallUp && (
        <Dialog open={isSnapshotDialogOpen} onOpenChange={setIsSnapshotDialogOpen}><DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col"><DialogHeader><DialogTitle>Imagen de la Convocatoria/Resumen</DialogTitle><RadioGroup defaultValue="convocatoria" value={snapshotDataType} onValueChange={(v) => setSnapshotDataType(v as any)} className="flex items-center pt-2"><div className="flex items-center space-x-2"><RadioGroupItem value="convocatoria" id="r1" /><Label htmlFor="r1">Convocatoria</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="resumen" id="r2" /><Label htmlFor="r2">Resumen del Partido</Label></div></RadioGroup></DialogHeader><ScrollArea className="flex-1 min-h-0"><div className="p-4 space-y-4">{snapshotDataType === 'convocatoria' && (<div className="flex flex-col sm:flex-row justify-between items-center gap-4"><div className="flex justify-center gap-2"><Button variant={snapshotFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapshotFilter('all')}>Todos</Button><Button variant={snapshotFilter === 'convocados' ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapshotFilter('convocados')}>Convocados</Button><Button variant={snapshotFilter === 'no-convocados' ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapshotFilter('no-convocados')}>No Convocados</Button></div><div className="flex items-center gap-2"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={snapshotViewMode === 'list' ? 'secondary' : 'outline'} size="icon" onClick={() => setSnapshotViewMode('list')}><ListIconLucide className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Vista de Lista</p></TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button variant={snapshotViewMode === 'card' ? 'secondary' : 'outline'} size="icon" onClick={() => setSnapshotViewMode('card')}><LayoutGrid className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Vista de Tarjetas</p></TooltipContent></Tooltip></TooltipProvider></div></div>)}<div ref={snapshotRef} className="p-4 bg-white dark:bg-card"><div className="text-center mb-4 text-black"><h3 className="text-lg font-bold">{selectedMatchForCallUp.homeTeamName} vs {selectedMatchForCallUp.awayTeamName}</h3><p className="text-sm text-gray-600">{format(selectedMatchForCallUp.date as Date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}</p>{ (selectedMatchForCallUp.location || selectedMatchForCallUp.convocationTime) && (<div className="text-sm text-blue-600 font-semibold mt-1">{selectedMatchForCallUp.location && <span>{selectedMatchForCallUp.location}</span>}{selectedMatchForCallUp.location && selectedMatchForCallUp.convocationTime && <span> &middot; </span>}{selectedMatchForCallUp.convocationTime && <span>Convocatoria: {selectedMatchForCallUp.convocationTime}h</span>}</div>)}</div>{snapshotDataType === 'convocatoria' ? ( snapshotViewMode === 'list' ? (<ul className="divide-y divide-gray-200">{snapshotPlayers.map(player => (<li key={player.id} className="flex items-center justify-between py-2 px-1"><div className="flex items-center gap-3"><div className='relative h-12 w-10 rounded-md overflow-hidden shrink-0'><Image src={player.avatarUrl || 'https://placehold.co/40x48.png'} alt={player.name} fill className="object-cover" data-ai-hint="player avatar" /></div><span className="font-medium text-sm text-black">{player.nickname || player.name}</span></div><Badge variant={selectedPlayerIds.includes(player.id) ? 'default' : 'secondary'}>{selectedPlayerIds.includes(player.id) ? 'Convocado' : 'No Convocado'}</Badge></li>))}</ul>) : (<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">{snapshotPlayers.map(player => (<div key={player.id} className="flex flex-col items-center gap-1.5 p-1 border border-gray-200 rounded-md shadow-sm"><div className="relative w-full aspect-[3/4] rounded-md overflow-hidden bg-gray-100"><Image src={player.avatarUrl || 'https://placehold.co/150x200.png'} alt={player.name} fill className="object-cover" data-ai-hint="player avatar" />{player.jerseyNumber !== undefined && (<div className={cn("absolute bottom-1 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-lg border border-white/50", selectedPlayerIds.includes(player.id) ? 'bg-green-600/90' : 'bg-red-600/90' )}>{player.jerseyNumber}</div>)}</div><span className="font-semibold text-[10px] text-center truncate w-full mt-1 text-black">{player.nickname || player.name}</span><Badge variant={selectedPlayerIds.includes(player.id) ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0.5">{selectedPlayerIds.includes(player.id) ? 'Convocado' : 'No Convocado'}</Badge></div>))}</div>)) : (<div className="space-y-4 text-sm text-black"><div className="p-4 bg-gray-100 rounded-lg"><h5 className="font-bold text-base mb-2 text-center text-black">Resumen de Estadísticas</h5><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center"><div className="p-2 bg-white rounded-md border"><p className="text-xs font-medium text-gray-500">Marcador</p><p className="text-lg font-bold text-black">{callUpMatchData.homeScore ?? '-'} : {callUpMatchData.awayScore ?? '-'}</p></div><div className="p-2 bg-white rounded-md border"><p className="text-xs font-medium text-gray-500">Goles del Equipo</p><p className="text-lg font-bold text-green-600">{snapshotTeamStats.goals}</p></div><div className="p-2 bg-white rounded-md border"><p className="text-xs font-medium text-gray-500">T. Amarillas</p><p className="text-lg font-bold text-yellow-500">{snapshotTeamStats.yellowCards}</p></div><div className="p-2 bg-white rounded-md border"><p className="text-xs font-medium text-gray-500">T. Rojas</p><p className="text-lg font-bold text-red-500">{snapshotTeamStats.redCards}</p></div></div></div><div className="p-4 bg-gray-100 rounded-lg"><h5 className="font-bold text-base mb-2 text-black">Incidencias del Partido</h5><p className="whitespace-pre-wrap text-gray-700">{callUpMatchData.matchIncidents || 'No se registraron incidencias.'}</p></div><div className="p-4 bg-gray-100 rounded-lg"><h5 className="font-bold text-base mb-2 text-black">Información del Rival</h5><p className="whitespace-pre-wrap text-gray-700">{callUpMatchData.rivalTeamInfo || 'No se registró información del rival.'}</p></div></div>)}</div></div></ScrollArea><DialogFooter><Button variant="outline" onClick={() => setIsSnapshotDialogOpen(false)}>Cerrar</Button><Button onClick={handleDownloadSnapshot}><Download className="mr-2 h-4 w-4" /> Descargar JPG</Button></DialogFooter></DialogContent></Dialog>
      )}

      {matchToDelete && (
        <AlertDialog open={!!matchToDelete} onOpenChange={(isOpen) => !isOpen && setMatchToDelete(null)}>
          <AlertDialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar Partido?</DialogTitle>
              <AlertDialogDescription>
                  Estás a punto de eliminar el partido {matchToDelete.homeTeamName} vs {matchToDelete.awayTeamName} del {format(new Date(matchToDelete.date as Date), "dd/MM/yyyy", { locale: es })}.
                  Esta acción no se puede deshacer y también eliminará su historial de convocatorias de los perfiles de los jugadores.
              </AlertDialogDescription>
            </DialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMatchToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteMatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar Partido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


