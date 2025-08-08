

'use client';

import { useState, useEffect, type ChangeEvent, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { 
  trainingTaskCategories,
} from '@/lib/placeholder-data';
import type { 
  TrainingSession, 
  Team, 
  Player, 
  TrainingAttendanceRecord,
  TrainingTask,
  TrainingTaskCategory,
  TrainingSessionTask
} from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlusCircle, CalendarDays, Clock, MapPin, ListFilter, 
  UserCheck, UserX, FileClock, Timer, Calendar as CalendarIconLucide,
  Trash2, ListChecks as ListChecksIcon, Dumbbell, NotebookPen, Sparkles, Image as ImageIcon,
  LayoutGrid, List as ListIconLucide, Users, Edit3, LibraryBig, Search as SearchIcon,
  Star, MoreVertical, BookOpen, ClipboardList, Save, Download, Camera,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, startOfMonth, isSameDay, isValid, startOfDay, parseISO, isPast, startOfWeek, endOfWeek, getMonth, endOfMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { generateTrainingTask } from '@/ai/flows/generate-training-task-flow';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePageHeader } from '@/contexts/page-header-context';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/auth-context';
import { ModernDialog } from '@/components/ui/modern-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toJpeg } from 'html-to-image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';


const MAX_IMAGE_URL_LENGTH = 700000; // Approx 700KB

type TrainingAttendanceStatus = TrainingAttendanceRecord['status'];

const initialNewSessionData: Partial<Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt' | 'tasks'>> & { teamId: string; tasks: TrainingSessionTask[]; date?: Date } = {
  teamId: '',
  date: undefined,
  time: '',
  durationMinutes: 90,
  description: '',
  coachNotes: '',
  tasks: [],
};

const initialNewTaskData: Partial<Omit<TrainingTask, 'id' | 'createdAt' | 'updatedAt'>> = {
    name: '',
    description: '',
    durationMinutes: undefined,
    category: undefined,
    imageUrl: undefined,
};

const StarRating: React.FC<{ value: number; onValueChange: (newValue: number) => void; readOnly?: boolean; size?: 'sm' | 'md' }> = ({ value, onValueChange, readOnly = false, size = 'md' }) => (
    <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => !readOnly && onValueChange(star)} disabled={readOnly} className={cn(!readOnly && "cursor-pointer")}>
                <Star className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', "transition-colors", star <= value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30", !readOnly && "hover:text-yellow-300")} />
            </button>
        ))}
    </div>
);


export default function TrainingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { setHeader } = usePageHeader();
  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const sessionCarouselRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [allTrainingAttendance, setAllTrainingAttendance] = useState<TrainingAttendanceRecord[]>([]);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<TrainingSession | null>(null);
  const [sessionDetailsTasks, setSessionDetailsTasks] = useState<TrainingTask[]>([]);
  const [currentSessionPlayers, setCurrentSessionPlayers] = useState<Player[]>([]); // Unsorted players
  const [currentTrainingAttendanceData, setCurrentTrainingAttendanceData] = useState<Record<string, { status: TrainingAttendanceStatus, rating: number, justified: boolean }>>({});
  
  const [isSessionFormDialogOpen, setIsSessionFormDialogOpen] = useState(false);
  const [sessionFormData, setSessionFormData] = useState<Partial<Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt' | 'tasks'>> & { teamId: string; tasks: TrainingSessionTask[]; date?: Date }>({ ...initialNewSessionData });
  const [isEditingSession, setIsEditingSession] = useState(false);
  
  const [isTaskFormDialogOpen, setIsTaskFormDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Omit<TrainingTask, 'id' | 'createdAt' | 'updatedAt'>>>(initialNewTaskData);
  const [taskIdeaForAI, setTaskIdeaForAI] = useState('');
  const [taskCategoryForAI, setTaskCategoryForAI] = useState<TrainingTaskCategory | undefined>(undefined);
  const [isGeneratingTask, setIsGeneratingTask] = useState(false);

  const [selectedTeamFilterTraining, setSelectedTeamFilterTraining] = useState<string>('all');
  const [selectedDateFilterTraining, setSelectedDateFilterTraining] = useState<Date | undefined>(undefined);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  const [teams, setTeamsData] = useState<Team[]>([]);
  const [players, setPlayersData] = useState<Player[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [sessionToDelete, setSessionToDelete] = useState<TrainingSession | null>(null);
  const [taskToDeleteFromDetails, setTaskToDeleteFromDetails] = useState<TrainingSessionTask | null>(null);

  const [isDrillsLibraryDialogOpen, setIsDrillsLibraryDialogOpen] = useState(false);
  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState<TrainingTaskCategory | 'all'>('all');
  const [firestoreDrillsLibrary, setFirestoreDrillsLibrary] = useState<TrainingTask[]>([]);
  
  const [isAttendanceSnapshotOpen, setIsAttendanceSnapshotOpen] = useState(false);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const [snapshotFilter, setSnapshotFilter] = useState<'Presente' | 'all'>('Presente');


  const openAddSessionDialog = useCallback(() => {
    setIsEditingSession(false);
    setSessionFormData(initialNewSessionData);
    setNewTask(initialNewTaskData);
    setTaskIdeaForAI('');
    setTaskCategoryForAI(undefined);
    setIsSessionFormDialogOpen(true);
  }, []);

  const headerAction = useMemo(() => (
    <div className="flex gap-2 flex-wrap items-center">
      {isMobile ? (
        <>
          <Button onClick={openAddSessionDialog} size="icon" className="h-8 w-8">
            <PlusCircle className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setViewMode('card')}>
                <LayoutGrid className="mr-2 h-4 w-4"/> Vista de Tarjetas
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setViewMode('list')}>
                <ListIconLucide className="mr-2 h-4 w-4"/> Vista de Lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('card')}><LayoutGrid className="h-4 w-4"/></Button>
            </TooltipTrigger><TooltipContent><p>Vista de Tarjetas</p></TooltipContent></Tooltip></TooltipProvider>
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><ListIconLucide className="h-4 w-4"/></Button>
            </TooltipTrigger><TooltipContent><p>Vista de Lista</p></TooltipContent></Tooltip></TooltipProvider>
          </div>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button onClick={openAddSessionDialog} size="icon" className="h-8 w-8">
              <PlusCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent><p>Nueva Sesión</p></TooltipContent></Tooltip></TooltipProvider>
        </>
      )}
    </div>
  ), [viewMode, isMobile, openAddSessionDialog]);

  useEffect(() => {
    setHeader({
      title: 'Entrenamientos',
      description: 'Planifica sesiones, registra tareas y gestiona la asistencia.',
      icon: Dumbbell,
      action: headerAction
    });
  }, [setHeader, headerAction]);


  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const teamsSnapshot = await getDocs(query(collection(db, "teams"), orderBy("name")));
      setTeamsData(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));

      const playersSnapshot = await getDocs(query(collection(db, "players"), orderBy("name")));
      setPlayersData(playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
      
      const sessionsSnapshot = await getDocs(query(collection(db, "trainingSessions"), orderBy("date", "desc")));
      const loadedSessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        const date = (data.date as Timestamp).toDate();
        const status = isPast(date) ? 'Finalizado' : 'Programado';
        return { 
          id: doc.id, 
          ...data, 
          date: date,
          status: status
        } as TrainingSession;
      });
      setSessions(loadedSessions);

      const attendanceSnapshot = await getDocs(collection(db, "trainingAttendance"));
      setAllTrainingAttendance(attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAttendanceRecord)));

      const drillsLibrarySnapshot = await getDocs(query(collection(db, "drillsLibrary"), orderBy("name")));
      setFirestoreDrillsLibrary(drillsLibrarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingTask)));

    } catch (error) {
      console.error("Error fetching data from Firestore:", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos de entrenamiento.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);
  
  const handleAttendanceDialogClose = () => {
    setSelectedSessionForAttendance(null);
    setCurrentTrainingAttendanceData({});
    setSessionDetailsTasks([]);
    if (searchParams.get('sessionId')) {
        router.replace(pathname, { scroll: false });
    }
  };

  const openTrainingAttendanceDialog = useCallback(async (session: TrainingSession) => {
    setSelectedSessionForAttendance(session);
    const teamPlayers = players.filter(p => p.teamId === session.teamId);
    setCurrentSessionPlayers(teamPlayers); 
    const initialData: Record<string, { status: TrainingAttendanceStatus; rating: number; justified: boolean }> = {};
    teamPlayers.forEach(player => {
      const existingRecord = allTrainingAttendance.find(ar => ar.sessionId === session.id && ar.playerId === player.id);
      initialData[player.id] = {
        status: existingRecord?.status || 'Presente',
        rating: existingRecord?.rating || 0,
        justified: existingRecord?.justified || false,
      };
    });
    setCurrentTrainingAttendanceData(initialData);

    if(session.tasks && session.tasks.length > 0) {
        const taskDetails = session.tasks
            .map(taskRef => firestoreDrillsLibrary.find(drill => drill.id === taskRef.drillId))
            .filter((task): task is TrainingTask => !!task);
        setSessionDetailsTasks(taskDetails);
    } else {
        setSessionDetailsTasks([]);
    }
  }, [players, allTrainingAttendance, firestoreDrillsLibrary]);

  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId');
    if (sessionIdFromUrl && sessions.length > 0 && !selectedSessionForAttendance && !isSessionFormDialogOpen) {
      const sessionToOpen = sessions.find(s => s.id === sessionIdFromUrl);
      if (sessionToOpen) {
        openTrainingAttendanceDialog(sessionToOpen);
      }
    }
  }, [searchParams, sessions, selectedSessionForAttendance, isSessionFormDialogOpen, openTrainingAttendanceDialog]);


  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.name || 'Equipo Desconocido';
  };
  
  const scheduledTrainingDates = useMemo(() => sessions.filter(s => !isPast(s.date as Date)).map(s => startOfDay(s.date as Date)), [sessions]);
  const pastTrainingDates = useMemo(() => sessions.filter(s => isPast(s.date as Date)).map(s => startOfDay(s.date as Date)), [sessions]);

  
  const currentWeek = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { locale: es });
    const end = endOfWeek(today, { locale: es });
    return { from: start, to: end };
  }, []);

  const currentMonthRange = useMemo(() => {
    return { from: startOfMonth(currentCalendarMonth), to: endOfMonth(currentCalendarMonth) };
  }, [currentCalendarMonth]);

  const filteredTrainingSessions = useMemo(() => {
    return sessions.filter(session => {
        const teamMatch = selectedTeamFilterTraining === 'all' || session.teamId === selectedTeamFilterTraining;
        
        let dateMatch = true;
        const sessionDate = new Date(session.date as Date);

        if (selectedDateFilterTraining) {
            dateMatch = isSameDay(sessionDate, selectedDateFilterTraining);
        } else {
            // By default, show current month's sessions if no specific day is selected
            dateMatch = getMonth(sessionDate) === getMonth(currentCalendarMonth) && getYear(sessionDate) === getYear(currentCalendarMonth);
        }

        return teamMatch && dateMatch;
    }).sort((a,b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  }, [sessions, selectedTeamFilterTraining, selectedDateFilterTraining, currentCalendarMonth]);

  const displayedPlayersForAttendance = useMemo(() => {
    return [...currentSessionPlayers].sort((a, b) => {
        const numA = a.jerseyNumber ?? 999;
        const numB = b.jerseyNumber ?? 999;
        if (numA !== numB) {
            return numA - numB;
        }
        return a.name.localeCompare(b.name);
    });
  }, [currentSessionPlayers]);


  const handleAttendanceStatusChange = (playerId: string, status: TrainingAttendanceStatus) => {
    setCurrentTrainingAttendanceData(prev => ({ 
      ...prev, 
      [playerId]: { 
        ...(prev[playerId] || { rating: 0, justified: false }), 
        status,
        rating: status === 'Ausente' ? 0 : (prev[playerId]?.rating || 0), // Reset rating if absent
      }
    }));
  };

  const handleJustifiedChange = (playerId: string, isJustified: boolean) => {
    setCurrentTrainingAttendanceData(prev => ({
        ...prev,
        [playerId]: { ...(prev[playerId] || { status: 'Ausente', rating: 0 }), justified: isJustified }
    }));
  };

  const handleRatingChange = (playerId: string, rating: number) => {
    setCurrentTrainingAttendanceData(prev => ({ 
        ...prev, 
        [playerId]: { ...(prev[playerId] || { status: 'Presente', justified: false }), rating }
    }));
  };


  const isSaveAttendanceDisabled = useMemo(() => {
    if (!selectedSessionForAttendance || currentSessionPlayers.length === 0) return true;
    return currentSessionPlayers.some(player => currentTrainingAttendanceData[player.id]?.status === undefined);
  }, [currentSessionPlayers, currentTrainingAttendanceData, selectedSessionForAttendance]);


  const handleSaveTrainingAttendance = async () => {
    if (!selectedSessionForAttendance || isSaveAttendanceDisabled) return;

    const batch = writeBatch(db);
    const attendanceRecordsToProcess = Object.entries(currentTrainingAttendanceData);

    for (const [playerId, data] of attendanceRecordsToProcess) {
        if (!data.status) continue;
        const existingRecord = allTrainingAttendance.find(ar => ar.sessionId === selectedSessionForAttendance.id && ar.playerId === playerId);
        const recordData = { 
            status: data.status, 
            rating: data.rating || 0, 
            justified: data.justified || false, 
            updatedAt: serverTimestamp() 
        };

        if (existingRecord) {
            const recordRef = doc(db, "trainingAttendance", existingRecord.id);
            batch.update(recordRef, recordData);
        } else {
            const newRecordRef = doc(collection(db, "trainingAttendance"));
            batch.set(newRecordRef, {
                sessionId: selectedSessionForAttendance.id,
                playerId,
                ...recordData,
                createdAt: serverTimestamp(),
            });
        }
    }
    try {
        await batch.commit();
        await fetchPageData(); 
        toast({
          title: "Asistencia a Entrenamiento Guardada",
          description: `Se ha guardado la asistencia para la sesión del ${format(new Date(selectedSessionForAttendance.date as Date), "dd/MM/yyyy", { locale: es })}.`,
        });
    } catch (error) {
        console.error("Error saving training attendance to Firestore:", error);
        toast({ title: "Error al Guardar Asistencia", variant: "destructive" });
    }
    handleAttendanceDialogClose(); 
  };
  
  const attendanceOptions: { status: TrainingAttendanceStatus; icon: React.ElementType, className: string }[] = [
    { status: 'Presente', icon: UserCheck, className: 'border-green-300 dark:border-green-700' },
    { status: 'Ausente', icon: UserX, className: 'border-red-300 dark:border-red-700' },
    { status: 'Tarde', icon: Timer, className: 'border-blue-300 dark:border-blue-700' },
  ];

  const getActiveButtonClass = (status: TrainingAttendanceStatus): string => {
    switch (status) {
      case 'Presente': return 'bg-green-600 hover:bg-green-600/90 text-white border-green-600';
      case 'Ausente': return 'bg-red-600 hover:bg-red-600/90 text-white border-red-600';
      case 'Tarde': return 'bg-blue-600 hover:bg-blue-600/90 text-white border-blue-600';
      case 'Justificado': return 'bg-yellow-500 hover:bg-yellow-500/90 text-white border-yellow-500';
      default: return 'bg-muted hover:bg-muted/80';
    }
  }

  const handleSessionFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSessionFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSessionFormTeamChange = (teamId: string) => {
    setSessionFormData(prev => ({ ...prev, teamId }));
  };

  const handleSessionFormDateChange = (date: Date | undefined) => {
    setSessionFormData(prev => ({ ...prev, date }));
  };

  const openNewTaskDialog = () => {
    setNewTask(initialNewTaskData);
    setTaskIdeaForAI('');
    setTaskCategoryForAI(undefined);
    setIsTaskFormDialogOpen(true);
  };
  
  const handleNewTaskInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTask(prev => ({ ...prev, [name]: name === 'durationMinutes' ? (value ? parseInt(value, 10) : undefined) : value }));
  };
  
  const handleNewTaskCategoryChange = (value: TrainingTaskCategory) => {
    setNewTask(prev => ({...prev, category: value}));
  };

  const handleAddTrainingTaskToSessionForm = async () => {
    if (!newTask.name?.trim()) {
        toast({ title: "Nombre de tarea requerido", variant: "destructive"});
        return;
    }
    let drillId = newTask.id;

    // If it's a new task (no ID yet), save it to the library first.
    if (!drillId) {
      const taskDataToSave = {
        name: newTask.name!,
        description: newTask.description || null,
        durationMinutes: newTask.durationMinutes ?? null,
        category: newTask.category || null,
        imageUrl: newTask.imageUrl || null,
      };
      
      try {
        const docRef = await addDoc(collection(db, "drillsLibrary"), {
          ...taskDataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        drillId = docRef.id;
        // Refresh local library cache
        setFirestoreDrillsLibrary(prev => [...prev, {id: drillId, ...taskDataToSave} as TrainingTask]);
        toast({title: "Ejercicio guardado en biblioteca"});
      } catch (error) {
         console.error("Error saving new drill to library:", error);
         toast({title: "Error", description: "No se pudo guardar el nuevo ejercicio en la biblioteca.", variant: "destructive"});
         return;
      }
    }

    const taskToAdd: TrainingSessionTask = {
        drillId: drillId!,
        durationMinutes: newTask.durationMinutes,
    };
    setSessionFormData(prev => ({ ...prev, tasks: [...(prev.tasks || []), taskToAdd] }));
    setIsTaskFormDialogOpen(false);
  };

  const handleGenerateTaskWithAI = async () => {
    if (!taskIdeaForAI.trim()) {
      toast({ title: "Idea para IA requerida", description: "Por favor, introduce una idea para que la IA genere la tarea.", variant: "destructive" });
      return;
    }
    setIsGeneratingTask(true);
    toast({ title: "Generando Tarea con IA", description: "Por favor, espera..." });
    try {
      const result = await generateTrainingTask({ taskIdea: taskIdeaForAI, taskCategory: taskCategoryForAI });
      setNewTask({
        id: undefined, // This is a new, unsaved task
        name: result.taskName,
        description: result.taskDescription,
        durationMinutes: result.taskDurationMinutes,
        category: taskCategoryForAI, 
        imageUrl: result.taskImageDataUri,
      });
      toast({ title: "Tarea Generada por IA", description: "Los detalles de la tarea se han rellenado. Se guardará en la biblioteca al añadirla." });
    } catch (error) {
      console.error("Error generating training task with AI:", error);
      toast({ title: "Error de IA", description: "No se pudo generar la tarea. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsGeneratingTask(false);
    }
  };

  const handleRemoveTrainingTaskFromSessionForm = (taskId: string) => {
    setSessionFormData(prev => ({
        ...prev,
        tasks: prev.tasks?.filter(task => task.drillId !== taskId) || [],
    }));
  };
  
  const resetAndCloseSessionForm = () => {
    setIsSessionFormDialogOpen(false);
    setSessionFormData(initialNewSessionData);
    setNewTask(initialNewTaskData);
    setTaskIdeaForAI('');
    setTaskCategoryForAI(undefined);
    setIsEditingSession(false);
  };

  const openEditSessionDialog = (session: TrainingSession) => {
    setIsEditingSession(true);
    setSessionFormData({
      ...session,
      teamId: session.teamId, 
      date: session.date as Date,
      tasks: session.tasks || [], 
    });
    setNewTask(initialNewTaskData);
    setTaskIdeaForAI('');
    setTaskCategoryForAI(undefined);
    setIsSessionFormDialogOpen(true);
  };

  const handleSaveSessionSubmit = async () => {
    if (!sessionFormData.teamId || !sessionFormData.date || !sessionFormData.time) {
      toast({ title: "Campos incompletos", description: "Por favor, selecciona equipo, fecha y hora.", variant: "destructive" });
      return;
    }
  
    const selectedTeam = teams.find(t => t.id === sessionFormData.teamId);
    
    const durationValue = sessionFormData.durationMinutes;
    const durationNum = (durationValue !== null && durationValue !== undefined && String(durationValue).trim() !== '') ? Number(durationValue) : null;
    
    const dataToSave = {
      teamId: sessionFormData.teamId!,
      clubId: selectedTeam?.clubId || null,
      date: Timestamp.fromDate(sessionFormData.date!),
      time: sessionFormData.time!,
      durationMinutes: (durationNum !== null && !isNaN(durationNum)) ? durationNum : null,
      location: sessionFormData.location || null,
      description: sessionFormData.description || null,
      coachNotes: sessionFormData.coachNotes || null,
      tasks: sessionFormData.tasks || [],
      updatedAt: serverTimestamp(),
    };
    
    try {
      if (isEditingSession && sessionFormData.id) {
        const sessionRef = doc(db, "trainingSessions", sessionFormData.id);
        await updateDoc(sessionRef, dataToSave as any);
        toast({ title: "Sesión Actualizada", description: `Sesión para ${getTeamName(dataToSave.teamId)} el ${format(sessionFormData.date, "dd/MM/yyyy", { locale: es })} ha sido actualizada.`});
      } else {
        await addDoc(collection(db, "trainingSessions"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Sesión Registrada", description: `Nueva sesión para ${getTeamName(dataToSave.teamId)} el ${format(sessionFormData.date, "dd/MM/yyyy", { locale: es })}.`});
      }
      fetchPageData(); 
    } catch (error) {
        console.error("Error saving session to Firestore:", error);
        toast({ title: "Error al Guardar Sesión", description: "No se pudo guardar la sesión. " + (error as Error).message, variant: "destructive" });
    }
    
    resetAndCloseSessionForm();
  };

  const handleDeleteSessionRequest = (session: TrainingSession) => {
    setSessionToDelete(session);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      try {
        const batch = writeBatch(db);
        
        const sessionRef = doc(db, "trainingSessions", sessionToDelete.id);
        batch.delete(sessionRef);

        const attendanceQuery = query(collection(db, "trainingAttendance"), where("sessionId", "==", sessionToDelete.id));
        const attendanceSnapshot = await getDocs(attendanceQuery);
        attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        toast({
          title: "Sesión Eliminada",
          description: `La sesión del ${format(new Date(sessionToDelete.date as Date), "dd/MM/yyyy", { locale: es })} y su asistencia han sido eliminadas.`,
        });
        fetchPageData();
      } catch (error) {
        console.error("Error deleting session and attendance:", error);
        toast({ title: "Error al Eliminar Sesión", variant: "destructive" });
      } finally {
        setSessionToDelete(null);
        setIsSessionFormDialogOpen(false); 
      }
    }
  };

  const handleRemoveTaskFromSessionDetails = async (task: TrainingSessionTask) => {
    if (selectedSessionForAttendance && selectedSessionForAttendance.id) {
      setTaskToDeleteFromDetails(task); 
    }
  };

  const confirmDeleteTaskFromDetails = async () => {
    if (taskToDeleteFromDetails && selectedSessionForAttendance && selectedSessionForAttendance.id) {
        const updatedTasks = selectedSessionForAttendance.tasks?.filter(t => t.drillId !== taskToDeleteFromDetails.drillId) || [];
        try {
            const sessionRef = doc(db, "trainingSessions", selectedSessionForAttendance.id);
            await updateDoc(sessionRef, { tasks: updatedTasks, updatedAt: serverTimestamp() });
            
            const updatedSession = { ...selectedSessionForAttendance, tasks: updatedTasks };
            setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
            setSelectedSessionForAttendance(updatedSession); 
            
            toast({ title: "Tarea Eliminada de la Sesión" });
        } catch (error) {
            console.error("Error deleting task from session in Firestore:", error);
            toast({ title: "Error al Eliminar Tarea", variant: "destructive" });
        } finally {
            setTaskToDeleteFromDetails(null);
        }
    }
  };


  const handleSelectDrillFromLibrary = (drill: TrainingTask) => {
    setNewTask({
      id: drill.id,
      name: drill.name,
      description: drill.description,
      durationMinutes: drill.durationMinutes,
      category: drill.category,
      imageUrl: drill.imageUrl,
    });
    setTaskIdeaForAI(''); 
    setTaskCategoryForAI(drill.category);
    setIsDrillsLibraryDialogOpen(false);
    toast({title: "Ejercicio Seleccionado", description: `"${drill.name}" cargado en el formulario de tarea.`});
  };

  const filteredLibraryDrills = firestoreDrillsLibrary.filter(drill => {
    const matchesSearch = drill.name.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
                          (drill.description && drill.description.toLowerCase().includes(librarySearchTerm.toLowerCase()));
    const matchesCategory = libraryCategoryFilter === 'all' || drill.category === libraryCategoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  const teamsForFilter = useMemo(() => {
    if (!userProfile) return teams;
    if (userProfile.role === 'Administrador' || userProfile.role === 'Directivo Club') {
      return teams;
    }
    if (userProfile.role === 'Entrenador') {
      return teams.filter(team => userProfile.managedTeamIds?.includes(team.id));
    }
    return [];
  }, [teams, userProfile]);
  
  const teamsForDialog = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'Administrador' || userProfile.role === 'Directivo Club') {
        return teams;
    }
    if (userProfile.role === 'Entrenador') {
        return teams.filter(team => userProfile.managedTeamIds?.includes(team.id));
    }
    return [];
  }, [teams, userProfile]);
  
  const sessionDialogHeaderActions = isEditingSession && sessionFormData.id ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteSessionRequest(sessionFormData as TrainingSession)}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Eliminar Sesión</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : undefined;
  
  const attendanceDialogHeaderActions = (
    <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="text-white hover:text-white/80 hover:bg-white/10" onClick={() => setIsAttendanceSnapshotOpen(true)}>
                <Camera className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Snapshot de Asistencia</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={handleSaveTrainingAttendance} disabled={isSaveAttendanceDisabled} className="text-white hover:text-white/80 hover:bg-white/10">
                <Save className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Guardar Asistencias</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
    </div>
  );
  
    const handleDownloadSnapshot = useCallback(async () => {
    if (!snapshotRef.current) return;
    try {
      const dataUrl = await toJpeg(snapshotRef.current, { 
        quality: 0.98, pixelRatio: 2.5, backgroundColor: 'white', style: { margin: '0', padding: '16px' }
      });
      const link = document.createElement('a');
      link.download = `asistencia-${selectedSessionForAttendance?.teamId}-${format(new Date(selectedSessionForAttendance?.date as Date), "yyyy-MM-dd")}.jpeg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error al generar snapshot:', error);
      toast({ title: "Error al generar imagen", variant: "destructive" });
    }
  }, [selectedSessionForAttendance, toast]);
  
  const snapshotPlayers = useMemo(() => {
    if (!selectedSessionForAttendance) return [];
    if (snapshotFilter === 'all') return displayedPlayersForAttendance;
    return displayedPlayersForAttendance.filter(p => currentTrainingAttendanceData[p.id]?.status === snapshotFilter);
  }, [snapshotFilter, displayedPlayersForAttendance, currentTrainingAttendanceData, selectedSessionForAttendance]);

  const attendanceSummary = useMemo(() => {
    if (!selectedSessionForAttendance) return { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
    return Object.values(currentTrainingAttendanceData).reduce((acc, data) => {
        if (data.status === 'Presente') acc.presente++;
        if (data.status === 'Ausente') acc.ausente++;
        if (data.status === 'Tarde') acc.tarde++;
        if (data.justified) acc.justificado++;
        return acc;
    }, { presente: 0, ausente: 0, tarde: 0, justificado: 0 });
  }, [currentTrainingAttendanceData, selectedSessionForAttendance]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (sessionCarouselRef.current) {
        const scrollAmount = sessionCarouselRef.current.clientWidth * 0.75;
        sessionCarouselRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    }
  };



  return (
    <div className="space-y-6">
      <ModernDialog
        isOpen={isSessionFormDialogOpen}
        onClose={resetAndCloseSessionForm}
        title={isEditingSession ? 'Editar Sesión de Entrenamiento' : 'Registrar Sesión de Entrenamiento'}
        icon={Dumbbell}
        size="xl"
        type="info"
        headerActions={sessionDialogHeaderActions}
        footerContent={
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t shrink-0">
                <Button type="button" variant="secondary" onClick={resetAndCloseSessionForm}>Cancelar</Button>
                <Button type="button" onClick={handleSaveSessionSubmit} className="btn-primary"><Save className="mr-2 h-4 w-4"/>Guardar Sesión</Button>
            </div>
        }
      >
        <Tabs defaultValue="session-details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="session-details"><BookOpen className="mr-2 h-4 w-4"/>Detalles de la Sesión</TabsTrigger>
            <TabsTrigger value="session-tasks"><ClipboardList className="mr-2 h-4 w-4"/>Tareas/Ejercicios</TabsTrigger>
          </TabsList>
          <TabsContent value="session-details" className="pt-4 space-y-4 px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Select name="teamId" value={sessionFormData.teamId} onValueChange={handleSessionFormTeamChange}>
                    <SelectTrigger id="teamId-training"><SelectValue placeholder="Equipo*" /></SelectTrigger>
                    <SelectContent>{teamsForDialog.map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                  <div className="md:col-span-2">
                      <Calendar
                        mode="single"
                        selected={sessionFormData.date}
                        onSelect={handleSessionFormDateChange}
                        locale={es}
                        className="rounded-md border w-full"
                        initialFocus
                        month={sessionFormData.date || new Date()} 
                        onMonthChange={(month) => setSessionFormData(prev => ({...prev, date: prev.date ? new Date(month.getFullYear(), month.getMonth(), prev.date.getDate()) : month}))}
                    />
                </div>
                <Input id="time-training" name="time" type="time" placeholder="Hora*" value={sessionFormData.time || ''} onChange={handleSessionFormInputChange} />
                <Input id="durationMinutes-training" name="durationMinutes" type="number" value={sessionFormData.durationMinutes || ''} onChange={handleSessionFormInputChange} placeholder="Duración (min)"/>
                <Input id="location-training" name="location" value={sessionFormData.location || ''} onChange={handleSessionFormInputChange} placeholder="Lugar"/>
                <Textarea id="description-training" name="description" value={sessionFormData.description || ''} onChange={handleSessionFormInputChange} placeholder="Descripción General..." rows={2} className="md:col-span-2"/>
                <Textarea id="coachNotes-training" name="coachNotes" value={sessionFormData.coachNotes || ''} onChange={handleSessionFormInputChange} placeholder="Notas del Entrenador..." rows={2} className="md:col-span-2"/>
            </div>
          </TabsContent>
          <TabsContent value="session-tasks" className="pt-4 space-y-4 px-4 sm:px-6">
              <h4 className="text-md font-medium font-headline text-primary border-b pb-2">Tareas de la Sesión</h4>
              {sessionFormData.tasks && sessionFormData.tasks.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {sessionFormData.tasks.map((taskRef, index) => {
                          const taskDetail = firestoreDrillsLibrary.find(d => d.id === taskRef.drillId);
                          if (!taskDetail) return null;
                          return (
                          <Card key={taskRef.drillId} className="p-3 bg-muted/50 shadow-sm">
                              <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1">
                                      <p className="font-semibold text-sm">{index + 1}. {taskDetail.name}</p>
                                      {taskDetail.category && <Badge variant="secondary" className="text-xs my-1">{taskDetail.category}</Badge>}
                                      {taskDetail.description && <div className="text-xs text-muted-foreground pl-4"><ReactMarkdown className="prose prose-sm dark:prose-invert">{taskDetail.description}</ReactMarkdown></div>}
                                      {taskRef.durationMinutes && <p className="text-xs text-muted-foreground pl-4">Duración: {taskRef.durationMinutes} min</p>}
                                      {taskDetail.imageUrl && (
                                          <div className="mt-2 rounded border overflow-hidden w-full sm:w-2/3">
                                              <Image src={taskDetail.imageUrl} alt={`Diagrama de ${taskDetail.name}`} width={300} height={200} className="w-full h-auto object-contain" data-ai-hint="exercise diagram" />
                                          </div>
                                      )}
                                  </div>
                                  <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTrainingTaskFromSessionForm(taskDetail.id)} className="h-7 w-7 text-destructive shrink-0">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Eliminar esta tarea</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                              </div>
                          </Card>
                          )
                      })}
                  </div>
              )}
               <div className="pt-4 border-t">
                  <Button onClick={openNewTaskDialog} variant="outline" className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Añadir Nueva Tarea
                  </Button>
              </div>
          </TabsContent>
        </Tabs>
      </ModernDialog>

      <ModernDialog
        isOpen={isTaskFormDialogOpen}
        onClose={() => setIsTaskFormDialogOpen(false)}
        title="Añadir Tarea de Entrenamiento"
        size="lg"
        type="info"
        footerContent={
            <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="secondary" onClick={() => setIsTaskFormDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddTrainingTaskToSessionForm} disabled={!newTask.name}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Tarea a la Sesión
                </Button>
            </div>
        }
      >
        <div className="p-4 space-y-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <p className="text-sm font-medium flex-1">Añadir Nueva Tarea:</p>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setIsDrillsLibraryDialogOpen(true)} className="w-full sm:w-auto">
                                <LibraryBig className="mr-2 h-4 w-4"/> Seleccionar de Biblioteca
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Abrir la biblioteca de ejercicios guardados.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <Card className="p-4 border-dashed bg-muted/20 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="task-idea-ai" value={taskIdeaForAI} onChange={(e) => setTaskIdeaForAI(e.target.value)} placeholder="Idea para Tarea (IA)"/>
                    <Select value={taskCategoryForAI} onValueChange={(value: TrainingTaskCategory) => setTaskCategoryForAI(value)}>
                        <SelectTrigger id="task-category-ai"><SelectValue placeholder="Categoría (IA) (Opcional)" /></SelectTrigger>
                        <SelectContent>{trainingTaskCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button type="button" variant="outline" size="sm" onClick={handleGenerateTaskWithAI} disabled={!taskIdeaForAI.trim() || isGeneratingTask} className="w-full md:w-auto mt-2">
                                <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingTask && "animate-spin")}/> {isGeneratingTask ? "Generando Tarea..." : "Generar Tarea con IA"}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Usar IA para rellenar los detalles de la tarea basados en tu idea.</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </Card>
            
            <Separator />
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="task-name" name="name" value={newTask.name || ''} onChange={handleNewTaskInputChange} placeholder="Nombre Tarea*"/>
                    <Input id="task-duration" name="durationMinutes" type="number" value={newTask.durationMinutes || ''} onChange={handleNewTaskInputChange} placeholder="Duración (min)"/>
                    <div className="md:col-span-2">
                        <Select name="category" value={newTask.category} onValueChange={handleNewTaskCategoryChange}>
                            <SelectTrigger id="task-category"><SelectValue placeholder="Categoría Tarea" /></SelectTrigger>
                            <SelectContent>{trainingTaskCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    <Textarea id="task-description" name="description" value={newTask.description || ''} onChange={handleNewTaskInputChange} placeholder="Descripción Tarea (soporta Markdown)..." rows={3} className="md:col-span-2"/>
                </div>
                {newTask.imageUrl && (
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Imagen de la Tarea (IA)</p>
                        <div className="border rounded-md p-2 flex justify-center items-center bg-muted/30">
                        <Image src={newTask.imageUrl} alt="Diagrama de tarea generado" width={200} height={150} className="object-contain rounded" data-ai-hint="exercise diagram"/>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </ModernDialog>

      <ModernDialog
        isOpen={isDrillsLibraryDialogOpen}
        onClose={() => setIsDrillsLibraryDialogOpen(false)}
        title="Seleccionar Ejercicio de la Biblioteca"
        size="lg"
        type="info"
        icon={LibraryBig}
        footerContent={
            <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="secondary" onClick={() => setIsDrillsLibraryDialogOpen(false)}>Cerrar</Button>
            </div>
        }
      >
          <div className="space-y-4 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                      <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Buscar ejercicio por nombre..." 
                          className="pl-8"
                          value={librarySearchTerm}
                          onChange={(e) => setLibrarySearchTerm(e.target.value)}
                      />
                  </div>
                  <Select value={libraryCategoryFilter} onValueChange={(value: TrainingTaskCategory | 'all') => setLibraryCategoryFilter(value)}>
                      <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {trainingTaskCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <ScrollArea className="h-96 border rounded-md p-2">
                  {filteredLibraryDrills.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No hay ejercicios en la biblioteca que coincidan.</p>
                  ) : (
                      <div className="space-y-2">
                          {filteredLibraryDrills.map(drill => (
                              <Card key={drill.id} className="p-3 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-start gap-3">
                                      {drill.imageUrl && (
                                          <Avatar className="h-12 w-16 rounded-md border bg-muted/30">
                                              <AvatarImage src={drill.imageUrl} alt={drill.name} className="object-contain" data-ai-hint="exercise diagram" />
                                              <AvatarFallback className="rounded-md text-xs p-1 items-center justify-center flex"><ImageIcon className="h-5 w-5 text-muted-foreground"/></AvatarFallback>
                                          </Avatar>
                                      )}
                                      <div className="flex-1">
                                          <p className="font-semibold text-sm">{drill.name}</p>
                                          {drill.category && <Badge variant="outline" className="text-xs my-0.5">{drill.category}</Badge>}
                                          <p className="text-xs text-muted-foreground line-clamp-2">{drill.description}</p>
                                      </div>
                                      <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                  <Button size="sm" variant="outline" onClick={() => handleSelectDrillFromLibrary(drill)}>Seleccionar</Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p>Usar este ejercicio en el formulario.</p>
                                              </TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                  </div>
                              </Card>
                          ))}
                      </div>
                  )}
              </ScrollArea>
          </div>
      </ModernDialog>
      
      <Card>
        <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1">
                    <Select value={selectedTeamFilterTraining} onValueChange={setSelectedTeamFilterTraining}>
                        <SelectTrigger id="team-filter-training" className="w-full md:w-[250px]">
                            <SelectValue placeholder="Filtrar por Equipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los Equipos</SelectItem>
                          {teamsForFilter.map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>
            <div>
              <Calendar
                  mode="single"
                  month={currentCalendarMonth}
                  onMonthChange={setCurrentCalendarMonth}
                  selected={selectedDateFilterTraining}
                  onSelect={(date) => {
                      const newDate = date ? startOfDay(date) : undefined;
                      setSelectedDateFilterTraining(newDate);
                      if (newDate) {
                          const newUrl = `${pathname}?date=${format(newDate, 'yyyy-MM-dd')}`;
                          router.replace(newUrl, { scroll: false });
                      } else {
                          router.replace(pathname, { scroll: false });
                      }
                  }}
                  modifiers={{ 
                    activeTraining: scheduledTrainingDates,
                    pastTraining: pastTrainingDates,
                    currentWeek: currentWeek,
                  }}
                  modifiersClassNames={{ 
                      activeTraining: 'day-training-active', 
                      pastTraining: 'day-training-past',
                      today: 'day-today',
                      currentWeek: 'day-current-week',
                   }}
                  locale={es}
                  className="rounded-md border"
                  showOutsideDays={false}
              />
            </div>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-between gap-2 mb-2 pt-4">
        <h3 className="text-lg font-semibold font-headline">
          {selectedDateFilterTraining 
              ? `Entrenamientos del ${format(selectedDateFilterTraining, "dd 'de' MMMM 'de' yyyy", { locale: es })}` 
              : `Entrenamientos de ${format(currentCalendarMonth, "MMMM 'de' yyyy", { locale: es })}`
          }
        </h3>
      </div>
      {filteredTrainingSessions.length === 0 ? (
          <div className="text-center py-10"><Dumbbell className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No hay sesiones</h3><p className="mt-1 text-sm text-muted-foreground">No hay sesiones de entrenamiento que coincidan o no se han registrado aún.</p></div>
      ) : viewMode === 'card' ? (
        <div className="relative group">
            <div ref={sessionCarouselRef} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {filteredTrainingSessions.map((session) => {
                  const isSessionPast = isPast(new Date(session.date as Date));
                  const isSelected = selectedDateFilterTraining && isSameDay(new Date(session.date), selectedDateFilterTraining);
                  return (
                      <Card key={session.id} className={cn(
                          "min-w-[280px] sm:min-w-[300px] snap-center flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300",
                          isSessionPast && "opacity-70 bg-muted/30",
                          isSelected ? 'ring-2 ring-primary border-primary' : ''
                      )}>
                          <CardHeader className="p-3">
                              <div className="flex justify-between items-center">
                                  <CardTitle className="text-md font-headline">{getTeamName(session.teamId)}</CardTitle>
                                  {isSessionPast && <Badge variant="outline">Finalizado</Badge>}
                              </div>
                              <CardDescription className="text-xs pt-1">{session.description || 'Sesión de entrenamiento'}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-1 text-xs flex-grow">
                              <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /><span>{format(new Date(session.date as Date), "EEEE, dd MMM yyyy", { locale: es })}</span></div>
                              <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span>{session.time} {session.durationMinutes ? `(${session.durationMinutes} min)`: ''}</span></div>
                              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span>{session.location || 'Por definir'}</span></div>
                              {session.tasks && session.tasks.length > 0 && (
                                  <div className="flex items-center gap-2 text-muted-foreground pt-1">
                                      <ListChecksIcon className="h-4 w-4" />
                                      <span>{session.tasks.length} tarea{session.tasks.length > 1 ? 's' : ''} planificada{session.tasks.length > 1 ? 's' : ''}</span>
                                  </div>
                              )}
                              {session.coachNotes && (
                                  <div className="flex items-start gap-2 text-muted-foreground pt-1">
                                      <NotebookPen className="h-4 w-4 mt-0.5 shrink-0" />
                                      <p className="text-xs italic">Nota: {session.coachNotes.substring(0,50)}{session.coachNotes.length > 50 ? '...' : ''}</p>
                                  </div>
                              )}
                          </CardContent>
                          <CardFooter className="p-2 border-t flex flex-col sm:flex-row gap-2">
                              <Button variant="outline" className="w-full sm:flex-1" size="sm" onClick={() => openTrainingAttendanceDialog(session)}><ListChecksIcon className="mr-2 h-4 w-4" /> Asistencia</Button>
                              <Button variant="secondary" className="w-full sm:w-auto" size="sm" onClick={() => openEditSessionDialog(session)}><Edit3 className="mr-2 h-4 w-4" /> Editar</Button>
                          </CardFooter>
                      </Card>
                  );
              })}
            </div>
            <Button variant="outline" size="icon" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('left')}><ChevronLeft className="h-4 w-4"/></Button>
            <Button variant="outline" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full" onClick={() => scrollCarousel('right')}><ChevronRight className="h-4 w-4"/></Button>
        </div>
      ) : (
          <div className="rounded-md border shadow-sm">
              <Table>
                  <TableHeader><TableRow><TableHead>Equipo</TableHead><TableHead className="hidden sm:table-cell">Fecha</TableHead><TableHead className="hidden md:table-cell">Hora</TableHead><TableHead className="hidden lg:table-cell">Lugar</TableHead><TableHead className="text-center">Tareas</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                      {filteredTrainingSessions.map((session) => {
                          const isSessionPast = isPast(new Date(session.date as Date));
                          return (
                          <TableRow key={session.id} className={cn("h-14", isSessionPast && "opacity-70")}>
                              <TableCell className="py-1 px-4 font-semibold">
                                  {getTeamName(session.teamId)}
                                  {isSessionPast && <Badge variant="outline" className="ml-2 font-normal">Finalizado</Badge>}
                              </TableCell>
                              <TableCell className="py-1 px-4 hidden sm:table-cell">{format(new Date(session.date as Date), "dd MMM yyyy", { locale: es })}</TableCell>
                              <TableCell className="py-1 px-4 hidden md:table-cell">{session.time} {session.durationMinutes ? `(${session.durationMinutes} min)` : ''}</TableCell>
                              <TableCell className="py-1 px-4 hidden lg:table-cell">{session.location || 'Por definir'}</TableCell>
                              <TableCell className="py-1 px-4 text-center">{session.tasks?.length || 0}</TableCell>
                              <TableCell className="py-1 px-4 text-right">
                                  <div className="flex gap-1 justify-end">
                                      <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                   <Button variant="outline" size="sm" onClick={() => openTrainingAttendanceDialog(session)}>
                                                      <ListChecksIcon className="mr-1 h-3.5 w-3.5 sm:mr-2" /><span className="hidden sm:inline">Asistencia</span>
                                                  </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p>Ver detalles y gestionar asistencia.</p>
                                              </TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                       <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                   <Button variant="ghost" size="icon" onClick={() => openEditSessionDialog(session)}>
                                                      <Edit3 className="h-4 w-4" />
                                                  </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p>Editar detalles de la sesión.</p>
                                              </TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                       <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteSessionRequest(session)}>
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p>Eliminar sesión.</p>
                                              </TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                  </div>
                              </TableCell>
                          </TableRow>
                      )})}
                  </TableBody>
              </Table>
          </div>
      )}
    
    <ModernDialog
      isOpen={!!selectedSessionForAttendance}
      onClose={handleAttendanceDialogClose}
      title={`Detalles y Asistencia - ${getTeamName(selectedSessionForAttendance?.teamId || '')}`}
      icon={ListChecksIcon}
      size="2xl"
      type="info"
      headerActions={attendanceDialogHeaderActions}
    >
      <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-4 border-b shrink-0">
              <p className="text-center font-semibold text-muted-foreground">
                  {selectedSessionForAttendance && format(new Date(selectedSessionForAttendance.date as Date), "EEEE, dd MMM yyyy", { locale: es })} - {selectedSessionForAttendance?.time}
              </p>
          </div>
           <Tabs defaultValue="attendance" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 shrink-0 rounded-none border-b px-4">
                  <TabsTrigger value="attendance">Registro de Asistencia</TabsTrigger>
                  <TabsTrigger value="tasks">Tareas del Entrenamiento</TabsTrigger>
              </TabsList>
              <TabsContent value="attendance" className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                      <div className="p-4 sm:p-6 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary"/>
                                    <CardTitle className="text-lg font-semibold">Registro de Asistencia</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                            {displayedPlayersForAttendance.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No hay jugadores en este equipo.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {displayedPlayersForAttendance.map(player => {
                                 const playerData = currentTrainingAttendanceData[player.id];
                                 const isJustified = playerData?.justified || false;
                                return (
                                <Card key={player.id} className="p-3 bg-muted/30 shadow-sm">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-12 w-12 rounded-md border">
                                        <AvatarImage src={player.avatarUrl || `https://placehold.co/48x48.png`} alt={player.name} data-ai-hint="player avatar"/>
                                        <AvatarFallback className="rounded-md text-lg">{player.nickname?.[0] || player.name?.[0]}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 space-y-0.5">
                                        <p className="font-semibold text-base leading-tight">{player.nickname || player.name}</p>
                                        <p className="text-sm text-muted-foreground">{player.position}</p>
                                      </div>
                                      <StarRating 
                                        value={currentTrainingAttendanceData[player.id]?.rating || 0} 
                                        onValueChange={(rating) => handleRatingChange(player.id, rating)}
                                        readOnly={playerData?.status === 'Ausente'}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1">
                                            {attendanceOptions.map(({ status, icon: Icon }) => (
                                                <TooltipProvider key={status}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="icon"
                                                                variant={playerData?.status === status ? 'default' : 'ghost'}
                                                                className={cn("h-8 w-8", playerData?.status === status && getActiveButtonClass(status))}
                                                                onClick={() => handleAttendanceStatusChange(player.id, status)}
                                                            >
                                                                <Icon className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{status}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                        </div>
                                        <div className="flex items-center space-x-2 pl-2 border-l">
                                            <Checkbox
                                                id={`justified-${player.id}`}
                                                checked={isJustified}
                                                onCheckedChange={(checked) => handleJustifiedChange(player.id, !!checked)}
                                            />
                                            <Label htmlFor={`justified-${player.id}`} className="text-xs font-medium cursor-pointer">
                                                Justificado
                                            </Label>
                                        </div>
                                    </div>
                                  </div>
                                </Card>
                              )})}
                              </div>
                            )}
                            </CardContent>
                        </Card>
                    </div>
                  </ScrollArea>
              </TabsContent>
              <TabsContent value="tasks" className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                      <div className="p-4 sm:p-6 space-y-6">
                            {selectedSessionForAttendance?.coachNotes && (
                            <Card className="shadow-sm">
                                <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><NotebookPen className="h-5 w-5 text-primary"/>Notas del Entrenador</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedSessionForAttendance.coachNotes}</p></CardContent>
                            </Card>
                            )}
                            {sessionDetailsTasks.length > 0 && (
                            <Card className="shadow-sm">
                                <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><ListChecksIcon className="h-5 w-5 text-primary"/>Tareas del Entrenamiento</CardTitle></CardHeader>
                                <CardContent className="space-y-3 pl-6">
                                {sessionDetailsTasks.map((task, index) => (
                                    <div key={task.id || `task-${index}`} className="pb-3 border-b border-dashed last:border-b-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                        <p className="font-medium text-sm">{index + 1}. {task.name}</p>
                                        {task.category && <Badge variant="outline" className="text-xs my-0.5">{task.category}</Badge>}
                                        </div>
                                    </div>
                                    {task.durationMinutes && <p className="text-xs text-muted-foreground">Duración: {selectedSessionForAttendance?.tasks?.find(t => t.drillId === task.id)?.durationMinutes || task.durationMinutes} min</p>}
                                    {task.description && <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground mt-1"><ReactMarkdown>{task.description}</ReactMarkdown></div>}
                                    {task.imageUrl && (
                                        <div className="mt-2 rounded border overflow-hidden max-w-xs shadow-sm">
                                            <Image src={task.imageUrl} alt={`Diagrama de ${task.name}`} width={300} height={200} className="w-full h-auto object-contain" data-ai-hint="exercise diagram" />
                                        </div>
                                    )}
                                    </div>
                                ))}
                                </CardContent>
                            </Card>
                            )}
                        </div>
                   </ScrollArea>
               </TabsContent>
            </Tabs>
      </div>
    </ModernDialog>
    
    <ModernDialog
      isOpen={!!sessionToDelete}
      onClose={() => setSessionToDelete(null)}
      title="¿Eliminar Sesión de Entrenamiento?"
      icon={Trash2}
      type="error"
      size="md"
    >
      <div className="p-4 space-y-4 px-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Estás a punto de eliminar la sesión de {getTeamName(sessionToDelete?.teamId || '')} del {sessionToDelete && format(new Date(sessionToDelete.date as Date), "dd/MM/yyyy", { locale: es })}.
          Esta acción no se puede deshacer y también eliminará todos los registros de asistencia asociados.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSessionToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDeleteSession}>Eliminar Sesión</Button>
        </div>
      </div>
    </ModernDialog>
    
    <Dialog open={isAttendanceSnapshotOpen} onOpenChange={setIsAttendanceSnapshotOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                 <DialogTitle>Imagen de la Asistencia</DialogTitle>
                 <DialogDescription>
                     Vista previa de la lista de asistencia para descargar como imagen.
                 </DialogDescription>
            </DialogHeader>
             <div className="p-4 space-y-4 flex-1 flex flex-col min-h-0">
                 <div className="flex justify-center gap-2">
                    <Button variant={snapshotFilter === 'Presente' ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapshotFilter('Presente')}>Presentes</Button>
                    <Button variant={snapshotFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapshotFilter('all')}>Todos</Button>
                  </div>
                 <ScrollArea className="border rounded-lg bg-muted/20 flex-1">
                     <div ref={snapshotRef} className="p-4 bg-white dark:bg-card">
                         <div className="text-center mb-4 text-black">
                            <h3 className="text-lg font-bold font-headline">Asistencia a Entrenamiento</h3>
                            <p className="text-sm text-muted-foreground">{getTeamName(selectedSessionForAttendance?.teamId || '')}</p>
                            <p className="text-xs text-muted-foreground">{selectedSessionForAttendance && format(new Date(selectedSessionForAttendance.date as Date), "EEEE, dd MMMM yyyy", { locale: es })}</p>
                         </div>
                         <div className="flex justify-around items-center text-center p-2 mb-4 border-y text-xs font-medium text-black">
                            <p>Presentes: <span className="font-bold text-green-600">{attendanceSummary.presente}</span></p>
                            <p>Ausentes: <span className="font-bold text-red-600">{attendanceSummary.ausente}</span></p>
                            <p>Tarde: <span className="font-bold text-blue-600">{attendanceSummary.tarde}</span></p>
                            <p>Justificados: <span className="font-bold text-yellow-600">{attendanceSummary.justificado}</span></p>
                         </div>
                         <ul className="grid grid-cols-1 gap-2">
                            {snapshotPlayers.map(player => {
                                const attendance = currentTrainingAttendanceData[player.id];
                                if (!attendance) return null;
                                const isPresent = attendance.status === 'Presente';
                                const isAbsent = attendance.status === 'Ausente';
                                const isLate = attendance.status === 'Tarde';
                                return (
                                <li key={player.id} className={cn("flex items-center justify-between py-2 px-2 rounded-md text-black", isPresent && "bg-green-500/10", isAbsent && "bg-red-500/10", isLate && "bg-blue-500/10")}>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border rounded-md"><AvatarImage src={player.avatarUrl} alt={player.name} data-ai-hint="player avatar"/><AvatarFallback className="rounded-md">{player.name[0]}</AvatarFallback></Avatar>
                                    <span className="font-medium text-sm">{player.nickname || player.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {attendance.rating > 0 && <StarRating value={attendance.rating} onValueChange={()=>{}} readOnly={true} size="sm" />}
                                   {attendance.justified && (
                                    <div className="h-5 w-5 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center text-xs font-bold border border-yellow-600">J</div>
                                  )}
                                </div>
                                </li>
                            )})}
                         </ul>
                     </div>
                 </ScrollArea>
             </div>
             <DialogFooter>
                 <Button variant="outline" onClick={() => setIsAttendanceSnapshotOpen(false)}>Cerrar</Button>
                 <Button onClick={handleDownloadSnapshot}><Download className="mr-2 h-4 w-4"/>Descargar JPG</Button>
             </DialogFooter>
        </DialogContent>
    </Dialog>


    <ModernDialog
        isOpen={!!taskToDeleteFromDetails}
        onClose={() => setTaskToDeleteFromDetails(null)}
        title="¿Eliminar Tarea de la Sesión?"
        icon={Trash2}
        type="error"
        size="md"
    >
        {taskToDeleteFromDetails && (
          <div className="p-4 space-y-4 px-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                  Estás a punto de eliminar una tarea de la sesión de entrenamiento. Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setTaskToDeleteFromDetails(null)}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDeleteTaskFromDetails}>Eliminar Tarea</Button>
              </div>
          </div>
        )}
    </ModernDialog>
    </div>
  );
}
