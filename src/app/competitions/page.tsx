
'use client';

import { useState, useEffect, type ChangeEvent, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, orderBy, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, where, arrayUnion, arrayRemove, Timestamp,
  deleteField as firestoreDeleteField
} from 'firebase/firestore';
import {
  getActiveUserClub,
  placeholderDataVersion,
} from '@/lib/placeholder-data';
import type { LeagueCompetition, RivalTeam, Team, User, Club } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, Trophy, Users, MapPin, Eye, Shield, UsersRound, ListFilter, Search, LayoutGrid, List as ListIcon, UploadCloud, X, Sparkles, Link as LinkIconLucide } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { useAuth } from '@/contexts/auth-context';
import AuthGuard from '@/components/auth/auth-guard';
import { usePageHeader } from '@/contexts/page-header-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ModernDialog } from '@/components/ui/modern-dialog';

const MAX_LOGO_URL_LENGTH = 700000;

const initialNewCompetitionData: Partial<Omit<LeagueCompetition, 'id' | 'rivals' | 'createdAt' | 'updatedAt'>> & { dialogSelectedClubId?: string } = {
  name: '',
  assignedClubTeamId: '',
  dialogSelectedClubId: undefined,
};

const initialNewRivalData: Partial<Omit<RivalTeam, 'id'>> & { logoFile?: File | null } = {
  name: '',
  logoUrl: '',
  fieldLocation: '',
  logoFile: null,
};

function CompetitionsPageContent() {
  const { userProfile: currentUser, isLoading: authIsLoading } = useAuth();
  const [activeClub, setActiveClub] = useState<Club | undefined>(undefined);
  const { setHeader } = usePageHeader();

  const [allFirestoreTeams, setAllFirestoreTeams] = useState<Team[]>([]);
  const [allFirestoreClubs, setAllFirestoreClubs] = useState<Club[]>([]);

  const [firestoreCompetitions, setFirestoreCompetitions] = useState<LeagueCompetition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<LeagueCompetition | null>(null);
  const [clubTeams, setClubTeams] = useState<Team[]>([]);
  const { toast } = useToast();

  const [isCompetitionModalOpen, setIsCompetitionModalOpen] = useState(false);
  const [isEditingCompetition, setIsEditingCompetition] = useState(false);
  const [competitionFormData, setCompetitionFormData] = useState(initialNewCompetitionData);

  const [isRivalModalOpen, setIsRivalModalOpen] = useState(false);
  const [isEditingRival, setIsEditingRival] = useState(false);
  const [rivalFormData, setRivalFormData] = useState(initialNewRivalData);
  const [editingRivalOriginalId, setEditingRivalOriginalId] = useState<string | null>(null);
  const [rivalLogoPreview, setRivalLogoPreview] = useState<string | null>(null);
  const rivalFileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingRivalLogo, setIsGeneratingRivalLogo] = useState(false);
  const [showRivalUrlInput, setShowRivalUrlInput] = useState(false);

  const [rivalToDelete, setRivalToDelete] = useState<RivalTeam | null>(null);
  const [competitionToDelete, setCompetitionToDelete] = useState<LeagueCompetition | null>(null);
  const [rivalsViewMode, setRivalsViewMode] = useState<'list' | 'card'>('card');
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);

  const openNewCompetitionModal = useCallback(() => {
    setIsEditingCompetition(false);
    setCompetitionFormData({
      ...initialNewCompetitionData,
      dialogSelectedClubId: (currentUser?.role !== 'Administrador' && activeClub) ? activeClub.id : undefined
    });
    setIsCompetitionModalOpen(true);
  }, [currentUser, activeClub]);

  const headerAction = useMemo(() => (
    <Button onClick={openNewCompetitionModal} size="sm" className="px-2 sm:px-3">
      <PlusCircle className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Nueva Competición</span>
    </Button>
  ), [openNewCompetitionModal]);

  useEffect(() => {
    setHeader({
      title: 'Gestión de Competiciones',
      description: 'Define las competiciones en las que participan tus equipos y gestiona sus rivales.',
      icon: Trophy,
      action: headerAction,
    });
  }, [setHeader, headerAction]);

  const fetchCoreData = async () => {
    setIsLoadingPageData(true);
    try {
      const clubsSnap = await getDocs(query(collection(db, "clubs"), orderBy("name")));
      const loadedClubs = clubsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
      setAllFirestoreClubs(loadedClubs);

      const teamsSnap = await getDocs(query(collection(db, "teams"), orderBy("name")));
      const loadedTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setAllFirestoreTeams(loadedTeams);

      let userClub = activeClub;
      if (!userClub && currentUser) {
        userClub = await getActiveUserClub(currentUser.id);
      } else if (!userClub && !currentUser && !authIsLoading) {
        userClub = await getActiveUserClub(undefined);
      }
      setActiveClub(userClub);

      const competitionsCollectionRef = collection(db, "leagueCompetitions");
      const competitionsQuery = query(competitionsCollectionRef, orderBy("name"));
      const competitionsSnapshot = await getDocs(competitionsQuery);
      let fetchedCompetitions = competitionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeagueCompetition));

      if (currentUser?.role !== 'Administrador' && userClub) {
        const clubTeamIds = loadedTeams.filter(t => t.clubId === userClub?.id).map(t => t.id);
        fetchedCompetitions = fetchedCompetitions.filter(comp => clubTeamIds.includes(comp.assignedClubTeamId));
        setClubTeams(loadedTeams.filter(team => team.clubId === userClub?.id));
      } else if (currentUser?.role === 'Administrador') {
        // Admin sees all competitions, clubTeams will be populated based on dialog selection.
        setClubTeams(loadedTeams); // Or an empty array if a club filter is added at page level later.
      } else {
         setClubTeams([]); // No user, no active club
      }

      setFirestoreCompetitions(fetchedCompetitions);

      if (fetchedCompetitions.length > 0 && !selectedCompetition) {
        setSelectedCompetition(fetchedCompetitions[0]);
      } else if (fetchedCompetitions.length === 0) {
        setSelectedCompetition(null);
      } else if (selectedCompetition) {
        // Reselect if still exists
        const updatedSelected = fetchedCompetitions.find(c => c.id === selectedCompetition.id);
        setSelectedCompetition(updatedSelected || (fetchedCompetitions.length > 0 ? fetchedCompetitions[0] : null));
      }

    } catch (error) {
      console.error("Error fetching data for competitions page:", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos necesarios.", variant: "destructive" });
    } finally {
      setIsLoadingPageData(false);
    }
  };

  useEffect(() => {
    if (!authIsLoading) { // Ensure auth state is resolved before fetching
        fetchCoreData();
    }
  }, [currentUser, authIsLoading]);


  const handleCompetitionFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCompetitionFormData({ ...competitionFormData, [e.target.name]: e.target.value });
  };

  const handleDialogClubSelect = (clubId: string) => {
    setCompetitionFormData({ ...competitionFormData, dialogSelectedClubId: clubId, assignedClubTeamId: '' });
  };

  const handleCompetitionTeamSelect = (teamId: string) => {
    setCompetitionFormData({ ...competitionFormData, assignedClubTeamId: teamId });
  };

  const openEditCompetitionModal = (competition: LeagueCompetition) => {
    setIsEditingCompetition(true);
    const teamForCompetition = allFirestoreTeams.find(t => t.id === competition.assignedClubTeamId);
    setCompetitionFormData({
        name: competition.name,
        assignedClubTeamId: competition.assignedClubTeamId,
        dialogSelectedClubId: teamForCompetition?.clubId
    });
    setSelectedCompetition(competition);
    setIsCompetitionModalOpen(true);
  };

  const handleSaveCompetition = async () => {
    if (!competitionFormData.name?.trim() || !competitionFormData.assignedClubTeamId?.trim()) {
      toast({ title: 'Error', description: 'Nombre de la competición y equipo asignado son obligatorios.', variant: 'destructive' });
      return;
    }
    if (currentUser?.role === 'Administrador' && !competitionFormData.dialogSelectedClubId) {
      toast({ title: 'Error', description: 'Como administrador, debes seleccionar un club para la competición.', variant: 'destructive' });
      return;
    }

    const dataToSave: Omit<LeagueCompetition, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: any, updatedAt?: any } = {
      name: competitionFormData.name!,
      assignedClubTeamId: competitionFormData.assignedClubTeamId!,
      rivals: isEditingCompetition && selectedCompetition ? selectedCompetition.rivals : [], // Preserve rivals on edit
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEditingCompetition && selectedCompetition) {
        const compRef = doc(db, "leagueCompetitions", selectedCompetition.id);
        await updateDoc(compRef, dataToSave);
        toast({ title: 'Competición Actualizada', description: `"${dataToSave.name}" ha sido actualizada.` });
      } else {
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, "leagueCompetitions"), dataToSave);
        toast({ title: 'Competición Creada', description: `"${dataToSave.name}" ha sido creada.` });
      }
      fetchCoreData(); // Refetch all data
    } catch (error) {
      console.error("Error saving competition:", error);
      toast({ title: "Error al Guardar Competición", variant: "destructive" });
    }
    setIsCompetitionModalOpen(false);
  };

  const handleDeleteCompetition = (competition: LeagueCompetition) => {
    setCompetitionToDelete(competition);
  };

  const confirmDeleteCompetition = async () => {
    if (competitionToDelete) {
      try {
        await deleteDoc(doc(db, "leagueCompetitions", competitionToDelete.id));
        toast({ title: 'Competición Eliminada', description: `"${competitionToDelete.name}" ha sido eliminada.` });
        fetchCoreData(); // Refetch all data
      } catch (error) {
        console.error("Error deleting competition:", error);
        toast({ title: "Error al Eliminar", variant: "destructive" });
      }
      setCompetitionToDelete(null);
    }
  };

  const handleRivalFormInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "logoUrl") {
      setRivalFormData(prev => ({ ...prev, logoUrl: value, logoFile: null }));
      setRivalLogoPreview(value.trim() || null);
      if (rivalFileInputRef.current) rivalFileInputRef.current.value = "";
    } else {
      setRivalFormData({ ...rivalFormData, [name]: value });
    }
  };

  const handleRivalLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRivalFormData(prev => ({...prev, logoFile: file, logoUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setRivalLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowRivalUrlInput(false);
    }
  };
  const triggerRivalFileInput = () => rivalFileInputRef.current?.click();
  const removeRivalLogo = () => { setRivalFormData(prev => ({...prev, logoFile: null, logoUrl: ''})); setRivalLogoPreview(null); if (rivalFileInputRef.current) rivalFileInputRef.current.value = ''; setShowRivalUrlInput(false); };
  const toggleRivalUrlInput = () => { setShowRivalUrlInput(prev => { const newShowState = !prev; if (newShowState && rivalFormData.logoFile) { setRivalLogoPreview(isEditingRival && editingRivalOriginalId ? (selectedCompetition?.rivals.find(r=>r.id === editingRivalOriginalId)?.logoUrl || null) : null); setRivalFormData(prevData => ({...prevData, logoFile: null, logoUrl: (isEditingRival && editingRivalOriginalId ? (selectedCompetition?.rivals.find(r=>r.id === editingRivalOriginalId)?.logoUrl || '') : '')})); if (rivalFileInputRef.current) rivalFileInputRef.current.value = ""; } else if (!newShowState && !rivalFormData.logoFile) { if (!rivalFormData.logoUrl?.trim()) { setRivalLogoPreview(isEditingRival && editingRivalOriginalId ? (selectedCompetition?.rivals.find(r=>r.id === editingRivalOriginalId)?.logoUrl || null) : null); } } return newShowState; }); };

  const handleGenerateRivalLogo = async () => {
    if (!rivalFormData.name?.trim()) { toast({ title: "Nombre de Rival Requerido", variant: "destructive" }); return; }
    setIsGeneratingRivalLogo(true); toast({ title: "Generando Logo de Rival..." });
    try {
      const result = await generateAvatar({ promptText: rivalFormData.name, entityType: 'channel' });
      if (result.imageDataUri.length > MAX_LOGO_URL_LENGTH) {
        toast({ title: "Logo Muy Grande", variant: "default" });
        const fallbackUrl = `https://placehold.co/80x80.png?text=${(rivalFormData.name || 'R')[0].toUpperCase()}`;
        setRivalFormData(prev => ({ ...prev, logoUrl: fallbackUrl, logoFile: null }));
        setRivalLogoPreview(fallbackUrl);
      } else {
        setRivalFormData(prev => ({ ...prev, logoUrl: result.imageDataUri, logoFile: null }));
        setRivalLogoPreview(result.imageDataUri);
        toast({ title: "Logo de Rival Generado" });
      }
      setShowRivalUrlInput(true); if (rivalFileInputRef.current) rivalFileInputRef.current.value = "";
    } catch (error) { console.error("Error generating rival logo:", error); toast({ title: "Error de IA", variant: "destructive" });
    } finally { setIsGeneratingRivalLogo(false); }
  };

  const handleSaveRival = async () => {
    if (!selectedCompetition || !rivalFormData.name?.trim()) { toast({ title: 'Error', description: 'Nombre del rival es obligatorio.', variant: 'destructive' }); return; }
    let finalLogoUrl = rivalFormData.logoUrl;
    if (rivalFormData.logoFile && rivalLogoPreview && rivalLogoPreview.startsWith('data:')) { finalLogoUrl = rivalLogoPreview; }
    else if (rivalLogoPreview && !rivalLogoPreview.startsWith('data:')){ finalLogoUrl = rivalLogoPreview; }
    else if (rivalLogoPreview === null) { finalLogoUrl = undefined; }
    if (finalLogoUrl && finalLogoUrl.length > MAX_LOGO_URL_LENGTH) { toast({ title: "Logo Muy Grande", variant: "default" }); finalLogoUrl = `https://placehold.co/80x80.png?text=${rivalFormData.name![0].toUpperCase()}`; }

    const rivalData: RivalTeam = {
      id: isEditingRival && editingRivalOriginalId ? editingRivalOriginalId : `rival-${Date.now()}`,
      name: rivalFormData.name!,
      logoUrl: finalLogoUrl,
      fieldLocation: rivalFormData.fieldLocation || undefined,
    };
    const compRef = doc(db, "leagueCompetitions", selectedCompetition.id);
    try {
      if (isEditingRival && editingRivalOriginalId) {
        const currentRivals = selectedCompetition.rivals || [];
        const updatedRivals = currentRivals.map(r => r.id === editingRivalOriginalId ? rivalData : r);
        await updateDoc(compRef, { rivals: updatedRivals, updatedAt: serverTimestamp() });
        toast({ title: 'Rival Actualizado' });
      } else {
        await updateDoc(compRef, { rivals: arrayUnion(rivalData), updatedAt: serverTimestamp() });
        toast({ title: 'Rival Añadido' });
      }
      fetchCoreData();
    } catch (error) { console.error("Error saving rival:", error); toast({ title: "Error al Guardar Rival", variant: "destructive" }); }
    setIsRivalModalOpen(false); setRivalLogoPreview(null); setShowRivalUrlInput(false);
  };

  const handleDeleteRival = (rival: RivalTeam) => setRivalToDelete(rival);
  const confirmDeleteRival = async () => {
    if (rivalToDelete && selectedCompetition) {
      const compRef = doc(db, "leagueCompetitions", selectedCompetition.id);
      try {
        await updateDoc(compRef, { rivals: arrayRemove(rivalToDelete), updatedAt: serverTimestamp() });
        toast({ title: 'Rival Eliminado' });
        fetchCoreData();
      } catch (error) { console.error("Error deleting rival:", error); toast({ title: "Error al Eliminar Rival", variant: "destructive" }); }
      setRivalToDelete(null);
    }
  };

  const getTeamDetails = (teamId: string) => allFirestoreTeams.find(t => t.id === teamId);
  const openNewRivalModal = () => { setIsEditingRival(false); setEditingRivalOriginalId(null); setRivalFormData(initialNewRivalData); setRivalLogoPreview(null); setShowRivalUrlInput(false); setIsRivalModalOpen(true); };
  const openEditRivalModal = (rival: RivalTeam) => { setIsEditingRival(true); setEditingRivalOriginalId(rival.id); setRivalFormData({ name: rival.name, logoUrl: rival.logoUrl, fieldLocation: rival.fieldLocation, logoFile: null }); setRivalLogoPreview(rival.logoUrl || null); setShowRivalUrlInput(!!rival.logoUrl && !rival.logoUrl.startsWith('data:')); setIsRivalModalOpen(true); };

  const teamsForDialogDropdown = currentUser?.role === 'Administrador' && competitionFormData.dialogSelectedClubId
    ? allFirestoreTeams.filter(t => t.clubId === competitionFormData.dialogSelectedClubId)
    : clubTeams;

  if (isLoadingPageData && authIsLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  if (!activeClub && currentUser?.role !== 'Administrador' && !authIsLoading && !isLoadingPageData) {
    return ( <div className="p-4 text-center"> <p>No hay un club activo seleccionado o disponible. Por favor, configura un club predeterminado o asóciate a uno.</p> <Link href="/clubs"><Button className="mt-4">Ir a Gestión de Clubes</Button></Link> </div> );
  }

  return (
    <div className="w-full space-y-6">
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          {firestoreCompetitions.length === 0 ? (
            <div className="text-center py-10"> <Trophy className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-medium">No hay competiciones</h3> <p className="mt-1 text-sm text-muted-foreground">Empieza creando una nueva competición.</p> </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30 shadow-sm">
                <Label htmlFor="select-competition" className="text-sm font-medium">Seleccionar Competición:</Label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Select value={selectedCompetition?.id || ''} onValueChange={(id) => setSelectedCompetition(firestoreCompetitions.find(c => c.id === id) || null)} >
                    <SelectTrigger id="select-competition" className="w-full sm:flex-1 min-w-[200px]"> <SelectValue placeholder="Elige una competición" /> </SelectTrigger>
                    <SelectContent> {firestoreCompetitions.map(comp => ( <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem> ))} </SelectContent>
                    </Select>
                    {selectedCompetition && (
                        <div className="flex gap-2 w-full justify-center mt-2 sm:w-auto sm:mt-0 sm:self-center">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="flex-1 sm:flex-initial" onClick={() => openEditCompetitionModal(selectedCompetition)}><Edit3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar Competición</p></TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="flex-1 sm:flex-initial" onClick={() => handleDeleteCompetition(selectedCompetition)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Eliminar Competición</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                    )}
                </div>
              </div>
              {selectedCompetition && (
                <Card className="shadow-md">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div> <CardTitle className="font-headline text-xl">{selectedCompetition.name}</CardTitle>
                            {(() => { const team = getTeamDetails(selectedCompetition.assignedClubTeamId); return team ? ( <CardDescription className="flex items-center gap-2 mt-1"> <Avatar className="h-12 w-12 border"> <AvatarImage src={team.logoUrl || `https://placehold.co/48x48.png`} alt={team.name} data-ai-hint="team logo"/> <AvatarFallback>{team.name.substring(0,1)}</AvatarFallback> </Avatar> {team.name} ({team.category}) </CardDescription> ) : <CardDescription>Equipo del club no encontrado.</CardDescription>; })()}
                        </div> <Button onClick={openNewRivalModal}> <PlusCircle className="mr-2 h-4 w-4" /> Añadir Equipo Rival </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2"> <h4 className="text-lg font-semibold font-headline text-primary">Equipos Rivales</h4>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={rivalsViewMode === 'card' ? 'default' : 'outline'} size="icon" onClick={() => setRivalsViewMode('card')} aria-label="Vista de tarjetas"><LayoutGrid className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Vista de Tarjetas</p></TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={rivalsViewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setRivalsViewMode('list')} aria-label="Vista de lista"><ListIcon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Vista de Lista</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                    </div>
                    {selectedCompetition.rivals.length === 0 ? ( <p className="text-muted-foreground">No hay equipos rivales añadidos para esta competición.</p> ) : rivalsViewMode === 'card' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
                        {selectedCompetition.rivals.map(rival => ( 
                          <Card key={rival.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow"> 
                            <CardHeader className="flex flex-row items-center gap-3 p-3"> 
                              <Avatar className="h-12 w-16 border rounded-md"> 
                                <AvatarImage src={rival.logoUrl || 'https://placehold.co/80x60.png?text=R'} alt={rival.name} className="object-contain" data-ai-hint="team logo"/> 
                                <AvatarFallback className="rounded-md">{rival.name.substring(0,1)}</AvatarFallback> 
                              </Avatar> 
                              <CardTitle className="text-md font-semibold leading-tight">{rival.name}</CardTitle> 
                            </CardHeader> 
                            <CardContent className="p-3 text-xs text-muted-foreground flex-grow"> 
                              {rival.fieldLocation && ( <p className="flex items-start gap-1.5"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {rival.fieldLocation}</p> )} 
                            </CardContent> 
                            <CardFooter className="p-2 border-t flex justify-end gap-1"> 
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRivalModal(rival)}><Edit3 className="h-4 w-4" /></Button> 
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRival(rival)}><Trash2 className="h-4 w-4" /></Button> 
                            </CardFooter> 
                          </Card> 
                        ))} 
                      </div>
                    ) : ( <div className="rounded-md border">
                        <Table><TableHeader><TableRow><TableHead className="w-[60px] hidden sm:table-cell">Logo</TableHead><TableHead>Nombre del Rival</TableHead><TableHead className="hidden md:table-cell">Ubicación del Campo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>{selectedCompetition.rivals.map(rival => (<TableRow key={rival.id}><TableCell className="hidden sm:table-cell"><Avatar className="h-9 w-9 rounded-md border"><AvatarImage src={rival.logoUrl || `https://placehold.co/36x36.png`} alt={rival.name} data-ai-hint="team logo"/><AvatarFallback className="rounded-md">{rival.name.substring(0,1)}</AvatarFallback></Avatar></TableCell><TableCell className="font-semibold">{rival.name}</TableCell><TableCell className="hidden md:table-cell text-xs text-muted-foreground">{rival.fieldLocation || 'No especificada'}</TableCell><TableCell className="text-right"><div className="flex justify-end items-center gap-1"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Editar rival" onClick={() => openEditRivalModal(rival)}><Edit3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Editar Rival</p></TooltipContent></Tooltip></TooltipProvider><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Eliminar rival" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRival(rival)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Eliminar Rival</p></TooltipContent></Tooltip></TooltipProvider></div></TableCell></TableRow>))}</TableBody></Table></div> )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ModernDialog 
        isOpen={isCompetitionModalOpen} 
        onClose={() => setIsCompetitionModalOpen(false)}
        title={isEditingCompetition ? 'Editar Competición' : 'Crear Nueva Competición'}
        icon={Trophy}
        size="xl"
        type="info"
      >
        <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 py-4 px-4 sm:px-6">
                    <h4 className="font-semibold text-primary border-b pb-1">Detalles de la Competición</h4>
                    <div className="space-y-4">
                        <div className="space-y-1"> <Label htmlFor="competition-name">Nombre de la Competición*</Label> <Input id="competition-name" name="name" value={competitionFormData.name || ''} onChange={handleCompetitionFormChange} /> </div>
                        {currentUser?.role === 'Administrador' && ( <div className="space-y-1"> <Label htmlFor="competition-dialog-club">Club*</Label> <Select value={competitionFormData.dialogSelectedClubId || ''} onValueChange={handleDialogClubSelect}> <SelectTrigger id="competition-dialog-club"> <SelectValue placeholder="Selecciona un club" /> </SelectTrigger> <SelectContent> {allFirestoreClubs.map(club => ( <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem> ))} </SelectContent> </Select> </div> )}
                        <div className="space-y-1"> <Label htmlFor="competition-team">Equipo del Club Asignado*</Label> <Select value={competitionFormData.assignedClubTeamId || ''} onValueChange={handleCompetitionTeamSelect} disabled={currentUser?.role === 'Administrador' && !competitionFormData.dialogSelectedClubId} > <SelectTrigger id="competition-team"> <SelectValue placeholder="Selecciona un equipo" /> </SelectTrigger> <SelectContent> {teamsForDialogDropdown.length === 0 && <SelectItem value="no-teams" disabled> {currentUser?.role === 'Administrador' && !competitionFormData.dialogSelectedClubId ? "Selecciona un club primero" : `No hay equipos en ${competitionFormData.dialogSelectedClubId ? allFirestoreClubs.find(c=>c.id === competitionFormData.dialogSelectedClubId)?.name : activeClub?.name || 'el club seleccionado'}`} </SelectItem>} {teamsForDialogDropdown.map(team => ( <SelectItem key={team.id} value={team.id}>{team.name} ({team.category})</SelectItem> ))} </SelectContent> </Select> </div> 
                    </div>
                </div>
            </ScrollArea>
             <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t shrink-0">
                <Button type="button" variant="secondary" onClick={() => setIsCompetitionModalOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handleSaveCompetition} className="btn-primary">Guardar Competición</Button>
            </div>
        </div>
      </ModernDialog>

      {competitionToDelete && ( 
        <ModernDialog 
            isOpen={!!competitionToDelete}
            onClose={() => setCompetitionToDelete(null)}
            title={`Eliminar "${competitionToDelete.name}"`}
            icon={Trash2}
            type="error"
            size="xl"
        >
             <div className="space-y-4 p-4 sm:px-6">
                <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer. Se eliminará la competición y todos sus rivales asociados.</p>
                 <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setCompetitionToDelete(null)}>Cancelar</Button>
                    <Button variant="destructive" onClick={confirmDeleteCompetition} className="btn-danger">Eliminar</Button>
                </div>
             </div>
        </ModernDialog>
       )}
      <ModernDialog 
        isOpen={isRivalModalOpen} 
        onClose={() => { setIsRivalModalOpen(false); setRivalLogoPreview(null); setRivalFormData(initialNewRivalData); setIsGeneratingRivalLogo(false); setShowRivalUrlInput(false); }}
        title={isEditingRival ? 'Editar Equipo Rival' : 'Añadir Nuevo Equipo Rival'}
        icon={PlusCircle}
        size="xl"
        type="info"
      >
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0"> 
            <div className="space-y-4 py-4 px-4 sm:px-6"> 
              <h4 className="font-semibold text-primary border-b pb-1">Detalles del Rival</h4>
              <div className="space-y-4">
                <div className="space-y-1"> <Label htmlFor="rival-name">Nombre del Rival*</Label> <Input id="rival-name" name="name" value={rivalFormData.name || ''} onChange={handleRivalFormInputChange} /> </div>
                <div className="space-y-1"> <Label htmlFor="rival-fieldLocation">Ubicación del Campo (opcional)</Label> <Input id="rival-fieldLocation" name="fieldLocation" value={rivalFormData.fieldLocation || ''} onChange={handleRivalFormInputChange} placeholder="Ej: Estadio Municipal XYZ" /> </div>
              </div>
              <Separator className="my-4"/>
              <div className="space-y-2"> <Label>Logo del Rival</Label> <div className="flex items-center gap-4"> <Avatar className="h-16 w-16 border rounded-md"> <AvatarImage src={rivalLogoPreview || `https://placehold.co/64x64.png?text=R`} alt="Logo Rival Preview" data-ai-hint="team logo"/> <AvatarFallback className="rounded-md">{rivalFormData.name?.[0]?.toUpperCase() || 'R'}</AvatarFallback> </Avatar> <div className="flex flex-col gap-2 flex-1"> <Button type="button" variant="outline" size="sm" onClick={triggerRivalFileInput}> <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo </Button> <input type="file" ref={rivalFileInputRef} onChange={handleRivalLogoFileChange} accept="image/*" className="hidden"/> <Button type="button" variant="outline" size="sm" onClick={toggleRivalUrlInput}> <LinkIconLucide className="mr-2 h-4 w-4" /> {showRivalUrlInput ? 'Ocultar URL' : 'Introducir URL'} </Button> </div> </div> {showRivalUrlInput && ( <Input name="logoUrl" value={rivalFormData.logoUrl || ''} onChange={handleRivalFormInputChange} placeholder="Pega una URL de imagen" className="h-9 text-sm mt-2" /> )} {rivalFormData.name?.trim() && ( <Button type="button" variant="outline" size="sm" onClick={handleGenerateRivalLogo} disabled={isGeneratingRivalLogo || !rivalFormData.name?.trim()} className="w-full mt-2" > <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingRivalLogo && "animate-spin")} /> {isGeneratingRivalLogo ? "Generando..." : "Generar Logo con IA"} </Button> )} {rivalLogoPreview && ( <Button type="button" variant="link" size="sm" onClick={removeRivalLogo} className="text-xs text-destructive p-0 h-auto"> <X className="mr-1 h-3 w-3"/> Quitar logo </Button> )} </div> 
            </div> 
          </ScrollArea>
           <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t shrink-0">
                <Button type="button" variant="secondary" onClick={() => setIsRivalModalOpen(false)} disabled={isGeneratingRivalLogo}>Cancelar</Button>
                <Button type="button" onClick={handleSaveRival} disabled={isGeneratingRivalLogo} className="btn-primary">
                    {isGeneratingRivalLogo && <Sparkles className="mr-2 h-4 w-4 animate-spin" />}
                    {isGeneratingRivalLogo ? "Guardando..." : "Guardar Rival"}
                </Button>
            </div>
        </div>
      </ModernDialog>
      {rivalToDelete && ( 
         <ModernDialog 
            isOpen={!!rivalToDelete}
            onClose={() => setRivalToDelete(null)}
            title={`Eliminar "${rivalToDelete.name}"`}
            icon={Trash2}
            type="error"
            size="xl"
        >
             <div className="space-y-4 p-4 sm:px-6">
                <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer. El equipo será eliminado de la lista de rivales de esta competición.</p>
                 <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setRivalToDelete(null)}>Cancelar</Button>
                    <Button variant="destructive" onClick={confirmDeleteRival} className="btn-danger">Eliminar</Button>
                </div>
             </div>
        </ModernDialog>
      )}
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <AuthGuard allowedRoles={['Administrador', 'Entrenador', 'Directivo Club']}>
      <CompetitionsPageContent />
    </AuthGuard>
  );
}
