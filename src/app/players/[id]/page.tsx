

'use client';

import React, { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { 
    defaultPlayerProfileFields as staticDefaultFields,
} from '@/lib/placeholder-data'; 
import type { Player, PlayerProfileField, PlayerCallUp, Team, TrainingSession, TrainingAttendanceRecord, User, PlayerEvaluation, InjuryRecord, InjuryStatus, Match, Club } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from '@/components/ui/progress';
import { 
    ArrowLeft, Edit3, ShieldCheck, HeartPulse, Shirt, Calendar, Phone, Mail, MapPin, Camera, 
    CheckCircle2, XCircle, MinusCircle, ListChecks, FileText, Clock, Trash2, 
    Calendar as CalendarIconLucide, ScrollText, Fingerprint, Globe2, Star, Zap, 
    ShieldAlert as CardAlertIcon, Award as RatingIcon, UploadCloud, TrendingUp, Goal, HandHelping,
    ClipboardEdit, PlusCircle, Stethoscope, ActivitySquare, BarChart3, Sparkles, X as XIcon, Link as LinkIconLucide, MoreVertical, Save
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid, parseISO, startOfDay, differenceInYears, formatISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as ShadCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, deleteField as firestoreDeleteField, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { PlayerReportDialog } from '@/components/reports/player-report-dialog';
import { ModernDialog } from '@/components/ui/modern-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';


const MAX_AVATAR_URL_LENGTH = 700000; 
const DATE_FORMAT_INPUT = "dd/MM/yyyy";

const MAX_CALLUPS_DISPLAYED = 5; 
const injuryStatuses: InjuryStatus[] = ['Activa', 'En Recuperación', 'Recuperado', 'Secuelas'];

interface PlayerDetailSectionProps {
  title: string;
  icon: React.ElementType;
  fields: PlayerProfileField[];
  playerData: Player;
  allFieldsConfig: PlayerProfileField[];
}

const PlayerDetailSection: React.FC<PlayerDetailSectionProps> = ({ title, icon: Icon, fields, playerData, allFieldsConfig }) => {
  const activeFields = fields.filter(field => {
    const fieldConfig = allFieldsConfig.find(f => f.key === field.key);
    return fieldConfig?.isActive && playerData[field.key] !== undefined && playerData[field.key] !== null && String(playerData[field.key]).trim() !== '';
  });

  if (activeFields.length === 0) {
    return (
        <div className="p-4 text-center text-muted-foreground">
            No hay información {title.toLowerCase()} disponible para mostrar.
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center font-headline text-primary">
        <Icon className="mr-2 h-5 w-5" />
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {activeFields.map(field => {
          const fieldConfig = allFieldsConfig.find(f => f.key === field.key);
          if (!fieldConfig) return null;

          let displayValue = String(playerData[field.key]);
          if (fieldConfig.type === 'date' && playerData[field.key] && typeof playerData[field.key] === 'string') {
             try {
                const parsedDate = parseISO(playerData[field.key] as string);
                if (isValid(parsedDate)) {
                    displayValue = format(parsedDate, "PPP", { locale: es });
                } else {
                    displayValue = String(playerData[field.key]); // fallback to original string if not valid ISO
                }
             } catch (e) { /* keep original string */ }
          } else if (fieldConfig.type === 'select' && fieldConfig.options?.includes(String(playerData[field.key]))) {
             displayValue = String(playerData[field.key]);
          }
          
          return (
            <div key={field.key} className="pb-2 border-b border-dashed">
              <p className="text-sm font-medium text-muted-foreground">{fieldConfig.label}</p>
              <p className="text-md">{displayValue}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getCallUpStatusIcon = (status: PlayerCallUp['status']) => {
  switch (status) {
    case 'Convocado':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'No Convocado':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function PlayerProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile: currentUser, isLoading: authLoading } = useAuth(); 
  const isMobile = useIsMobile();

  const [player, setPlayer] = useState<Player | null | undefined>(undefined); 
  const [allTeams, setAllTeams] = useState<Team[]>([]); 
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [teamsForClubInDialog, setTeamsForClubInDialog] = useState<Team[]>([]);
  const [playerAttendance, setPlayerAttendance] = useState<TrainingAttendanceRecord[]>([]);
  const [profileFieldsConfig, setProfileFieldsConfig] = useState<PlayerProfileField[]>(staticDefaultFields);
  
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [avatarUrlDirectInput, setAvatarUrlDirectInput] = useState('');
  const [isGeneratingDirectAvatar, setIsGeneratingDirectAvatar] = useState(false);


  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [editingPlayerData, setEditingPlayerData] = useState<Record<string, any>>({});
  const [editDateInputValues, setEditDateInputValues] = useState<Record<string, string>>({});
  const [editPlayerAvatarFile, setEditPlayerAvatarFile] = useState<File | null>(null);
  const [editPlayerAvatarPreview, setEditPlayerAvatarPreview] = useState<string | null | undefined>(null);
  const editPlayerAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [showEditPlayerAvatarUrlInput, setShowEditPlayerAvatarUrlInput] = useState(false);
  const [isGeneratingEditAvatar, setIsGeneratingEditAvatar] = useState(false);
  
  const [isDeletePlayerDialogOpen, setIsDeletePlayerDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [currentEvaluationPeriod, setCurrentEvaluationPeriod] = useState<'Inicio Temporada' | 'Mitad Temporada' | 'Final Temporada' | null>(null);
  const [currentEvaluationData, setCurrentEvaluationData] = useState<Partial<Omit<PlayerEvaluation, 'coachId' | 'coachName'>> & { evaluationDateObj?: Date }>({});
  const [currentSeasonForEvaluation, setCurrentSeasonForEvaluation] = useState<string>(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1)); 

  const [isInjuryDialogOpen, setIsInjuryDialogOpen] = useState(false);
  const [editingInjury, setEditingInjury] = useState<Partial<InjuryRecord> & { startDateObj?: Date; estimatedReturnDateObj?: Date; actualReturnDateObj?: Date } | null>(null);
  const [injuryToDelete, setInjuryToDelete] = useState<InjuryRecord | null>(null);
  
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const fetchPlayerAndTeams = async () => {
    if (id) {
      try {
        const configDocRef = doc(db, "appSettings", "playerProfileFields");
        const configDocSnap = await getDoc(configDocRef);
        if (configDocSnap.exists() && configDocSnap.data().fields) {
          setProfileFieldsConfig(configDocSnap.data().fields);
        } else {
          setProfileFieldsConfig(staticDefaultFields);
        }

        const teamsSnapshot = await getDocs(query(collection(db, "teams"), orderBy("name")));
        const loadedTeams = teamsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Team));
        setAllTeams(loadedTeams);

        const matchesSnapshot = await getDocs(query(collection(db, "matches"), orderBy("date", "desc")));
        const loadedMatches = matchesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data(), date: (docSnap.data().date as any).toDate() } as Match));
        setAllMatches(loadedMatches);

        const playerDocRef = doc(db, "players", id);
        const playerDocSnap = await getDoc(playerDocRef);

        if (playerDocSnap.exists()) {
          const playerData = { id: playerDocSnap.id, ...playerDocSnap.data() } as Player;
          
          if (playerData.callUpHistory) {
            playerData.callUpHistory = playerData.callUpHistory.map(callUp => {
              const match = loadedMatches.find(m => m.id === callUp.matchId);
              
              if (!match) {
                return {
                  ...callUp,
                  homeTeamName: callUp.playerTeamName || 'Equipo Local',
                  awayTeamName: callUp.opponentName || 'Equipo Visitante',
                  homeTeamLogoUrl: null,
                  awayTeamLogoUrl: null,
                  competition: callUp.competition,
                  finalScore: callUp.finalScore || 'Pendiente',
                };
              }
              
              let finalScore = callUp.finalScore || 'Pendiente';
              if (match.status === 'Finalizado' && typeof match.homeScore === 'number' && typeof match.awayScore === 'number') {
                  const playerTeamIsHome = match.homeTeamId === playerData.teamId || match.homeTeamName === loadedTeams.find(t=>t.id === playerData.teamId)?.name;
                  finalScore = `${match.homeScore} - ${match.awayScore}`;
                  if (match.homeScore === match.awayScore) finalScore += " (Empate)";
                  else if ((playerTeamIsHome && match.homeScore > match.awayScore) || (!playerTeamIsHome && match.awayScore > match.homeScore)) finalScore += " (Victoria)";
                  else if ((playerTeamIsHome && match.homeScore < match.awayScore) || (!playerTeamIsHome && match.awayScore < match.homeScore)) finalScore += " (Derrota)";
              }

              return {
                ...callUp,
                homeTeamName: match.homeTeamName,
                awayTeamName: match.awayTeamName,
                homeTeamLogoUrl: match.homeTeamLogoUrl,
                awayTeamLogoUrl: match.awayTeamLogoUrl,
                playerTeamName: loadedTeams.find(t => t.id === playerData.teamId)?.name || 'Equipo',
                competition: match.competition || callUp.competition,
                finalScore: finalScore,
              };
            }).sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
          }

          if (playerData.injuryHistory) {
              playerData.injuryHistory.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          }
          setPlayer(playerData);
          setAvatarPreview(playerData.avatarUrl);
          setAvatarUrlDirectInput(playerData.avatarUrl && !playerData.avatarUrl.startsWith('data:') ? playerData.avatarUrl : '');
          setShowAvatarUrlInput(!!playerData.avatarUrl && !playerData.avatarUrl.startsWith('data:'));
          setSelectedAvatarFile(null);

          // Fetch attendance records for this player
          const attendanceQuery = query(collection(db, "trainingAttendance"), where("playerId", "==", id));
          const attendanceSnapshot = await getDocs(attendanceQuery);
          setPlayerAttendance(attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAttendanceRecord)));

        } else {
          setPlayer(null); 
          toast({ title: "Error", description: "Jugador no encontrado.", variant: "destructive" });
        }
      } catch (error) {
        console.error("Error fetching player and teams from Firestore:", error);
        setPlayer(null);
        toast({ title: "Error de Carga", description: "No se pudo cargar el perfil del jugador o los equipos.", variant: "destructive" });
      }
    } else {
      setPlayer(null);
    }
  };


  useEffect(() => {
    fetchPlayerAndTeams();
  }, [id]);
  
  useEffect(() => {
    if (player) {
        setAvatarPreview(player.avatarUrl);
        setAvatarUrlDirectInput(player.avatarUrl && !player.avatarUrl.startsWith('data:') ? player.avatarUrl : '');
        setShowAvatarUrlInput(!!player.avatarUrl && !player.avatarUrl.startsWith('data:'));
    }
  }, [player]);


  const attendanceStats = useMemo(() => {
    if (!player || playerAttendance.length === 0) return { presente: 0, ausente: 0, justificado: 0, tarde: 0, total: 0, percentage: 0 };
    
    let presente = 0;
    let ausente = 0;
    let justificado = 0;
    let tarde = 0;

    playerAttendance.forEach(record => {
      switch (record.status) {
        case 'Presente': presente++; break;
        case 'Ausente': ausente++; break;
        case 'Justificado': justificado++; break;
        case 'Tarde': tarde++; break;
      }
    });

    const total = playerAttendance.length;
    const attendedCount = presente + tarde;
    const percentage = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return { presente, ausente, justificado, tarde, total, percentage };
  }, [player, playerAttendance]);


  const matchStats = useMemo(() => {
    if (!player || !player.callUpHistory || player.callUpHistory.length === 0) return { totalMatchesPlayed: 0, totalMinutesPlayed: 0, averageMinutesPerMatch: 0, totalGoals: 0, totalAssists: 0, totalYellowCards: 0, totalRedCards: 0 };
    let totalMinutesPlayed = 0, totalGoals = 0, totalAssists = 0, matchesWithMinutes = 0, totalYellowCards = 0, totalRedCards = 0;
    player.callUpHistory.forEach(callUp => {
      if (typeof callUp.minutesPlayed === 'number' && callUp.minutesPlayed > 0) { totalMinutesPlayed += callUp.minutesPlayed; matchesWithMinutes++; }
      if (typeof callUp.goals === 'number') totalGoals += callUp.goals;
      if (typeof callUp.assists === 'number') totalAssists += callUp.assists;
      if (typeof callUp.yellowCards === 'number') totalYellowCards += callUp.yellowCards;
      if (callUp.redCard === true) totalRedCards++;
    });
    return { totalMatchesPlayed: matchesWithMinutes, totalMinutesPlayed, averageMinutesPerMatch: matchesWithMinutes > 0 ? totalMinutesPlayed / matchesWithMinutes : 0, totalGoals, totalAssists, totalYellowCards, totalRedCards };
  }, [player]);

  const teamMatchesForReport = useMemo(() => {
    if (!player || !allMatches) return [];
    return allMatches.filter(match => match.homeTeamId === player.teamId || match.awayTeamId === player.teamId);
  }, [player, allMatches]);


  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowAvatarUrlInput(false); 
      setAvatarUrlDirectInput('');
    }
  };
  
  const handleUrlInputForAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setAvatarUrlDirectInput(url);
    setAvatarPreview(url.trim() || player?.avatarUrl || undefined); 
    setSelectedAvatarFile(null); 
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
    }
  };
  
  const toggleAvatarUrlInput = () => {
    setShowAvatarUrlInput(prev => {
      const newShowState = !prev;
      if (newShowState && selectedAvatarFile) {
        setSelectedAvatarFile(null);
        setAvatarPreview(player?.avatarUrl || undefined);
        setAvatarUrlDirectInput(player?.avatarUrl && !player.avatarUrl.startsWith('data:') ? player.avatarUrl : '');
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else if (!newShowState && !selectedAvatarFile && avatarUrlDirectInput.trim() === '') {
        setAvatarPreview(player?.avatarUrl || undefined);
      }
      return newShowState;
    });
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  
  const removeDirectAvatar = () => {
    setAvatarPreview(undefined);
    setSelectedAvatarFile(null);
    setShowAvatarUrlInput(false);
    setAvatarUrlDirectInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveAvatar = async () => {
    if (!player || !id) return;
    let newAvatarUrlToSave: string | undefined = player.avatarUrl;
    let avatarUpdated = false;

    if (selectedAvatarFile && avatarPreview && avatarPreview.startsWith('data:')) { 
      newAvatarUrlToSave = avatarPreview; 
      avatarUpdated = true;
    } else if (showAvatarUrlInput && avatarUrlDirectInput.trim()) { 
      newAvatarUrlToSave = avatarUrlDirectInput.trim();
      avatarUpdated = true;
    } else if (!avatarPreview && !selectedAvatarFile && !showAvatarUrlInput) { 
      newAvatarUrlToSave = undefined; 
      avatarUpdated = true;
    }


    if (avatarUpdated) {
      if (newAvatarUrlToSave && newAvatarUrlToSave.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar es demasiado grande. Se usará el avatar anterior o uno por defecto.", variant: "default", duration: 5000 });
        newAvatarUrlToSave = player.avatarUrl || `https://placehold.co/264x264.png?text=${player.name[0].toUpperCase()}`;
      }

      try {
        const playerDocRef = doc(db, "players", id);
        await updateDoc(playerDocRef, { avatarUrl: newAvatarUrlToSave || firestoreDeleteField(), updatedAt: serverTimestamp() });
        setPlayer(prev => prev ? { ...prev, avatarUrl: newAvatarUrlToSave } : null);
        setSelectedAvatarFile(null);
        toast({ title: "Foto de Perfil Actualizada", description: "La nueva foto de perfil ha sido guardada." });
      } catch (error) {
        console.error("Error updating avatar in Firestore:", error);
        toast({ title: "Error al Guardar Avatar", description: "No se pudo actualizar la foto de perfil.", variant: "destructive" });
      }
    } else {
      toast({ title: "Sin Cambios en Avatar", description: "No se detectaron cambios.", variant: "default" });
    }
  };

  const handleGenerateDirectAvatar = async () => {
    if(!player) return;
    setIsGeneratingDirectAvatar(true);
    toast({ title: "Generando Avatar...", description: "Por favor espera."});
    try {
        const result = await generateAvatar({ promptText: player.name, entityType: 'player'});
        if (result.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
            toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande.", variant: "default" });
            setAvatarPreview(player.avatarUrl || undefined);
        } else {
            setAvatarPreview(result.imageDataUri);
            setSelectedAvatarFile(null);
            setAvatarUrlDirectInput('');
            setShowAvatarUrlInput(false);
            toast({ title: "Avatar Generado", description: "Puedes guardar los cambios ahora."});
        }
    } catch (error) {
        console.error("Error generating avatar:", error);
        toast({ title: "Error de IA", description: "No se pudo generar el avatar.", variant: "destructive" });
    } finally {
        setIsGeneratingDirectAvatar(false);
    }
  };


  const openEditPlayerDialog = () => {
    if (!player) return;

    const nameParts = player.name.split(/ (.*)/s);
    const initialEditData: Record<string, any> = {
      ...player,
      firstName: nameParts[0] || '',
      lastName: nameParts[1] || '',
      avatarFile: null
    };
    delete initialEditData.name;
    
    const initialDateInputs: Record<string, string> = {};

    profileFieldsConfig.forEach(field => {
        if (field.type === 'date' && player[field.key]) {
            try {
                const parsedDate = parseISO(player[field.key] as string);
                if (isValid(parsedDate)) {
                    initialEditData[field.key] = parsedDate; 
                    initialDateInputs[field.key] = format(parsedDate, DATE_FORMAT_INPUT);
                } else {
                     initialDateInputs[field.key] = player[field.key] as string; 
                }
            } catch {
                 initialDateInputs[field.key] = player[field.key] as string;
            }
        }
    });
     if (player.dateOfBirth) { 
        try {
            const dob = parseISO(player.dateOfBirth);
            if (isValid(dob)) {
                initialEditData.dateOfBirth = dob;
                initialDateInputs.dateOfBirth = format(dob, DATE_FORMAT_INPUT);
            } else {
                 initialDateInputs.dateOfBirth = player.dateOfBirth;
            }
        } catch {
             initialDateInputs.dateOfBirth = player.dateOfBirth;
        }
    }


    setEditingPlayerData(initialEditData);
    setEditDateInputValues(initialDateInputs);
    setEditPlayerAvatarPreview(player.avatarUrl);
    setEditPlayerAvatarFile(null);
    setShowEditPlayerAvatarUrlInput(!!player.avatarUrl && !player.avatarUrl.startsWith('data:'));
    
    const playerTeam = allTeams.find(t => t.id === player.teamId);
    const playerClubId = playerTeam?.clubId;
    const teamsForDialog = playerClubId ? allTeams.filter(t => t.clubId === playerClubId) : allTeams;
    setTeamsForClubInDialog(teamsForDialog);

    setIsEditPlayerDialogOpen(true);
  };

  const handleEditPlayerInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const fieldConfig = profileFieldsConfig.find(f => f.key === name);

    if (name === "avatarUrl") {
        setEditingPlayerData(prev => ({ ...prev, avatarUrl: value, avatarFile: null }));
        setEditPlayerAvatarPreview(value || null);
        if (editPlayerAvatarFileInputRef.current) editPlayerAvatarFileInputRef.current.value = "";
    } else if (fieldConfig?.type === 'date') {
        setEditDateInputValues(prev => ({ ...prev, [name]: value }));
    } else {
        setEditingPlayerData(prev => ({ ...prev, [name]: (fieldConfig && fieldConfig.type === 'number' && name !== 'phone' && name !== 'secondaryPhone' && name !== 'jerseyNumber') ? (value ? parseFloat(value) : undefined) : (name === 'jerseyNumber' ? (value ? parseInt(value,10) : undefined) : value) }));
    }
  };
  
  const handleEditDateInputBlur = (fieldName: string, inputValue: string) => {
    if (!inputValue.trim()) {
      setEditingPlayerData(prev => ({ ...prev, [fieldName]: undefined }));
      setEditDateInputValues(prev => ({ ...prev, [fieldName]: '' }));
      return;
    }
    try {
      const parsedDate = parse(inputValue, DATE_FORMAT_INPUT, new Date());
      if (isValid(parsedDate)) {
        setEditingPlayerData(prev => ({ ...prev, [fieldName]: parsedDate })); 
        setEditDateInputValues(prev => ({ ...prev, [fieldName]: format(parsedDate, DATE_FORMAT_INPUT) }));
      } else {
        toast({ title: "Fecha Inválida", description: `Formato ${DATE_FORMAT_INPUT}.`, variant: "destructive" });
      }
    } catch (error) { toast({ title: "Error al Parsear Fecha", variant: "destructive" }); }
  };

  const handleEditPlayerDateChange = (date: Date | undefined, fieldName: 'dateOfBirth' | string) => {
    setEditingPlayerData(prev => ({ ...prev, [fieldName]: date })); 
    setEditDateInputValues(prev => ({ ...prev, [fieldName]: date ? format(date, DATE_FORMAT_INPUT) : '' }));
  };
  
  const handleEditPlayerSelectChange = (name: 'teamId' | 'position' | 'preferredFoot' | string, value: string) => {
    setEditingPlayerData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditingPlayerAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditPlayerAvatarFile(file);
      setEditingPlayerData(prev => ({ ...prev, avatarFile: file, avatarUrl: '' }));
      const reader = new FileReader();
      reader.onloadend = () => setEditPlayerAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
      setShowEditPlayerAvatarUrlInput(false);
    }
  };

  const triggerEditingPlayerAvatarFileInput = () => editPlayerAvatarFileInputRef.current?.click();
  
  const removeEditingPlayerAvatar = () => {
    setEditPlayerAvatarFile(null); 
    setEditPlayerAvatarPreview(null);
    setEditingPlayerData(prev => ({ ...prev, avatarFile: null, avatarUrl: '' }));
    if (editPlayerAvatarFileInputRef.current) editPlayerAvatarFileInputRef.current.value = '';
    setShowEditPlayerAvatarUrlInput(false);
  };

  const toggleEditPlayerAvatarUrlInput = () => {
    setShowEditPlayerAvatarUrlInput(prev => {
        const newShowState = !prev;
        if (newShowState && editingPlayerData.avatarFile) { 
            setEditPlayerAvatarPreview(player?.avatarUrl || null);
            setEditingPlayerData(prevData => ({...prevData, avatarFile: null, avatarUrl: player?.avatarUrl || ''}));
            if (editPlayerAvatarFileInputRef.current) editPlayerAvatarFileInputRef.current.value = "";
        }
        return newShowState;
    });
  };

  const handleGenerateEditAvatar = async () => {
    const fullName = `${editingPlayerData.firstName || ''} ${editingPlayerData.lastName || ''}`.trim();
    if(!player || !fullName) return;
    setIsGeneratingEditAvatar(true);
    toast({ title: "Generando Avatar...", description: "Por favor espera."});
    try {
        const result = await generateAvatar({ promptText: fullName, entityType: 'player'});
        if (result.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
            toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande.", variant: "default" });
            setEditPlayerAvatarPreview(player.avatarUrl);
        } else {
            setEditPlayerAvatarPreview(result.imageDataUri);
            setEditPlayerAvatarFile(null);
            setEditingPlayerData(prev => ({...prev, avatarUrl: result.imageDataUri, avatarFile: null}));
            setShowEditPlayerAvatarUrlInput(false);
            toast({ title: "Avatar Generado"});
        }
    } catch (error) {
        console.error("Error generating avatar:", error);
        toast({ title: "Error de IA", description: "No se pudo generar el avatar.", variant: "destructive" });
    } finally {
        setIsGeneratingEditAvatar(false);
    }
  };
  
  const handleSavePlayerChanges = async () => {
    const fullName = `${editingPlayerData.firstName || ''} ${editingPlayerData.lastName || ''}`.trim();
    if (!player || !id || !fullName || !editingPlayerData.teamId || !editingPlayerData.position || !editingPlayerData.dateOfBirth) {
      toast({ title: "Campos Incompletos", description: "Nombre, apellidos, equipo, posición y F. Nacimiento son obligatorios.", variant: "destructive" });
      return;
    }
    let finalAvatarUrl = editingPlayerData.avatarUrl || player.avatarUrl;
    if (editPlayerAvatarFile && editPlayerAvatarPreview) finalAvatarUrl = editPlayerAvatarPreview;
    else if (showEditPlayerAvatarUrlInput && editingPlayerData.avatarUrl?.trim()) finalAvatarUrl = editingPlayerData.avatarUrl.trim();
    else if (editPlayerAvatarPreview === null && !editPlayerAvatarFile && !showEditPlayerAvatarUrlInput) finalAvatarUrl = undefined;


    if (finalAvatarUrl && finalAvatarUrl.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar es demasiado grande para guardarlo. Se usará el avatar anterior o uno por defecto.", variant: "default", duration: 5000 });
        finalAvatarUrl = player.avatarUrl || `https://placehold.co/264x264.png?text=${fullName[0].toUpperCase()}`;
    }

    const selectedTeam = allTeams.find(t => t.id === editingPlayerData.teamId!);
    const playerUpdates: Record<string, any> = {
      name: fullName,
      nickname: (editingPlayerData.nickname && editingPlayerData.nickname.trim() !== '') ? editingPlayerData.nickname.trim() : firestoreDeleteField(),
      teamId: editingPlayerData.teamId!,
      clubId: (selectedTeam && typeof selectedTeam.clubId === 'string') ? selectedTeam.clubId : firestoreDeleteField(),
      position: editingPlayerData.position!,
      dateOfBirth: formatISO(editingPlayerData.dateOfBirth as Date, { representation: 'date' }),
      updatedAt: serverTimestamp(),
    };
    if (editingPlayerData.jerseyNumber !== undefined && editingPlayerData.jerseyNumber !== null && editingPlayerData.jerseyNumber !== '') {
        playerUpdates.jerseyNumber = parseInt(String(editingPlayerData.jerseyNumber), 10);
    } else {
        playerUpdates.jerseyNumber = firestoreDeleteField();
    }
    if (finalAvatarUrl !== undefined) {
        playerUpdates.avatarUrl = finalAvatarUrl;
    } else {
        playerUpdates.avatarUrl = firestoreDeleteField();
    }
    

    profileFieldsConfig.forEach(field => {
      if (field.isActive && !field.isDefault) { 
        const value = editingPlayerData[field.key];
        if (field.type === 'date') {
          if (value instanceof Date && isValid(value)) {
            playerUpdates[field.key] = formatISO(value, { representation: 'date' });
          } else if (typeof value === 'string' && value.trim() === '') { 
             playerUpdates[field.key] = firestoreDeleteField();
          } else if (value === undefined || value === null) {
             playerUpdates[field.key] = firestoreDeleteField();
          }
        } else if (field.type === 'number') {
          const numValue = parseFloat(String(value));
          playerUpdates[field.key] = (value !== undefined && value !== null && String(value).trim() !== '' && !isNaN(numValue)) ? numValue : firestoreDeleteField();
        } else { 
          playerUpdates[field.key] = (value !== undefined && value !== null && String(value).trim() !== '') ? String(value).trim() : firestoreDeleteField();
        }
      }
    });
    
    try {
      const playerDocRef = doc(db, "players", id);
      await updateDoc(playerDocRef, playerUpdates);
      await fetchPlayerAndTeams(); 
      toast({ title: "Jugador Actualizado", description: `Datos de ${playerUpdates.name} actualizados.` });
      setIsEditPlayerDialogOpen(false);
    } catch (error) {
      console.error("Error updating player in Firestore:", error);
      toast({ title: "Error al Guardar", description: "No se pudo actualizar el jugador. " + (error as Error).message, variant: "destructive" });
    }
  };

  const confirmDeletePlayer = async () => {
    if (player && id) {
      try {
        await deleteDoc(doc(db, "players", id));
        toast({ title: "Jugador Eliminado", description: `${player.name} ha sido eliminado.` });
        setIsDeletePlayerDialogOpen(false);
        router.push('/players');
      } catch (error) {
        console.error("Error deleting player from Firestore:", error);
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar el jugador.", variant: "destructive" });
      }
    }
  };

  const openEvaluationDialog = (period: 'Inicio Temporada' | 'Mitad Temporada' | 'Final Temporada') => {
    if (!player || !currentUser) return;
    setCurrentEvaluationPeriod(period);
    const existingEval = player.playerEvaluations?.find(ev => ev.season === currentSeasonForEvaluation && ev.period === period);
    setCurrentEvaluationData(existingEval ? { ...existingEval, evaluationDateObj: existingEval.evaluationDate ? parseISO(existingEval.evaluationDate) : new Date() } : { season: currentSeasonForEvaluation, period, notes: '', evaluationDateObj: new Date() });
    setIsEvaluationDialogOpen(true);
  };
  
  const handleEvaluationInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentEvaluationData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleEvaluationDateChange = (date: Date | undefined) => setCurrentEvaluationData(prev => ({...prev, evaluationDateObj: date}));

  const handleSaveEvaluation = async () => {
    if (!player || !id || !currentEvaluationPeriod || !currentSeasonForEvaluation || !currentUser) return;
    if (!currentEvaluationData.notes?.trim() || !currentEvaluationData.evaluationDateObj || !isValid(currentEvaluationData.evaluationDateObj)) {
      toast({ title: "Datos Incompletos", description: "Notas y fecha de evaluación son obligatorias.", variant: "destructive" }); return;
    }
    const newEvaluationEntry: PlayerEvaluation = {
      id: currentEvaluationData.id || `eval-${Date.now()}`,
      season: currentSeasonForEvaluation,
      period: currentEvaluationPeriod,
      notes: currentEvaluationData.notes,
      evaluationDate: formatISO(currentEvaluationData.evaluationDateObj, { representation: 'date' }),
      coachId: currentUser.id,
      coachName: currentUser.name,
    };
    let updatedEvaluations = [...(player.playerEvaluations || [])];
    const existingEvalIndex = updatedEvaluations.findIndex(ev => ev.id === newEvaluationEntry.id || (ev.season === newEvaluationEntry.season && ev.period === newEvaluationEntry.period));
    if (existingEvalIndex > -1) updatedEvaluations[existingEvalIndex] = newEvaluationEntry;
    else updatedEvaluations.push(newEvaluationEntry);
    
    try {
      await updateDoc(doc(db, "players", id), { playerEvaluations: updatedEvaluations, updatedAt: serverTimestamp() });
      await fetchPlayerAndTeams();
      toast({ title: "Evaluación Guardada", description: `Evaluación para ${currentEvaluationPeriod} de ${currentSeasonForEvaluation} guardada.` });
      setIsEvaluationDialogOpen(false);
    } catch (error) { toast({ title: "Error al Guardar Evaluación", variant: "destructive" }); }
  };

  const openInjuryDialog = (injury?: InjuryRecord) => {
    setEditingInjury(injury ? { ...injury, startDateObj: injury.startDate ? parseISO(injury.startDate) : undefined, estimatedReturnDateObj: injury.estimatedReturnDate ? parseISO(injury.estimatedReturnDate) : undefined, actualReturnDateObj: injury.actualReturnDate ? parseISO(injury.actualReturnDate) : undefined } : { injuryType: '', description: '', startDateObj: new Date(), status: 'Activa', notes: '' });
    setIsInjuryDialogOpen(true);
  };
  const handleInjuryInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditingInjury(prev => prev ? ({ ...prev, [e.target.name]: e.target.value }) : null);
  const handleInjuryDateChange = (date: Date | undefined, fieldName: 'startDateObj' | 'estimatedReturnDateObj' | 'actualReturnDateObj') => setEditingInjury(prev => prev ? ({ ...prev, [fieldName]: date }) : null);
  const handleInjuryStatusChange = (status: InjuryStatus) => setEditingInjury(prev => prev ? ({ ...prev, status }) : null);

  const handleSaveInjury = async () => {
    if (!player || !id || !editingInjury || !editingInjury.injuryType?.trim() || !editingInjury.startDateObj || !editingInjury.status) {
      toast({ title: "Campos Incompletos", description: "Tipo, fecha inicio y estado de lesión son obligatorios.", variant: "destructive" }); return;
    }
    const injuryEntry: InjuryRecord = {
      id: editingInjury.id || `inj-${Date.now()}`,
      playerId: id, 
      injuryType: editingInjury.injuryType,
      description: editingInjury.description || undefined,
      startDate: formatISO(editingInjury.startDateObj, { representation: 'date' }),
      estimatedReturnDate: editingInjury.estimatedReturnDateObj ? formatISO(editingInjury.estimatedReturnDateObj, { representation: 'date' }) : undefined,
      actualReturnDate: editingInjury.actualReturnDateObj ? formatISO(editingInjury.actualReturnDateObj, { representation: 'date' }) : undefined,
      status: editingInjury.status,
      notes: editingInjury.notes || undefined,
    };
    let updatedInjuries = [...(player.injuryHistory || [])];
    const existingInjuryIndex = updatedInjuries.findIndex(inj => inj.id === injuryEntry.id);
    if (existingInjuryIndex > -1) updatedInjuries[existingInjuryIndex] = injuryEntry;
    else updatedInjuries.push(injuryEntry);
    updatedInjuries.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    try {
      await updateDoc(doc(db, "players", id), { injuryHistory: updatedInjuries, updatedAt: serverTimestamp() });
      await fetchPlayerAndTeams();
      toast({ title: "Registro de Lesión Guardado" });
      setIsInjuryDialogOpen(false); setEditingInjury(null);
    } catch (error) { toast({ title: "Error al Guardar Lesión", variant: "destructive" }); }
  };

  const handleDeleteInjuryRequest = (injury: InjuryRecord) => {
      setInjuryToDelete(injury);
  };
  
  const confirmDeleteInjury = async () => {
    if (player && id && injuryToDelete) {
      try {
        const updatedInjuries = player.injuryHistory?.filter(inj => inj.id !== injuryToDelete.id) || [];
        await updateDoc(doc(db, "players", id), { injuryHistory: updatedInjuries, updatedAt: serverTimestamp() });
        await fetchPlayerAndTeams();
        toast({ title: "Lesión Eliminada" });
        setInjuryToDelete(null);
      } catch (error) { toast({ title: "Error al Eliminar Lesión", variant: "destructive" }); }
    }
  };

  
  if (authLoading || player === undefined || allTeams.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (player === null) return <div className="p-4 text-center text-destructive">Jugador no encontrado. <Link href="/players" className="underline">Volver a la lista</Link></div>;

  const fieldsBySection = profileFieldsConfig.reduce((acc, field) => { 
    if (field.isActive) { 
        (acc[field.section] = acc[field.section] || []).push(field); 
    }
    return acc; 
  }, {} as Record<PlayerProfileField['section'], PlayerProfileField[]>);

  const dynamicEditFieldsBySection = profileFieldsConfig.reduce((acc, field) => {
    if (field.isActive && !field.isDefault) { 
        (acc[field.section] = acc[field.section] || []).push(field);
    }
    return acc;
  }, {} as Record<string, PlayerProfileField[]>);


  const displayedCallUps = player.callUpHistory?.slice(0, MAX_CALLUPS_DISPLAYED) || [];
  const getAge = (dateString: string | undefined) => { if (!dateString) return 'N/A'; try { const birthDate = parseISO(dateString); if (!isValid(birthDate)) return 'N/A'; return differenceInYears(new Date(), birthDate); } catch (e) { return 'N/A'; } };
  const last3Injuries = player.injuryHistory?.slice(0, 3) || [];
  const last3EvaluationsByPeriod: Record<string, PlayerEvaluation | undefined> = {};
  if (player.playerEvaluations && player.playerEvaluations.length > 0) {
      const sortedEvals = [...player.playerEvaluations].sort((a, b) => { if (a.season !== b.season) return b.season.localeCompare(a.season); const periodOrder = { 'Final Temporada': 3, 'Mitad Temporada': 2, 'Inicio Temporada': 1 }; return (periodOrder[b.period] || 0) - (periodOrder[a.period] || 0); });
      const uniqueSeasons = [...new Set(sortedEvals.map(e => e.season))].slice(0,1); 
      uniqueSeasons.forEach(season => { (['Inicio Temporada', 'Mitad Temporada', 'Final Temporada'] as const).forEach(period => { if (!last3EvaluationsByPeriod[season+period]) { const evalForPeriod = sortedEvals.find(e => e.season === season && e.period === period); if (evalForPeriod) last3EvaluationsByPeriod[season+period] = evalForPeriod; } }); });
  }

  const team = allTeams.find(t => t.id === player.teamId);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
                <Link href="/players">
                <Button variant="outline" size="icon" aria-label="Volver a Jugadores"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <h1 className="text-xl sm:text-2xl font-headline truncate max-w-xs sm:max-w-md">Perfil de {player.name}</h1>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
                <Button variant="default" onClick={() => setIsReportDialogOpen(true)}><BarChart3 className="mr-2 h-4 w-4"/>Informe</Button>
                <Button variant="outline" onClick={openEditPlayerDialog}><Edit3 className="mr-2 h-4 w-4" />Editar</Button>
                <Button variant="destructive" onClick={() => setIsDeletePlayerDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
            </div>
            
            <div className="md:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setIsReportDialogOpen(true)}><BarChart3 className="mr-2 h-4 w-4"/>Informe</DropdownMenuItem>
                        <DropdownMenuItem onSelect={openEditPlayerDialog}><Edit3 className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setIsDeletePlayerDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
      </div>

      <Card className="shadow-xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary via-blue-500 to-secondary h-36 sm:h-48 overflow-hidden">
            {team && team.logoUrl && (
                <Image
                    src={team.logoUrl}
                    alt={`${team.name || 'Equipo'} logo de fondo`}
                    fill 
                    style={{objectFit: 'contain'}} 
                    className="opacity-10 blur-sm p-4"
                    data-ai-hint="team logo background"
                />
            )}
            {team && !team.logoUrl && team.name && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <span className="text-4xl sm:text-6xl font-bold text-white/5 select-none truncate opacity-50">
                        {team.name}
                    </span>
                </div>
            )}

            <div className="absolute top-0 right-0 h-full flex items-center p-4 md:p-6 z-10">
                {team && team.logoUrl ? (
                    <div className="bg-card/70 p-2 rounded-lg shadow-lg backdrop-blur-sm">
                        <Image
                            src={team.logoUrl}
                            alt={`Logo del equipo ${team.name || 'asignado'}`}
                            width={72} 
                            height={72}
                            className="object-contain rounded" 
                            data-ai-hint="team logo clear"
                        />
                    </div>
                ) : team && team.name ? (
                    <div className="bg-black/40 text-primary-foreground p-3 rounded-lg shadow-lg backdrop-blur-sm">
                        <p className="font-semibold text-base md:text-lg text-center truncate max-w-[100px] md:max-w-[150px]">{team.name}</p>
                    </div>
                ) : null}
            </div>
        </div>
        <CardContent className="relative px-4 sm:px-6 pb-6">
          <div className="flex flex-col items-center text-center -mt-[108px] sm:-mt-[132px] mb-4 sm:mb-6">
            <ModernDialog isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} title={player.name} showCloseButton={true} size="lg" type="info" icon={Camera}>
                <Image src={avatarPreview || `https://placehold.co/400x400.png`} alt={`${player.name} (avatar ampliado)`} width={1200} height={900} className="object-contain w-full h-auto max-h-[80vh]" data-ai-hint="player avatar large"/>
            </ModernDialog>
             <button onClick={() => setIsAvatarModalOpen(true)} aria-label="Ampliar avatar">
                <Avatar className="h-[216px] w-[216px] sm:h-[264px] sm:w-[264px] border-2 border-background shadow-lg cursor-pointer hover:opacity-90 transition-opacity">
                  <AvatarImage src={avatarPreview || `https://placehold.co/264x264.png`} alt={player.name} data-ai-hint="player avatar" />
                  <AvatarFallback className="text-7xl sm:text-8xl">{player.name.substring(0, 1)}</AvatarFallback>
                </Avatar>
             </button>
            <div className="mt-4">
              <CardTitle className="text-2xl sm:text-3xl font-headline">{player.name}</CardTitle>
              <CardDescription className="text-md sm:text-lg text-primary/90">{player.position} {player.jerseyNumber ? `- #${player.jerseyNumber}` : ''}</CardDescription>
              <p className="text-sm text-muted-foreground">Equipo: {team?.name || 'Sin equipo'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {profileFieldsConfig.find(f => f.key === 'dateOfBirth' && f.isActive) && player.dateOfBirth && isValid(parseISO(player.dateOfBirth)) && (<div className="flex items-center space-x-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(parseISO(player.dateOfBirth), "dd 'de' MMMM 'de' yyyy", { locale: es })} ({getAge(player.dateOfBirth)} años)</span></div>)}
            {profileFieldsConfig.find(f => f.key === 'phone' && f.isActive) && player.phone && (<div className="flex items-center space-x-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{player.phone}</span></div>)}
            {profileFieldsConfig.find(f => f.key === 'email' && f.isActive) && player.email && (<div className="flex items-center space-x-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{player.email}</span></div>)}
            {profileFieldsConfig.find(f => f.key === 'address' && f.isActive) && player.address && (<div className="flex items-center space-x-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{player.address}</span></div>)}
            {profileFieldsConfig.find(f => f.key === 'nationality' && f.isActive) && player.nationality && (<div className="flex items-center space-x-2"><Globe2 className="h-4 w-4 text-muted-foreground" /><span>{player.nationality}</span></div>)}
            {profileFieldsConfig.find(f => f.key === 'passportNumber' && f.isActive) && player.passportNumber && (<div className="flex items-center space-x-2"><Fingerprint className="h-4 w-4 text-muted-foreground" /><span>Pasaporte / DNI: {player.passportNumber}</span></div>)}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rendimiento" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:flex xl:flex-wrap h-auto justify-start sm:justify-center bg-muted p-1 rounded-md gap-1">
          <TabsTrigger value="rendimiento" className="font-headline flex-grow sm:flex-grow-0"><TrendingUp className="mr-2 h-4 w-4 inline-block" />Rendimiento</TabsTrigger>
          <TabsTrigger value="personal" className="font-headline flex-grow sm:flex-grow-0"><ShieldCheck className="mr-2 h-4 w-4 inline-block" />Personal</TabsTrigger>
          <TabsTrigger value="deportivo" className="font-headline flex-grow sm:flex-grow-0"><Shirt className="mr-2 h-4 w-4 inline-block" />Deportivo</TabsTrigger>
          <TabsTrigger value="medico" className="font-headline flex-grow sm:flex-grow-0"><HeartPulse className="mr-2 h-4 w-4 inline-block" />Médico</TabsTrigger>
          <TabsTrigger value="lesiones" className="font-headline flex-grow sm:flex-grow-0"><ActivitySquare className="mr-2 h-4 w-4 inline-block" />Lesiones</TabsTrigger>
          <TabsTrigger value="evaluaciones" className="font-headline flex-grow sm:flex-grow-0"><ClipboardEdit className="mr-2 h-4 w-4 inline-block" />Evaluaciones</TabsTrigger>
          <TabsTrigger value="convocatorias" className="font-headline flex-grow sm:flex-grow-0"><ListChecks className="mr-2 h-4 w-4 inline-block" />Convocatorias</TabsTrigger>
        </TabsList>
        <TabsContent value="personal"><Card className="shadow-lg"><CardContent className="p-6"><PlayerDetailSection title="Información Personal" icon={ShieldCheck} fields={fieldsBySection['Personal'] || []} playerData={player} allFieldsConfig={profileFieldsConfig} /></CardContent></Card></TabsContent>
        <TabsContent value="deportivo"><Card className="shadow-lg"><CardContent className="p-6"><PlayerDetailSection title="Información Deportiva" icon={Shirt} fields={fieldsBySection['Deportivo'] || []} playerData={player} allFieldsConfig={profileFieldsConfig} /></CardContent></Card></TabsContent>
        <TabsContent value="medico"><Card className="shadow-lg"><CardContent className="p-6"><PlayerDetailSection title="Información Médica" icon={HeartPulse} fields={fieldsBySection['Médico'] || []} playerData={player} allFieldsConfig={profileFieldsConfig} /></CardContent></Card></TabsContent>
        <TabsContent value="lesiones"><Card className="shadow-lg"><CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"><CardTitle className="font-headline text-xl flex items-center"><ActivitySquare className="mr-2 h-5 w-5 text-primary" />Historial de Lesiones</CardTitle><Button onClick={() => openInjuryDialog()} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Lesión</Button></div><CardDescription>Registro y seguimiento de las lesiones del jugador.</CardDescription></CardHeader><CardContent>{!player.injuryHistory || player.injuryHistory.length === 0 ? (<p className="text-muted-foreground text-center py-4">No hay historial de lesiones para este jugador.</p>) : (<div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Tipo de Lesión</TableHead><TableHead className="hidden md:table-cell">Fecha Inicio</TableHead><TableHead>Estado</TableHead><TableHead className="hidden sm:table-cell">Retorno Estimado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{player.injuryHistory.map(injury => (<TableRow key={injury.id}><TableCell className="font-medium">{injury.injuryType}</TableCell><TableCell className="hidden md:table-cell text-sm">{format(parseISO(injury.startDate), "dd MMM yyyy", { locale: es })}</TableCell><TableCell><Badge variant={injury.status === 'Activa' ? 'destructive' : injury.status === 'En Recuperación' ? 'secondary' : 'default'}>{injury.status}</Badge></TableCell><TableCell className="hidden sm:table-cell text-sm">{injury.estimatedReturnDate ? format(parseISO(injury.estimatedReturnDate), "dd MMM yyyy", { locale: es }) : '-'}</TableCell><TableCell className="text-right"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => openInjuryDialog(injury)}><Edit3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar Lesión</p></TooltipContent></Tooltip></TooltipProvider><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteInjuryRequest(injury)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Eliminar Lesión</p></TooltipContent></Tooltip></TooltipProvider></TableCell></TableRow>))}</TableBody></Table></div>)}</CardContent></Card></TabsContent>
        <TabsContent value="evaluaciones"><Card className="shadow-lg"><CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"><CardTitle className="font-headline text-xl flex items-center"><ClipboardEdit className="mr-2 h-5 w-5 text-primary" />Evaluaciones del Jugador</CardTitle><div className="flex items-center gap-2 w-full sm:w-auto"><Label htmlFor="season-evaluation" className="text-sm font-medium whitespace-nowrap">Temporada:</Label><Input id="season-evaluation" value={currentSeasonForEvaluation} onChange={(e) => setCurrentSeasonForEvaluation(e.target.value)} placeholder="Ej: 2024/2025" className="w-full sm:w-32 h-9"/></div></div><CardDescription>Registro de la evolución del jugador a lo largo de la temporada.</CardDescription></CardHeader><CardContent className="space-y-6">{(['Inicio Temporada', 'Mitad Temporada', 'Final Temporada'] as const).map((period) => { const evaluation = player.playerEvaluations?.find(ev => ev.season === currentSeasonForEvaluation && ev.period === period); return (<Card key={period} className="shadow-sm"><CardHeader className="flex flex-row justify-between items-center"><CardTitle className="text-lg font-semibold">{period}</CardTitle><Button variant="outline" size="sm" onClick={() => openEvaluationDialog(period)}><Edit3 className="mr-2 h-4 w-4" /> {evaluation ? 'Editar' : 'Añadir'} Evaluación</Button></CardHeader><CardContent>{evaluation ? (<div className="space-y-2"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{evaluation.notes}</p><p className="text-xs text-muted-foreground">Evaluado por: {evaluation.coachName || 'Entrenador desconocido'} el {format(parseISO(evaluation.evaluationDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p></div>) : (<p className="text-sm text-muted-foreground">No hay evaluación para este periodo en la temporada {currentSeasonForEvaluation}.</p>)}</CardContent></Card>);})}</CardContent></Card></TabsContent>
        <TabsContent value="convocatorias">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center">
                <ListChecks className="mr-2 h-5 w-5 text-primary" />Historial de Convocatorias
              </CardTitle>
              <CardDescription>Registro de las convocatorias y estadísticas del jugador en los partidos.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {(!player.callUpHistory || player.callUpHistory.length === 0) ? (
                <p className="text-muted-foreground text-center">No hay historial de convocatorias disponible.</p>
              ) : (
                <>
                  <ul className="space-y-4">
                    {displayedCallUps.map((callUp: any, index) => (
                      <li key={`${callUp.matchId}-${index}`} className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-1">
                            {getCallUpStatusIcon(callUp.status)}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 font-semibold">
                                <Avatar className="h-6 w-6 border">
                                    <AvatarImage src={callUp.homeTeamLogoUrl || `https://placehold.co/24x24.png`} alt={callUp.homeTeamName} data-ai-hint="team logo"/>
                                    <AvatarFallback>{callUp.homeTeamName?.[0] || 'L'}</AvatarFallback>
                                </Avatar>
                                <Link href={`/calendar?date=${format(new Date(callUp.matchDate), 'yyyy-MM-dd')}`} className="hover:underline">
                                    {callUp.homeTeamName} vs {callUp.awayTeamName}
                                </Link>
                                <Avatar className="h-6 w-6 border">
                                    <AvatarImage src={callUp.awayTeamLogoUrl || `https://placehold.co/24x24.png`} alt={callUp.awayTeamName} data-ai-hint="team logo"/>
                                    <AvatarFallback>{callUp.awayTeamName?.[0] || 'V'}</AvatarFallback>
                                </Avatar>
                                {callUp.competition && <span className="text-xs text-muted-foreground font-normal">({callUp.competition})</span>}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(callUp.matchDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
                              {callUp.finalScore && callUp.finalScore !== 'Pendiente' && (
                                  <p className={cn("text-sm font-medium", callUp.finalScore.includes('Victoria') && "text-green-600", callUp.finalScore.includes('Derrota') && "text-red-600", callUp.finalScore.includes('Empate') && "text-yellow-600")}>
                                      Resultado: {callUp.finalScore}
                                  </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={callUp.status === 'Convocado' ? 'default' : callUp.status === 'No Convocado' ? 'destructive' : 'secondary'} className="text-xs ml-auto sm:ml-0 self-start sm:self-center mt-1 sm:mt-0">
                            {callUp.status}
                          </Badge>
                        </div>
                        {(callUp.status !== 'No Convocado' && (typeof callUp.minutesPlayed === 'number' || typeof callUp.goals === 'number' || typeof callUp.assists === 'number' || typeof callUp.yellowCards === 'number' || callUp.redCard || typeof callUp.rating === 'number')) && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Estadísticas del Partido:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                              {typeof callUp.minutesPlayed === 'number' && (<span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> {callUp.minutesPlayed} min</span>)}
                              {typeof callUp.goals === 'number' && callUp.goals > 0 && (<span className="flex items-center text-green-600"><Star className="h-3.5 w-3.5 mr-1.5 fill-current" /> {callUp.goals} Gol(es)</span>)}
                              {typeof callUp.assists === 'number' && callUp.assists > 0 &&(<span className="flex items-center text-blue-600"><Zap className="h-3.5 w-3.5 mr-1.5" /> {callUp.assists} Asist.</span>)}
                              {typeof callUp.rating === 'number' && (<span className="flex items-center text-amber-600"><RatingIcon className="h-3.5 w-3.5 mr-1.5" /> Val: {callUp.rating}/10</span>)}
                              {typeof callUp.yellowCards === 'number' && callUp.yellowCards > 0 && (<span className="flex items-center text-yellow-500"><CardAlertIcon className="h-3.5 w-3.5 mr-1.5 fill-yellow-400 stroke-yellow-600" /> {callUp.yellowCards} Amarilla(s)</span>)}
                              {callUp.redCard === true && (<span className="flex items-center text-red-500"><CardAlertIcon className="h-3.5 w-3.5 mr-1.5 fill-red-500 stroke-red-700" /> Roja</span>)}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {player.callUpHistory && player.callUpHistory.length > MAX_CALLUPS_DISPLAYED && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Mostrando las {MAX_CALLUPS_DISPLAYED} convocatorias más recientes.
                      <Link href={`/calendar?playerId=${player.id}`} className="text-primary hover:underline ml-1">Ver todas</Link>
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rendimiento">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="shadow-lg lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl flex items-center">
                            <BarChart3 className="mr-2 h-5 w-5 text-primary" />
                            Estadísticas de Rendimiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">Partidos Jugados</p>
                            <p className="text-3xl font-bold font-headline">{matchStats.totalMatchesPlayed}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">Minutos Totales</p>
                            <p className="text-3xl font-bold font-headline">{matchStats.totalMinutesPlayed}</p>
                        </div>
                         <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">Goles Marcados</p>
                            <p className="text-3xl font-bold font-headline text-green-600">{matchStats.totalGoals}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <p className="text-xs text-muted-foreground">Asistencias</p>
                            <p className="text-3xl font-bold font-headline text-blue-600">{matchStats.totalAssists}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
      <PlayerReportDialog
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
        player={player}
        teamMatches={teamMatchesForReport}
        matchStats={matchStats}
        attendanceStats={attendanceStats}
      />
        <ModernDialog 
            isOpen={isEditPlayerDialogOpen}
            onClose={() => {
                setIsEditPlayerDialogOpen(false);
                setEditPlayerAvatarFile(null); 
                setEditPlayerAvatarPreview(null); 
                setEditDateInputValues({});
                setShowEditPlayerAvatarUrlInput(false);
            }} 
            title={`Editar Datos de ${player.name}`}
            icon={Edit3}
            type="info"
            size="xl"
            headerActions={
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleSavePlayerChanges}
                                disabled={isGeneratingEditAvatar}
                                className="text-white hover:text-white/80 hover:bg-white/10"
                            >
                                {isGeneratingEditAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Guardar Cambios</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            }
        >
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="fotografia">Fotografía</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="deportivo">Deportivo</TabsTrigger>
              <TabsTrigger value="medico">Médico</TabsTrigger>
            </TabsList>
            <div className="min-h-[450px]">
              <TabsContent value="basic" className="pt-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                      <Label htmlFor="edit-teamId">Equipo*</Label>
                      <Select name="teamId" value={editingPlayerData.teamId || ''} onValueChange={(value) => handleEditPlayerSelectChange('teamId', value)}>
                          <SelectTrigger id="edit-teamId"><SelectValue placeholder="Selecciona equipo" /></SelectTrigger>
                          <SelectContent>{teamsForClubInDialog.map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}</SelectContent>
                      </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><Label htmlFor="edit-firstName">Nombre*</Label><Input id="edit-firstName" name="firstName" value={editingPlayerData.firstName || ''} onChange={handleEditPlayerInputChange} /></div>
                      <div className="space-y-1"><Label htmlFor="edit-lastName">Apellidos*</Label><Input id="edit-lastName" name="lastName" value={editingPlayerData.lastName || ''} onChange={handleEditPlayerInputChange} /></div>
                      <div className="space-y-1 md:col-span-2"><Label htmlFor="edit-nickname">Apodo (para pizarra)</Label><Input id="edit-nickname" name="nickname" value={editingPlayerData.nickname || ''} onChange={handleEditPlayerInputChange} /></div>
                      <div className="space-y-1"><Label htmlFor="edit-dateOfBirth">F. Nacimiento*</Label><Input id="edit-dateOfBirth" name="dateOfBirth" type="text" value={editDateInputValues['dateOfBirth'] || ''} onChange={(e) => setEditDateInputValues(prev => ({...prev, dateOfBirth: e.target.value}))} onBlur={() => handleEditDateInputBlur('dateOfBirth', editDateInputValues['dateOfBirth'])} placeholder={DATE_FORMAT_INPUT}/></div>
                      <div className="space-y-1"><Label htmlFor="edit-jerseyNumber">Dorsal</Label><Input id="edit-jerseyNumber" name="jerseyNumber" type="number" value={editingPlayerData.jerseyNumber === undefined ? '' : editingPlayerData.jerseyNumber} onChange={handleEditPlayerInputChange} /></div>
                      <div className="space-y-1 md:col-span-2"><Label htmlFor="edit-position">Posición*</Label><Select name="position" value={editingPlayerData.position || ''} onValueChange={(value) => handleEditPlayerSelectChange('position', value)}><SelectTrigger id="edit-position"><SelectValue placeholder="Selecciona posición" /></SelectTrigger><SelectContent><SelectItem value="Portero">Portero</SelectItem><SelectItem value="Defensa">Defensa</SelectItem><SelectItem value="Centrocampista">Centrocampista</SelectItem><SelectItem value="Delantero">Delantero</SelectItem></SelectContent></Select></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fotografia" className="pt-4 flex flex-col items-center justify-center gap-4 h-full">
                <div className="relative w-64 h-80 border rounded-lg bg-muted/30 overflow-hidden shadow-inner">
                    <Image src={editPlayerAvatarPreview || `https://placehold.co/256x320.png`} alt="Avatar Preview" layout="fill" objectFit="cover" className="rounded-md" data-ai-hint="player avatar"/>
                </div>
                <div className="flex gap-2 w-full max-w-xs">
                  <Button type="button" variant="outline" size="sm" onClick={triggerEditingPlayerAvatarFileInput} className="flex-1"><UploadCloud className="mr-2 h-4 w-4" />Subir</Button>
                  <Button type="button" onClick={handleGenerateEditAvatar} variant="outline" size="sm" className="flex-1" disabled={isGeneratingEditAvatar}><Sparkles className={cn("mr-2 h-4 w-4", isGeneratingEditAvatar && "animate-spin")}/>IA</Button>
                </div>
                <input type="file" ref={editPlayerAvatarFileInputRef} onChange={handleEditingPlayerAvatarFileChange} accept="image/*" className="hidden"/>
                {editPlayerAvatarPreview && (<Button type="button" variant="link" size="sm" onClick={removeEditingPlayerAvatar} className="text-xs text-destructive p-0 h-auto mt-1"><XIcon className="mr-1 h-3 w-3"/>Quitar Fotografía</Button>)}
              </TabsContent>
              <TabsContent value="personal" className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {dynamicEditFieldsBySection['Personal']?.map((field) => (
                          <div key={field.key} className={cn("space-y-1", field.type === 'textarea' && "md:col-span-2")}>
                              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                              {field.type === 'text' && <Input id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'textarea' && <Textarea id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} rows={2} />}
                              {field.type === 'number' && <Input id={`edit-${field.key}`} name={field.key} type="number" value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'date' && (<Input id={`edit-${field.key}`} name={field.key} type="text" value={editDateInputValues[field.key] || ''} onChange={(e) => setEditDateInputValues(prev => ({...prev, [field.key]: e.target.value}))} onBlur={() => handleEditDateInputBlur(field.key, editDateInputValues[field.key])} placeholder={DATE_FORMAT_INPUT}/>)}
                              {field.type === 'select' && field.options && (<Select name={field.key} value={editingPlayerData[field.key] || ''} onValueChange={(value) => handleEditPlayerSelectChange(field.key, value)}><SelectTrigger id={`edit-${field.key}`}><SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{field.options.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent></Select>)}
                          </div>
                      ))}
                  </div>
              </TabsContent>
              <TabsContent value="deportivo" className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {dynamicEditFieldsBySection['Deportivo']?.map((field) => (
                          <div key={field.key} className={cn("space-y-1", field.type === 'textarea' && "md:col-span-2")}>
                              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                              {field.type === 'text' && <Input id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'textarea' && <Textarea id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} rows={2} />}
                              {field.type === 'number' && <Input id={`edit-${field.key}`} name={field.key} type="number" value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'date' && (<Input id={`edit-${field.key}`} name={field.key} type="text" value={editDateInputValues[field.key] || ''} onChange={(e) => setEditDateInputValues(prev => ({...prev, [field.key]: e.target.value}))} onBlur={() => handleEditDateInputBlur(field.key, editDateInputValues[field.key])} placeholder={DATE_FORMAT_INPUT}/>)}
                              {field.type === 'select' && field.options && (<Select name={field.key} value={editingPlayerData[field.key] || ''} onValueChange={(value) => handleEditPlayerSelectChange(field.key, value)}><SelectTrigger id={`edit-${field.key}`}><SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{field.options.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent></Select>)}
                          </div>
                      ))}
                  </div>
              </TabsContent>
              <TabsContent value="medico" className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {dynamicEditFieldsBySection['Médico']?.map((field) => (
                          <div key={field.key} className={cn("space-y-1", field.type === 'textarea' && "md:col-span-2")}>
                              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                              {field.type === 'text' && <Input id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'textarea' && <Textarea id={`edit-${field.key}`} name={field.key} value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} rows={2} />}
                              {field.type === 'number' && <Input id={`edit-${field.key}`} name={field.key} type="number" value={editingPlayerData[field.key] || ''} onChange={handleEditPlayerInputChange} />}
                              {field.type === 'date' && (<Input id={`edit-${field.key}`} name={field.key} type="text" value={editDateInputValues[field.key] || ''} onChange={(e) => setEditDateInputValues(prev => ({...prev, [field.key]: e.target.value}))} onBlur={() => handleEditDateInputBlur(field.key, editDateInputValues[field.key])} placeholder={DATE_FORMAT_INPUT}/>)}
                              {field.type === 'select' && field.options && (<Select name={field.key} value={editingPlayerData[field.key] || ''} onValueChange={(value) => handleEditPlayerSelectChange(field.key, value)}><SelectTrigger id={`edit-${field.key}`}><SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{field.options.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent></Select>)}
                          </div>
                      ))}
                  </div>
              </TabsContent>
            </div>
          </Tabs>
        </ModernDialog>
      <ModernDialog
        isOpen={isEvaluationDialogOpen}
        onClose={() => { setCurrentEvaluationPeriod(null); setIsEvaluationDialogOpen(false); }}
        title={`${currentEvaluationData?.notes && currentEvaluationData.notes.trim() !== '' ? 'Editar' : 'Añadir'} Evaluación - ${currentEvaluationPeriod} (${currentSeasonForEvaluation})`}
        icon={ClipboardEdit}
        size="md"
        type="info"
        footerContent={
          <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="secondary" onClick={() => setIsEvaluationDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEvaluation}>Guardar Evaluación</Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <div className="space-y-1"><Label htmlFor="evaluationDateObj">Fecha Evaluación*</Label><Popover><PopoverTrigger asChild><Button id="evaluationDateObj" variant="outline" className={cn("w-full justify-start text-left font-normal", !currentEvaluationData.evaluationDateObj && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4"/>{currentEvaluationData.evaluationDateObj ? format(currentEvaluationData.evaluationDateObj, "PPP", {locale: es}) : <span>Selecciona fecha</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><ShadCalendar mode="single" selected={currentEvaluationData.evaluationDateObj} onSelect={handleEvaluationDateChange} locale={es} /></PopoverContent></Popover></div>
          <div className="space-y-1"><Label htmlFor="notes">Notas*</Label><Textarea id="notes" name="notes" value={currentEvaluationData.notes || ''} onChange={handleEvaluationInputChange} rows={5} placeholder="Evolución, puntos fuertes, áreas de mejora..."/></div>
        </div>
      </ModernDialog>

      <ModernDialog
        isOpen={isInjuryDialogOpen}
        onClose={() => { setEditingInjury(null); setIsInjuryDialogOpen(false); }}
        title={editingInjury?.id ? 'Editar Lesión' : 'Añadir Lesión'}
        icon={Stethoscope}
        size="md"
        type="info"
        footerContent={
          <div className="flex justify-end gap-2 p-4 border-t">
            <Button variant="secondary" onClick={() => { setEditingInjury(null); setIsInjuryDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={handleSaveInjury}>Guardar</Button>
          </div>
        }
      >
        <div className="p-4 space-y-4"><div className="space-y-1"><Label htmlFor="injuryType">Tipo*</Label><Input id="injuryType" name="injuryType" value={editingInjury?.injuryType || ''} onChange={handleInjuryInputChange} placeholder="Ej: Esguince"/></div><div className="space-y-1"><Label htmlFor="startDateObj">F. Inicio*</Label><Popover><PopoverTrigger asChild><Button id="startDateObj" variant="outline" className={cn("w-full justify-start text-left font-normal", !editingInjury?.startDateObj && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4"/>{editingInjury?.startDateObj ? format(editingInjury.startDateObj, "PPP", {locale:es}) : <span>Selecciona</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><ShadCalendar mode="single" selected={editingInjury?.startDateObj} onSelect={(date) => handleInjuryDateChange(date, 'startDateObj')} locale={es} /></PopoverContent></Popover></div><div className="space-y-1"><Label htmlFor="status">Estado*</Label><Select value={editingInjury?.status || ''} onValueChange={(value: InjuryStatus) => handleInjuryStatusChange(value)}><SelectTrigger id="status"><SelectValue placeholder="Estado"/></SelectTrigger><SelectContent>{injuryStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="estimatedReturnDateObj">F. Retorno Estimada</Label><Popover><PopoverTrigger asChild><Button id="estimatedReturnDateObj" variant="outline" className={cn("w-full justify-start text-left font-normal", !editingInjury?.estimatedReturnDateObj && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4"/>{editingInjury?.estimatedReturnDateObj ? format(editingInjury.estimatedReturnDateObj, "PPP", {locale:es}) : <span>Selecciona</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><ShadCalendar mode="single" selected={editingInjury?.estimatedReturnDateObj} onSelect={(date) => handleInjuryDateChange(date, 'estimatedReturnDateObj')} locale={es} /></PopoverContent></Popover></div>{editingInjury?.status === 'Recuperado' && (<div className="space-y-1"><Label htmlFor="actualReturnDateObj">F. Retorno Real</Label><Popover><PopoverTrigger asChild><Button id="actualReturnDateObj" variant="outline" className={cn("w-full justify-start text-left font-normal", !editingInjury?.actualReturnDateObj && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4"/>{editingInjury?.actualReturnDateObj ? format(editingInjury.actualReturnDateObj, "PPP", {locale:es}) : <span>Selecciona</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><ShadCalendar mode="single" selected={editingInjury?.actualReturnDateObj} onSelect={(date) => handleInjuryDateChange(date, 'actualReturnDateObj')} locale={es} /></PopoverContent></Popover></div>)}{<div className="space-y-1"><Label htmlFor="description">Descripción</Label><Textarea id="description" name="description" value={editingInjury?.description || ''} onChange={handleInjuryInputChange} placeholder="Detalles..." rows={3}/></div>}<div className="space-y-1"><Label htmlFor="notes">Notas Seguimiento</Label><Textarea id="notes" name="notes" value={editingInjury?.notes || ''} onChange={handleInjuryInputChange} placeholder="Tratamiento, evolución..." rows={3}/></div></div>
      </ModernDialog>
        
        <ModernDialog isOpen={!!injuryToDelete} onClose={() => setInjuryToDelete(null)} title="¿Eliminar Lesión?" icon={Trash2} type="error" size="sm">
            {injuryToDelete && (
              <div className="p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">Eliminar: "{injuryToDelete.injuryType}" del {format(parseISO(injuryToDelete.startDate), "dd/MM/yyyy", {locale: es})}.</p>
                  <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setInjuryToDelete(null)}>Cancelar</Button>
                      <Button variant="destructive" onClick={confirmDeleteInjury}>Eliminar</Button>
                  </div>
              </div>
            )}
        </ModernDialog>

         <ModernDialog
            isOpen={isDeletePlayerDialogOpen}
            onClose={() => setIsDeletePlayerDialogOpen(false)}
            title={`Eliminar a ${player.name}`}
            type="error"
            size="sm"
            icon={Trash2}
         >
            <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                    Esta acción no se puede deshacer. Se eliminará el perfil del jugador de forma permanente.
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsDeletePlayerDialogOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" onClick={confirmDeletePlayer}>Eliminar</Button>
                </div>
            </div>
         </ModernDialog>
    </div>
  );
}
