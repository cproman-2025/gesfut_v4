

'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useEffect, Suspense, type ChangeEvent, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, addDoc, query, where, orderBy, serverTimestamp, deleteField as firestoreDeleteField, doc, getDoc
} from 'firebase/firestore';
import type { Player, Team, Club, PlayerProfileField } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Search, Settings, ArrowRight, Edit3, Trash2, Users, ArrowLeft, Calendar as CalendarIconLucide, Sparkles, LayoutGrid, List as ListIcon, UploadCloud, Filter, Link as LinkIconLucide, X as XIcon, ArrowUp, ArrowDown, ArrowDownUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid, differenceInYears, formatISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { defaultPlayerProfileFields } from '@/lib/placeholder-data';
import { usePageHeader } from '@/contexts/page-header-context';
import { useAuth } from '@/contexts/auth-context';
import { ModernDialog } from '@/components/ui/modern-dialog';


const MAX_AVATAR_URL_LENGTH = 700000; 

const initialNewPlayerData: Record<string, any> = {
  firstName: '',
  lastName: '',
  nickname: '',
  teamId: '',
  position: '',
  dateOfBirthDate: undefined,
  jerseyNumber: undefined,
  avatarUrl: '',
  avatarFile: null,
};

const DATE_FORMAT_INPUT = "dd/MM/yyyy";

function PlayersPageComponent() {
  const searchParams = useSearchParams();
  const teamIdQueryParam = searchParams.get('teamId');
  const { userProfile } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]); 
  const [profileFieldsConfig, setProfileFieldsConfig] = useState<PlayerProfileField[]>(defaultPlayerProfileFields);
  const [isLoading, setIsLoading] = useState(true);
  
  const [teamFilter, setTeamFilter] = useState<string>(teamIdQueryParam || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const { toast } = useToast();

  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [newPlayerData, setNewPlayerData] = useState<Record<string, any>>(initialNewPlayerData);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [avatarPreviewDialog, setAvatarPreviewDialog] = useState<string | null>(null);
  const newPlayerFileInputRef = useRef<HTMLInputElement>(null);
  const [showNewPlayerAvatarUrlInput, setShowNewPlayerAvatarUrlInput] = useState(false);
  
  const [dateInputValues, setDateInputValues] = useState<Record<string, string>>({});


  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const { setHeader } = usePageHeader();

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const configDocRef = doc(db, "appSettings", "playerProfileFields");
      const configDocSnap = await getDoc(configDocRef);
      if (configDocSnap.exists() && configDocSnap.data().fields) {
        setProfileFieldsConfig(configDocSnap.data().fields);
      } else {
        setProfileFieldsConfig(defaultPlayerProfileFields);
      }
      
      const clubsCollection = collection(db, "clubs");
      const clubsQuery = query(clubsCollection, orderBy("name"));
      const clubsSnapshot = await getDocs(clubsQuery);
      const clubsData = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
      setClubs(clubsData);

      const teamsCollection = collection(db, "teams");
      const teamsSnapshot = await getDocs(query(teamsCollection, orderBy("name")));
      const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);

      const playersCollection = collection(db, "players");
      const playersSnapshot = await getDocs(query(playersCollection, orderBy("name")));
      const playersData = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);

    } catch (error) {
      console.error("Error fetching page data:", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos necesarios.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  useEffect(() => {
    if (isAddPlayerDialogOpen) {
        const initialDates: Record<string, string> = {};
        profileFieldsConfig.filter(f => f.type === 'date' && f.isActive && !f.isDefault).forEach(field => {
            initialDates[field.key] = newPlayerData[field.key] instanceof Date ? format(newPlayerData[field.key], DATE_FORMAT_INPUT) : '';
        });
        initialDates['dateOfBirthDate'] = newPlayerData.dateOfBirthDate instanceof Date ? format(newPlayerData.dateOfBirthDate, DATE_FORMAT_INPUT) : '';
        setDateInputValues(initialDates);
    }
  }, [isAddPlayerDialogOpen, newPlayerData, profileFieldsConfig]);


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


  const filteredAndSortedPlayers = useMemo(() => {
    return players
      .filter((player) => {
        const matchesTeam = teamFilter === 'all' 
            ? (teamsForFilter.some(t => t.id === player.teamId) || userProfile?.role === 'Administrador' || userProfile?.role === 'Directivo Club')
            : player.teamId === teamFilter;
        const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPosition = positionFilter === 'all' || player.position.toLowerCase() === positionFilter.toLowerCase();
        return matchesTeam && matchesSearch && matchesPosition;
      })
      .sort((a, b) => {
        const numA = a.jerseyNumber ?? 999;
        const numB = b.jerseyNumber ?? 999;
        if (numA !== numB) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [players, teamFilter, searchTerm, positionFilter, teamsForFilter, userProfile]);

  const getTeamName = (teamId: string | undefined): string | null => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId)?.name || null;
  }

  const currentTeamName = getTeamName(teamFilter);
  const pageTitle = currentTeamName ? `Jugadores de ${currentTeamName}` : "Gestión de Jugadores";
  const pageDescription = currentTeamName ? `Listado de jugadores del equipo ${currentTeamName}.` : "Visualiza, edita y administra los perfiles de los jugadores.";

  const headerAction = useMemo(() => (
    <div className="flex gap-2 flex-wrap items-center">
      <div className="flex items-center gap-1">
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('card')}><LayoutGrid className="h-4 w-4"/></Button>
          </TooltipTrigger><TooltipContent><p>Vista de Tarjetas</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><ListIcon className="h-4 w-4"/></Button>
          </TooltipTrigger><TooltipContent><p>Vista de Lista</p></TooltipContent></Tooltip></TooltipProvider>
      </div>
      <Separator orientation="vertical" className="h-6 hidden sm:block" />
      <div className="flex items-center gap-1">
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Link href="/players/configure">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
        </TooltipTrigger><TooltipContent><p>Configurar Campos del Perfil</p></TooltipContent></Tooltip></TooltipProvider>
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button onClick={() => setIsAddPlayerDialogOpen(true)} size="icon" className="h-8 w-8">
              <PlusCircle className="h-4 w-4" />
            </Button>
        </TooltipTrigger><TooltipContent><p>Añadir Jugador</p></TooltipContent></Tooltip></TooltipProvider>
      </div>
    </div>
  ), [viewMode]); 

  useEffect(() => {
    setHeader({
      title: pageTitle,
      description: pageDescription,
      icon: Users,
      action: headerAction,
    });
  }, [setHeader, pageTitle, pageDescription, headerAction]);



  const handleNewPlayerInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const fieldConfig = profileFieldsConfig.find(f => f.key === name);

    if (name === "avatarUrl") {
      setNewPlayerData(prev => ({ ...prev, avatarUrl: value, avatarFile: null }));
      setAvatarPreviewDialog(value.trim() || null); 
      if (newPlayerFileInputRef.current) newPlayerFileInputRef.current.value = "";
    } else if (fieldConfig?.type === 'date') {
      setDateInputValues(prev => ({ ...prev, [name]: value }));
    } else {
      setNewPlayerData(prev => ({ ...prev, [name]: name === 'jerseyNumber' ? (value ? parseInt(value, 10) : undefined) : value }));
    }
  };

  const handleDateInputBlur = (fieldName: string, inputValue: string) => {
    if (!inputValue.trim()) {
      setNewPlayerData(prev => ({ ...prev, [fieldName]: undefined }));
      setDateInputValues(prev => ({ ...prev, [fieldName]: '' }));
      return;
    }
    try {
      const parsedDate = parse(inputValue, DATE_FORMAT_INPUT, new Date());
      if (isValid(parsedDate)) {
        setNewPlayerData(prev => ({ ...prev, [fieldName]: parsedDate }));
        setDateInputValues(prev => ({ ...prev, [fieldName]: format(parsedDate, DATE_FORMAT_INPUT) }));
      } else {
        const label = fieldName === 'dateOfBirthDate' ? 'Fecha de Nacimiento' : profileFieldsConfig.find(f => f.key === fieldName)?.label || fieldName;
        toast({ title: `Fecha Inválida para ${label}`, description: `El formato debe ser ${DATE_FORMAT_INPUT}.`, variant: "destructive" });
      }
    } catch (error) {
       const label = fieldName === 'dateOfBirthDate' ? 'Fecha de Nacimiento' : profileFieldsConfig.find(f => f.key === fieldName)?.label || fieldName;
       toast({ title: "Error al Parsear Fecha", description: `Hubo un problema con el formato de fecha para ${label}.`, variant: "destructive" });
    }
  };

  const handleNewPlayerSelectChange = (name: string, value: string) => {
    setNewPlayerData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewPlayerDateChange = (date: Date | undefined, fieldName: string) => {
    setNewPlayerData(prev => ({ ...prev, [fieldName]: date }));
    setDateInputValues(prev => ({ ...prev, [fieldName]: date ? format(date, DATE_FORMAT_INPUT) : '' }));
  };

  const handleNewPlayerAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewPlayerData(prev => ({...prev, avatarFile: file, avatarUrl: ''})); 
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreviewDialog(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowNewPlayerAvatarUrlInput(false);
    }
  };

  const triggerNewPlayerFileInput = () => {
    newPlayerFileInputRef.current?.click();
  };

  const removeNewPlayerAvatar = () => {
    setNewPlayerData(prev => ({...prev, avatarFile: null, avatarUrl: ''}));
    setAvatarPreviewDialog(null);
    if (newPlayerFileInputRef.current) newPlayerFileInputRef.current.value = '';
    setShowNewPlayerAvatarUrlInput(false);
  };

  const toggleNewPlayerAvatarUrlInput = () => {
    setShowNewPlayerAvatarUrlInput(prev => {
        const newShowState = !prev;
        if (newShowState && newPlayerData.avatarFile) { 
            setAvatarPreviewDialog(null);
            setNewPlayerData(prevData => ({...prevData, avatarFile: null, avatarUrl: ''}));
            if (newPlayerFileInputRef.current) newPlayerFileInputRef.current.value = "";
        }
        return newShowState;
    });
  };

  const handleGenerateAvatarForNewPlayer = async () => {
    const fullName = `${newPlayerData.firstName || ''} ${newPlayerData.lastName || ''}`.trim();
    if (!fullName) {
      toast({ title: "Nombre Requerido", description: "Introduce un nombre y apellidos para generar el avatar.", variant: "destructive" });
      return;
    }
    setIsGeneratingAvatar(true);
    toast({ title: "Generando Avatar", description: "Creando un avatar..." });
    try {
      const result = await generateAvatar({ promptText: fullName, entityType: 'player' });
      
      if (result.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande. Se usará uno por defecto.", variant: "default", duration: 5000 });
        const fallbackUrl = `https://placehold.co/80x80.png?text=${fullName[0].toUpperCase()}`;
        setNewPlayerData(prev => ({ ...prev, avatarUrl: fallbackUrl, avatarFile: null }));
        setAvatarPreviewDialog(fallbackUrl);
      } else {
        setNewPlayerData(prev => ({ ...prev, avatarUrl: result.imageDataUri, avatarFile: null }));
        setAvatarPreviewDialog(result.imageDataUri);
        toast({ title: "Avatar Generado", description: "El avatar se ha creado con éxito." });
      }
      setShowNewPlayerAvatarUrlInput(false);
      if (newPlayerFileInputRef.current) newPlayerFileInputRef.current.value = "";
    } catch (error) {
      console.error("Error generating avatar for new player:", error);
      toast({ title: "Error de Avatar", description: "No se pudo generar el avatar. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleAddPlayerSubmit = async () => {
    const fullName = `${newPlayerData.firstName || ''} ${newPlayerData.lastName || ''}`.trim();
    if (!fullName || !newPlayerData.teamId || !newPlayerData.position || !newPlayerData.dateOfBirthDate) {
      toast({ title: "Campos Incompletos", description: "Nombre, apellidos, equipo, posición y fecha de nacimiento son obligatorios.", variant: "destructive" });
      return;
    }

    let playerAvatarUrl = newPlayerData.avatarUrl || undefined;

    if (newPlayerData.avatarFile && avatarPreviewDialog) {
      playerAvatarUrl = avatarPreviewDialog;
    } else if (showNewPlayerAvatarUrlInput && newPlayerData.avatarUrl?.trim()) {
      playerAvatarUrl = newPlayerData.avatarUrl.trim();
    } else if (!playerAvatarUrl && fullName) {
      setIsGeneratingAvatar(true);
      toast({ title: "Generando Avatar", description: "Creando un avatar único para el jugador..." });
      try {
        const avatarResult = await generateAvatar({ promptText: fullName, entityType: 'player' });
        if (avatarResult.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
            toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande. Se usará uno por defecto.", variant: "default", duration: 5000 });
            playerAvatarUrl = `https://placehold.co/80x80.png?text=${fullName[0].toUpperCase()}`;
        } else {
            playerAvatarUrl = avatarResult.imageDataUri;
            toast({ title: "Avatar Generado", description: "El avatar se ha creado con éxito." });
        }
      } catch (error) {
        console.error("Error generando avatar para jugador:", error);
        toast({ title: "Error de Avatar", description: "No se pudo generar el avatar. Se usará uno por defecto.", variant: "destructive" });
        playerAvatarUrl = `https://placehold.co/80x80.png?text=${fullName[0].toUpperCase()}`;
      } finally {
        setIsGeneratingAvatar(false);
      }
    } else if (!playerAvatarUrl) {
      playerAvatarUrl = `https://placehold.co/80x80.png?text=${fullName[0].toUpperCase()}`;
    }

    if (playerAvatarUrl && playerAvatarUrl.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar es demasiado grande para guardarlo. Se usará uno por defecto.", variant: "default", duration: 5000 });
        playerAvatarUrl = `https://placehold.co/80x80.png?text=${fullName[0].toUpperCase()}`;
    }

    const selectedTeam = teams.find(t => t.id === newPlayerData.teamId);

    const playerDocData: Record<string, any> = { 
      name: fullName,
      nickname: (newPlayerData.nickname && newPlayerData.nickname.trim() !== '') ? newPlayerData.nickname.trim() : null,
      teamId: newPlayerData.teamId!,
      position: newPlayerData.position!,
      dateOfBirth: formatISO(newPlayerData.dateOfBirthDate!, { representation: 'date' }),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (selectedTeam?.clubId) {
      playerDocData.clubId = selectedTeam.clubId;
    }
    if (playerAvatarUrl) {
      playerDocData.avatarUrl = playerAvatarUrl;
    }
    if (newPlayerData.jerseyNumber !== undefined && newPlayerData.jerseyNumber !== null && String(newPlayerData.jerseyNumber).trim() !== '') {
      playerDocData.jerseyNumber = parseInt(String(newPlayerData.jerseyNumber), 10);
    }
    
    profileFieldsConfig.forEach(field => {
      if (field.isActive && !field.isDefault) { 
        const value = newPlayerData[field.key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          if (field.type === 'date' && value instanceof Date) {
            playerDocData[field.key] = formatISO(value, { representation: 'date' });
          } else if (field.type === 'number') {
            const numValue = parseFloat(String(value));
            if (!isNaN(numValue)) playerDocData[field.key] = numValue;
          } else {
            playerDocData[field.key] = value;
          }
        }
      }
    });
    
    try {
      await addDoc(collection(db, "players"), playerDocData);
      toast({ title: "Jugador Añadido", description: `${playerDocData.name} ha sido añadido al sistema.` });
      fetchPageData(); 
      setIsAddPlayerDialogOpen(false);
      setNewPlayerData(initialNewPlayerData);
      setAvatarPreviewDialog(null);
      setDateInputValues({});
      setShowNewPlayerAvatarUrlInput(false);
    } catch (error) {
        console.error("Error adding player to Firestore: ", error);
        toast({ title: "Error de Base de Datos", description: "No se pudo añadir el jugador. " + (error as Error).message, variant: "destructive" });
    }
  };

  const dynamicFieldsBySection = profileFieldsConfig.reduce((acc, field) => {
    if (field.isActive && !field.isDefault) { 
        (acc[field.section] = acc[field.section] || []).push(field);
    }
    return acc;
  }, {} as Record<string, PlayerProfileField[]>);


  if (isLoading) {
    return <div className="p-4 text-center">Cargando jugadores...</div>;
  }

  return (
    <div className="space-y-6">
      <ModernDialog 
        isOpen={isAddPlayerDialogOpen} 
        onClose={() => {
          setIsAddPlayerDialogOpen(false);
          setNewPlayerData(initialNewPlayerData);
          setAvatarPreviewDialog(null);
          setDateInputValues({});
          setShowNewPlayerAvatarUrlInput(false);
        }}
        title="Añadir Nuevo Jugador"
        size="lg"
      >
        <ScrollArea className="max-h-[70vh] -mr-3 pr-3">
            <div className="space-y-4 py-4 px-4">
              {/* Avatar Section */}
              <div className="space-y-2">
                  <Label>Avatar del Jugador</Label>
                  <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border rounded-md">
                          <AvatarImage src={avatarPreviewDialog || `https://placehold.co/80x80.png`} alt="Nuevo Avatar Jugador" data-ai-hint="player avatar"/>
                          <AvatarFallback className="rounded-md text-2xl">{newPlayerData.firstName?.[0]?.toUpperCase() || 'J'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2 flex-1">
                          <Button type="button" variant="outline" size="sm" onClick={triggerNewPlayerFileInput}>
                              <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                          </Button>
                          <input type="file" ref={newPlayerFileInputRef} onChange={handleNewPlayerAvatarFileChange} accept="image/*" className="hidden"/>
                          <Button type="button" variant="outline" size="sm" onClick={toggleNewPlayerAvatarUrlInput}>
                              <LinkIconLucide className="mr-2 h-4 w-4" /> {showNewPlayerAvatarUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                          </Button>
                      </div>
                  </div>
                  {showNewPlayerAvatarUrlInput && (
                      <Input
                          name="avatarUrl"
                          value={newPlayerData.avatarUrl || ''}
                          onChange={handleNewPlayerInputChange}
                          placeholder="Pega una URL de imagen"
                          className="h-9 text-sm mt-2"
                      />
                  )}
                  {(newPlayerData.firstName?.trim() || newPlayerData.lastName?.trim()) && (
                    <Button type="button" onClick={handleGenerateAvatarForNewPlayer} variant="outline" size="sm" className="w-full mt-2" disabled={isGeneratingAvatar}>
                      <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingAvatar && "animate-spin")}/> {isGeneratingAvatar ? "Generando..." : "Generar Avatar con IA"}
                    </Button>
                  )}
                  {avatarPreviewDialog && (
                      <Button type="button" variant="link" size="sm" onClick={removeNewPlayerAvatar} className="text-xs text-destructive p-0 h-auto">
                          <XIcon className="mr-1 h-3 w-3"/> Quitar avatar
                      </Button>
                  )}
              </div>
              <Separator/>
              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="teamId">Equipo*</Label>
                    <Select name="teamId" value={newPlayerData.teamId || ''} onValueChange={(value) => handleNewPlayerSelectChange('teamId', value)}>
                        <SelectTrigger id="teamId"><SelectValue placeholder="Selecciona un equipo" /></SelectTrigger>
                        <SelectContent>{teams.map(team => (<SelectItem key={team.id} value={team.id}>{team.name} ({clubs.find(c => c.id === team.clubId)?.name || 'Club desc.'})</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                        <Label htmlFor="firstName">Nombre*</Label>
                        <Input id="firstName" name="firstName" value={newPlayerData.firstName || ''} onChange={handleNewPlayerInputChange} placeholder="Nombre" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="lastName">Apellidos*</Label>
                        <Input id="lastName" name="lastName" value={newPlayerData.lastName || ''} onChange={handleNewPlayerInputChange} placeholder="Apellidos" />
                    </div>
                     <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="nickname">Apodo (para pizarra)</Label>
                        <Input id="nickname" name="nickname" value={newPlayerData.nickname || ''} onChange={handleNewPlayerInputChange} placeholder="Apodo (opcional)"/>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="dateOfBirthDate">F. Nacimiento*</Label>
                        <Input
                            id="dateOfBirthDate"
                            name="dateOfBirthDate"
                            type="text"
                            value={dateInputValues['dateOfBirthDate'] || ''}
                            onChange={(e) => setDateInputValues(prev => ({...prev, dateOfBirthDate: e.target.value}))}
                            onBlur={() => handleDateInputBlur('dateOfBirthDate', dateInputValues['dateOfBirthDate'])}
                            placeholder={DATE_FORMAT_INPUT}
                        />
                    </div>
                   <div className="space-y-1">
                       <Label htmlFor="jerseyNumber">Dorsal</Label>
                       <Input id="jerseyNumber" name="jerseyNumber" type="number" value={newPlayerData.jerseyNumber === undefined ? '' : newPlayerData.jerseyNumber} onChange={handleNewPlayerInputChange} placeholder="Dorsal"/>
                   </div>
                   <div className="space-y-1 md:col-span-2">
                       <Label htmlFor="position">Posición*</Label>
                       <Select name="position" value={newPlayerData.position || ''} onValueChange={(value) => handleNewPlayerSelectChange('position', value)}>
                           <SelectTrigger id="position"><SelectValue placeholder="Selecciona posición" /></SelectTrigger>
                           <SelectContent>
                               <SelectItem value="Portero">Portero</SelectItem>
                               <SelectItem value="Defensa">Defensa</SelectItem>
                               <SelectItem value="Centrocampista">Centrocampista</SelectItem>
                               <SelectItem value="Delantero">Delantero</SelectItem>
                           </SelectContent>
                       </Select>
                   </div>
                </div>

                {Object.entries(dynamicFieldsBySection).map(([section, fields]) => (
                    <div key={section} className="space-y-4 pt-4">
                        <Separator />
                        <h4 className="font-semibold text-primary border-b pb-1 pt-2">{section}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fields.map((field) => (
                                <div key={field.key} className={cn("space-y-1", field.type === 'textarea' && "md:col-span-2")}>
                                    <Label htmlFor={`new-player-${field.key}`}>{field.label}</Label>
                                    {field.type === 'text' && <Input id={`new-player-${field.key}`} name={field.key} value={newPlayerData[field.key] || ''} onChange={handleNewPlayerInputChange} />}
                                    {field.type === 'textarea' && <Textarea id={`new-player-${field.key}`} name={field.key} value={newPlayerData[field.key] || ''} onChange={handleNewPlayerInputChange} rows={2} />}
                                    {field.type === 'number' && <Input id={`new-player-${field.key}`} name={field.key} type="number" value={newPlayerData[field.key] || ''} onChange={handleNewPlayerInputChange} />}
                                    {field.type === 'date' && (
                                        <Input
                                            id={`new-player-${field.key}`}
                                            name={field.key}
                                            type="text"
                                            value={dateInputValues[field.key] || ''}
                                            onChange={(e) => setDateInputValues(prev => ({...prev, [field.key]: e.target.value}))}
                                            onBlur={() => handleDateInputBlur(field.key, dateInputValues[field.key])}
                                            placeholder={DATE_FORMAT_INPUT}
                                        />
                                    )}
                                    {field.type === 'select' && field.options && (
                                        <Select name={field.key} value={newPlayerData[field.key] || ''} onValueChange={(value) => handleNewPlayerSelectChange(field.key, value)}>
                                            <SelectTrigger id={`new-player-${field.key}`}><SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} /></SelectTrigger>
                                            <SelectContent>
                                                {field.options.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
              </div>
            </div>
          </ScrollArea>
           <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-0">
                <Button type="button" variant="secondary" onClick={() => { setIsAddPlayerDialogOpen(false); setNewPlayerData(initialNewPlayerData); setAvatarPreviewDialog(null); setDateInputValues({}); setShowNewPlayerAvatarUrlInput(false); }} disabled={isGeneratingAvatar}>Cancelar</Button>
                <Button type="button" onClick={handleAddPlayerSubmit} disabled={isGeneratingAvatar} className="btn-primary">
                {isGeneratingAvatar && <Sparkles className="mr-2 h-4 w-4 animate-spin" />}
                {isGeneratingAvatar ? "Guardando..." : "Guardar Jugador"}
                </Button>
            </div>
      </ModernDialog>
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto lg:flex-1">
              <div className="relative flex-1 w-full sm:min-w-[200px] sm:w-auto">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar jugador..." 
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
               <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por equipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Equipos</SelectItem>
                  {teamsForFilter.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Posición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Posiciones</SelectItem>
                  <SelectItem value="Delantero">Delantero</SelectItem>
                  <SelectItem value="Centrocampista">Centrocampista</SelectItem>
                  <SelectItem value="Defensa">Defensa</SelectItem>
                  <SelectItem value="Portero">Portero</SelectItem>
                </SelectContent>
              </Select>
              {(teamFilter !== 'all' || searchTerm || positionFilter !== 'all') && (
                  <Button 
                      variant="ghost" 
                      onClick={() => { 
                          setSearchTerm(''); 
                          setPositionFilter('all');
                          setTeamFilter('all');
                      }} 
                      className="text-sm w-full sm:w-auto"
                  >
                      <Filter className="mr-2 h-4 w-4" /> Limpiar filtros
                  </Button>
              )}
            </div>
          </div>

          {isLoading && players.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Cargando jugadores...</p>
          ) : filteredAndSortedPlayers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay jugadores</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {teamFilter !== 'all' || searchTerm || positionFilter !== 'all'
                    ? "No se encontraron jugadores que coincidan con tu búsqueda/filtro." 
                    : "Empieza añadiendo un nuevo jugador."}
              </p>
               {teamFilter !== 'all' && (
                 <Button asChild variant="link" className="mt-4">
                    <Link href="/players">Ver todos los jugadores</Link>
                 </Button>
               )}
            </div>
          ) : viewMode === 'card' ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredAndSortedPlayers.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="group block h-full">
                  <Card className="h-full overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:border-primary bg-card/50 drop-shadow-md border border-transparent">
                    <div className="relative w-full aspect-[3/4]">
                        <Image
                          src={player.avatarUrl || "https://placehold.co/300x400.png"}
                          fill
                          className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                          alt={player.name}
                          data-ai-hint="player photo"
                        />
                         {player.jerseyNumber !== undefined && player.jerseyNumber !== null && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full shadow-lg border-2 border-white/50">
                            {player.jerseyNumber}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent p-2 flex flex-col justify-end">
                            <h3 className="text-sm font-bold text-white truncate">{player.nickname || player.name}</h3>
                            <p className="text-white/80 text-xs truncate">{player.position}</p>
                        </div>
                   </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredAndSortedPlayers.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`} className="group block">
                      <Card className="transition-all hover:shadow-md hover:border-primary/50">
                          <div className="flex items-center gap-4 p-2">
                              <div className="relative w-16 h-20 rounded-md overflow-hidden shrink-0">
                                <Image 
                                    src={player.avatarUrl || `https://placehold.co/64x80.png`} 
                                    alt={player.name} 
                                    fill
                                    className="object-cover object-top"
                                    data-ai-hint="player avatar"
                                />
                              </div>
                              <div className="flex-1 grid grid-cols-2 items-center gap-4">
                                <p className="font-semibold text-sm truncate col-span-2 sm:col-span-1">{player.name}</p>
                                <div className='hidden sm:block'>
                                  <p className="text-sm text-muted-foreground truncate">{player.position}</p>
                                  <p className="text-xs text-muted-foreground truncate">{getTeamName(player.teamId)}</p>
                                </div>
                              </div>
                              {player.jerseyNumber !== undefined && player.jerseyNumber !== null && (
                                <Badge variant="outline" className="justify-self-end">{player.jerseyNumber}</Badge>
                              )}
                          </div>
                      </Card>
                    </Link>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<div>Cargando jugadores...</div>}>
      <PlayersPageComponent />
    </Suspense>
  );
}
