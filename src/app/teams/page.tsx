

'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useEffect, type ChangeEvent, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, where, writeBatch, type WriteBatch, deleteField as firestoreDeleteField
} from 'firebase/firestore';
import type { Team, Club } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Search, Eye, Edit3, Trash2, UsersRound, Users, LayoutGrid, List as ListIcon, UploadCloud, Sparkles, X, Link as LinkIconLucide, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AuthGuard from '@/components/auth/auth-guard';
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePageHeader } from '@/contexts/page-header-context';
import { ModernDialog } from '@/components/ui/modern-dialog';

const MAX_AVATAR_URL_LENGTH = 700000; 

const initialNewTeamData: Partial<Omit<Team, 'id' | 'createdAt' | 'updatedAt'>> & { logoFile?: File | null } = {
  name: '',
  clubId: '',
  category: '',
  logoUrl: '',
  logoFile: null,
};

function TeamsPageContent() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const { toast } = useToast();
  const { setHeader } = usePageHeader();

  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
  const [newTeamData, setNewTeamData] = useState(initialNewTeamData);
  const [newTeamLogoPreview, setNewTeamLogoPreview] = useState<string | null>(null);
  const newTeamFileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingNewTeamLogo, setIsGeneratingNewTeamLogo] = useState(false);
  const [showNewUrlInput, setShowNewUrlInput] = useState(false);


  const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamData, setEditTeamData] = useState<Partial<Omit<Team, 'id' | 'createdAt' | 'updatedAt'>> & { logoFile?: File | null }>({});
  const [editTeamLogoPreview, setEditTeamLogoPreview] = useState<string | null>(null);
  const editTeamFileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingEditTeamLogo, setIsGeneratingEditTeamLogo] = useState(false);
  const [showEditUrlInput, setShowEditUrlInput] = useState(false);

  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const headerAction = useMemo(() => (
    <div className="flex items-center gap-2">
       <div className="flex items-center gap-1">
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('card')}><LayoutGrid className="h-4 w-4"/></Button>
          </TooltipTrigger><TooltipContent><p>Vista de Tarjetas</p></TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><ListIcon className="h-4 w-4"/></Button>
          </TooltipTrigger><TooltipContent><p>Vista de Lista</p></TooltipContent></Tooltip></TooltipProvider>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <Button onClick={() => setIsAddTeamDialogOpen(true)} size="icon" className="h-8 w-8">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger><TooltipContent><p>Añadir Equipo</p></TooltipContent></Tooltip></TooltipProvider>
    </div>
  ), [viewMode]);

  useEffect(() => {
    setHeader({
      title: 'Gestión de Equipos',
      description: 'Administra los equipos dentro de cada club.',
      icon: UsersRound,
      action: headerAction,
    });
  }, [setHeader, headerAction]);

  const fetchClubs = async () => {
    try {
      const clubsCollection = collection(db, "clubs");
      const q = query(clubsCollection, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const clubsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
      setClubs(clubsData);
    } catch (error) {
      console.error("Error fetching clubs: ", error);
      toast({ title: "Error", description: "No se pudieron cargar los clubes para el filtro.", variant: "destructive" });
    }
  };

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const teamsCollection = collection(db, "teams");
      let q;
      if (clubFilter !== 'all') {
        q = query(teamsCollection, where("clubId", "==", clubFilter), orderBy("name"));
      } else {
        q = query(teamsCollection, orderBy("name"));
      }
      const querySnapshot = await getDocs(q);
      const teamsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
    } catch (error) {
      console.error("Error fetching teams: ", error);
      toast({ title: "Error", description: "No se pudieron cargar los equipos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [clubFilter]);

  const getClubName = (clubId?: string) => {
    if (!clubId) return 'Club Desconocido';
    const club = clubs.find(c => c.id === clubId);
    return club ? club.name : 'Club Desconocido';
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewTeamInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "logoUrl") {
        setNewTeamData(prev => ({ ...prev, logoUrl: value, logoFile: null }));
        setNewTeamLogoPreview(value.trim() || null);
        if (newTeamFileInputRef.current) newTeamFileInputRef.current.value = "";
    } else {
       setNewTeamData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNewTeamSelectChange = (name: 'clubId' | 'category', value: string) => {
    setNewTeamData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewTeamLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewTeamData(prev => ({...prev, logoFile: file, logoUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTeamLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowNewUrlInput(false);
    }
  };

  const triggerNewTeamFileInput = () => {
    newTeamFileInputRef.current?.click();
  };

  const removeNewTeamLogo = () => {
    setNewTeamData(prev => ({...prev, logoFile: null, logoUrl: ''}));
    setNewTeamLogoPreview(null);
    if (newTeamFileInputRef.current) newTeamFileInputRef.current.value = '';
    setShowNewUrlInput(false);
  };

  const toggleNewTeamUrlInput = () => {
    setShowNewUrlInput(prev => {
        const newShowState = !prev;
        if (newShowState && newTeamData.logoFile) {
            setNewTeamLogoPreview(null);
            setNewTeamData(prevData => ({...prevData, logoFile: null, logoUrl: ''}));
            if (newTeamFileInputRef.current) newTeamFileInputRef.current.value = "";
        }
        return newShowState;
    });
  };

  const handleGenerateNewTeamLogo = async () => {
    if (!newTeamData.name?.trim()) {
      toast({ title: "Nombre de Equipo Requerido", description: "Introduce un nombre para el equipo antes de generar el logo.", variant: "destructive" });
      return;
    }
    setIsGeneratingNewTeamLogo(true);
    toast({ title: "Generando Logo de Equipo...", description: "Por favor, espera." });
    try {
      const result = await generateAvatar({ promptText: newTeamData.name, entityType: 'channel' });
      if (result.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Logo Muy Grande", description: "El logo generado es demasiado grande. Se usará uno por defecto. Intenta con un prompt más simple o sube una imagen.", variant: "default", duration: 7000 });
        setNewTeamData(prev => ({ ...prev, logoUrl: `https://placehold.co/80x80.png?text=${(prev.name || 'E')[0].toUpperCase()}`, logoFile: null }));
        setNewTeamLogoPreview(`https://placehold.co/80x80.png?text=${(newTeamData.name || 'E')[0].toUpperCase()}`);
      } else {
        setNewTeamData(prev => ({ ...prev, logoUrl: result.imageDataUri, logoFile: null }));
        setNewTeamLogoPreview(result.imageDataUri);
        toast({ title: "Logo de Equipo Generado", description: "El logo ha sido generado y aplicado." });
      }
      setShowNewUrlInput(true);
      if (newTeamFileInputRef.current) newTeamFileInputRef.current.value = "";
    } catch (error) {
      console.error("Error generating team logo:", error);
      toast({ title: "Error de IA", description: "No se pudo generar el logo del equipo. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsGeneratingNewTeamLogo(false);
    }
  };


  const handleAddTeamSubmit = async () => {
    if (!newTeamData.name?.trim() || !newTeamData.clubId?.trim()) {
      toast({
        title: "Campos Incompletos",
        description: "El nombre del equipo y el club son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let finalLogoUrl = newTeamData.logoUrl;
    if (newTeamData.logoFile && newTeamLogoPreview && newTeamLogoPreview.startsWith('data:')) {
      finalLogoUrl = newTeamLogoPreview;
    } else if (newTeamLogoPreview && !newTeamLogoPreview.startsWith('data:')) {
      finalLogoUrl = newTeamLogoPreview;
    }


    if (finalLogoUrl && finalLogoUrl.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Logo Muy Grande", description: "El logo es demasiado grande y no se guardará. Intenta con uno más pequeño.", variant: "default", duration: 5000 });
        finalLogoUrl = `https://placehold.co/80x80.png?text=${newTeamData.name![0].toUpperCase()}`;
    } else if (!finalLogoUrl) {
        finalLogoUrl = `https://placehold.co/80x80.png?text=${newTeamData.name![0].toUpperCase()}`;
    }


    try {
      const teamsCollection = collection(db, "teams");
      await addDoc(teamsCollection, {
        name: newTeamData.name,
        clubId: newTeamData.clubId,
        category: newTeamData.category || null,
        logoUrl: finalLogoUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Equipo Añadido",
        description: `El equipo "${newTeamData.name}" ha sido añadido.`,
      });
      fetchTeams();
    } catch (error) {
      console.error("Error adding team: ", error);
      toast({ title: "Error", description: "No se pudo añadir el equipo.", variant: "destructive" });
    } finally {
      setIsAddTeamDialogOpen(false);
      setNewTeamData(initialNewTeamData);
      setNewTeamLogoPreview(null);
      setShowNewUrlInput(false);
    }
  };

  const handleOpenEditDialog = (team: Team) => {
    setEditingTeam(team);
    setEditTeamData({
      name: team.name,
      clubId: team.clubId,
      category: team.category,
      logoUrl: team.logoUrl,
      logoFile: null
    });
    setEditTeamLogoPreview(team.logoUrl || null);
    setShowEditUrlInput(!!team.logoUrl && !team.logoUrl.startsWith('data:'));
    setIsEditTeamDialogOpen(true);
  };

  const handleEditTeamInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
     if (name === "logoUrl") {
        setEditTeamData(prev => ({ ...prev, logoUrl: value, logoFile: null }));
        setEditTeamLogoPreview(value.trim() || null);
        if (editTeamFileInputRef.current) editTeamFileInputRef.current.value = "";
    } else {
       setEditTeamData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditTeamSelectChange = (name: 'clubId' | 'category', value: string) => {
     setEditTeamData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditTeamLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditTeamData(prev => ({...prev, logoFile: file, logoUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditTeamLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowEditUrlInput(false);
    }
  };

  const triggerEditTeamFileInput = () => {
    editTeamFileInputRef.current?.click();
  };

  const removeEditTeamLogo = () => {
    setEditTeamData(prev => ({...prev, logoFile: null, logoUrl: ''}));
    setEditTeamLogoPreview(null);
    if (editTeamFileInputRef.current) editTeamFileInputRef.current.value = '';
    setShowEditUrlInput(false);
  };

  const toggleEditTeamUrlInput = () => {
    setShowEditUrlInput(prev => {
        const newShowState = !prev;
        if (newShowState && editTeamData.logoFile) {
            setEditTeamLogoPreview(editingTeam?.logoUrl || null);
            setEditTeamData(prevData => ({...prevData, logoFile: null, logoUrl: editingTeam?.logoUrl || ''}));
            if (editTeamFileInputRef.current) editTeamFileInputRef.current.value = "";
        } else if (!newShowState && !editTeamData.logoFile) {
            if (!editTeamData.logoUrl?.trim()) {
                setEditTeamLogoPreview(editingTeam?.logoUrl || null);
            }
        }
        return newShowState;
    });
  };

  const handleGenerateEditTeamLogo = async () => {
    if (!editTeamData.name?.trim()) {
      toast({ title: "Nombre de Equipo Requerido", description: "Introduce un nombre para el equipo antes de generar el logo.", variant: "destructive" });
      return;
    }
    setIsGeneratingEditTeamLogo(true);
    toast({ title: "Generando Logo de Equipo...", description: "Por favor, espera." });
    try {
      const result = await generateAvatar({ promptText: editTeamData.name, entityType: 'channel' });
      if (result.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Logo Muy Grande", description: "El logo generado es demasiado grande. Se usará uno por defecto.", variant: "default" });
        setEditTeamData(prev => ({ ...prev, logoUrl: `https://placehold.co/80x80.png?text=${(prev.name || 'E')[0].toUpperCase()}`, logoFile: null }));
        setEditTeamLogoPreview(`https://placehold.co/80x80.png?text=${(editTeamData.name || 'E')[0].toUpperCase()}`);
      } else {
        setEditTeamData(prev => ({ ...prev, logoUrl: result.imageDataUri, logoFile: null }));
        setEditTeamLogoPreview(result.imageDataUri);
        toast({ title: "Logo de Equipo Generado" });
      }
      setShowEditUrlInput(true);
      if (editTeamFileInputRef.current) editTeamFileInputRef.current.value = "";
    } catch (error) {
      console.error("Error generating team logo:", error);
      toast({ title: "Error de IA", description: "No se pudo generar el logo del equipo.", variant: "destructive" });
    } finally {
      setIsGeneratingEditTeamLogo(false);
    }
  };


  const handleSaveTeamChanges = async () => {
    if (!editingTeam || !editTeamData.name?.trim() || !editTeamData.clubId?.trim()) {
      toast({
        title: "Error de Validación",
        description: "El nombre del equipo y el club son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    let finalLogoUrl = editTeamData.logoUrl;
    if (editTeamData.logoFile && editTeamLogoPreview && editTeamLogoPreview.startsWith('data:')) {
      finalLogoUrl = editTeamLogoPreview;
    } else if (editTeamLogoPreview && !editTeamLogoPreview.startsWith('data:')) {
      finalLogoUrl = editTeamLogoPreview;
    } else if (editTeamLogoPreview === null) {
      finalLogoUrl = undefined;
    }


    if (finalLogoUrl && finalLogoUrl.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Logo Muy Grande", description: "El logo es demasiado grande y no se guardará. Intenta con uno más pequeño.", variant: "default", duration: 5000 });
        finalLogoUrl = editingTeam.logoUrl || `https://placehold.co/80x80.png?text=${(editTeamData.name || 'E')[0].toUpperCase()}`;
    }


    const teamUpdates: any = {
        name: editTeamData.name,
        clubId: editTeamData.clubId,
        category: editTeamData.category || null,
        updatedAt: serverTimestamp(),
    };

    if (finalLogoUrl !== undefined) {
        teamUpdates.logoUrl = finalLogoUrl;
    } else {
        teamUpdates.logoUrl = firestoreDeleteField();
    }


    try {
      const teamRef = doc(db, "teams", editingTeam.id);
      await updateDoc(teamRef, teamUpdates);
      toast({
        title: "Equipo Actualizado",
        description: `Los datos del equipo "${editTeamData.name}" han sido actualizados.`,
      });
      fetchTeams();
    } catch (error) {
      console.error("Error updating team: ", error);
      toast({ title: "Error", description: "No se pudo actualizar el equipo.", variant: "destructive" });
    } finally {
      setIsEditTeamDialogOpen(false);
      setEditingTeam(null);
      setEditTeamLogoPreview(null);
      setShowEditUrlInput(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    setTeamToDelete(team);
  };

  const confirmDeleteTeam = async () => {
    if (teamToDelete) {
      try {
        const batch: WriteBatch = writeBatch(db);

        const playersCollection = collection(db, "players");
        const playersQuery = query(playersCollection, where("teamId", "==", teamToDelete.id));
        const playersSnapshot = await getDocs(playersQuery);

        playersSnapshot.forEach(playerDoc => {
          batch.delete(doc(db, "players", playerDoc.id));
        });

        batch.delete(doc(db, "teams", teamToDelete.id));

        await batch.commit();

        toast({
          title: "Equipo Eliminado",
          description: `El equipo "${teamToDelete.name}" y sus jugadores asociados han sido eliminados.`,
        });
        fetchTeams();
      } catch (error) {
        console.error("Error deleting team and associated players: ", error);
        toast({ title: "Error", description: "No se pudo eliminar el equipo y/o sus jugadores.", variant: "destructive" });
      } finally {
        setTeamToDelete(null);
      }
    }
  };
  
  const addTeamDialogActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAddTeamSubmit}
            disabled={isGeneratingNewTeamLogo}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            {isGeneratingNewTeamLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Guardar Equipo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const editTeamDialogActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSaveTeamChanges}
            disabled={isGeneratingEditTeamLogo}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            {isGeneratingEditTeamLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Guardar Cambios</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (isLoading && teams.length === 0 && clubs.length === 0) {
    return <div className="p-4 text-center">Cargando datos...</div>;
  }

  return (
    <div className="space-y-6">
      <ModernDialog 
        isOpen={isAddTeamDialogOpen} 
        onClose={() => {
          setIsAddTeamDialogOpen(false);
          setNewTeamData(initialNewTeamData);
          setNewTeamLogoPreview(null);
          setShowNewUrlInput(false);
        }}
        title="Añadir Nuevo Equipo"
        icon={PlusCircle}
        size="xl"
        type="info"
        headerActions={addTeamDialogActions}
      >
        <div className="space-y-4 p-4">
            <div className="space-y-1">
            <Label htmlFor="team-name">Nombre*</Label>
            <Input
                id="team-name"
                name="name"
                value={newTeamData.name || ''}
                onChange={handleNewTeamInputChange}
                placeholder="Nombre del Equipo"
            />
            </div>
            <div className="space-y-1">
            <Label htmlFor="team-clubId">Club*</Label>
            <Select
                name="clubId"
                value={newTeamData.clubId || ''}
                onValueChange={(value) => handleNewTeamSelectChange('clubId', value)}
            >
                <SelectTrigger id="team-clubId">
                <SelectValue placeholder="Selecciona un club" />
                </SelectTrigger>
                <SelectContent>
                {clubs.map(club => (
                    <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                ))}
                </SelectContent>
            </Select>
            </div>
            <div className="space-y-1">
            <Label htmlFor="team-category">Categoría</Label>
            <Select
                name="category"
                value={newTeamData.category || ''}
                onValueChange={(value) => handleNewTeamSelectChange('category', value)}
            >
                <SelectTrigger id="team-category">
                <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="Benjamín">Benjamín</SelectItem>
                <SelectItem value="Alevín">Alevín</SelectItem>
                <SelectItem value="Infantil">Infantil</SelectItem>
                <SelectItem value="Cadete">Cadete</SelectItem>
                <SelectItem value="Juvenil">Juvenil</SelectItem>
                <SelectItem value="Sub-18">Sub-18</SelectItem>
                <SelectItem value="Senior">Senior</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
            </Select>
            </div>
            <Separator/>
            <div className="space-y-2">
            <Label>Logo del Equipo</Label>
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border rounded-md">
                    <AvatarImage src={newTeamLogoPreview || `https://placehold.co/64x64.png`} alt="Nuevo Logo Equipo Preview" data-ai-hint="team logo"/>
                    <AvatarFallback className="rounded-md">{newTeamData.name?.[0]?.toUpperCase() || 'E'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 flex-1">
                    <Button type="button" variant="outline" size="sm" onClick={triggerNewTeamFileInput}>
                        <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                    </Button>
                    <input type="file" ref={newTeamFileInputRef} onChange={handleNewTeamLogoFileChange} accept="image/*" className="hidden"/>
                    <Button type="button" variant="outline" size="sm" onClick={toggleNewTeamUrlInput}>
                        <LinkIconLucide className="mr-2 h-4 w-4" /> {showNewUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                    </Button>
                </div>
            </div>
            {showNewUrlInput && (
                <Input
                    name="logoUrl"
                    value={newTeamData.logoUrl || ''}
                    onChange={handleNewTeamInputChange}
                    placeholder="Pega una URL de imagen"
                    className="h-9 text-sm mt-2"
                />
            )}
            {newTeamData.name?.trim() && (
                <Button type="button" onClick={handleGenerateNewTeamLogo} variant="outline" size="sm" className="w-full mt-2" disabled={isGeneratingNewTeamLogo}>
                <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingNewTeamLogo && "animate-spin")}/> {isGeneratingNewTeamLogo ? "Generando..." : "Generar Logo con IA"}
                </Button>
            )}
            {newTeamLogoPreview && (
                <Button type="button" variant="link" size="sm" onClick={removeNewTeamLogo} className="text-xs text-destructive p-0 h-auto">
                    <X className="mr-1 h-3 w-3"/> Quitar logo
                </Button>
            )}
            </div>
        </div>
      </ModernDialog>
      <Card className="shadow-lg">
        <CardContent className="pt-6">
           <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto lg:flex-1">
              <div className="relative flex-1 w-full sm:min-w-[200px] sm:w-auto">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar equipo..." 
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={clubFilter} onValueChange={setClubFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Clubes</SelectItem>
                  {clubs.map(club => (
                    <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Cargando equipos...</p>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay equipos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || clubFilter !== 'all' ? "No se encontraron equipos que coincidan con tu búsqueda/filtro." : "Empieza añadiendo un nuevo equipo."}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeams.map((team) => (
                <Card key={team.id} className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <CardHeader className="p-0 relative items-center justify-center flex">
                    <Image
                      src={team.logoUrl || `https://placehold.co/300x150.png`}
                      alt={`Logo de ${team.name}`}
                      width={300}
                      height={150}
                      className="w-full h-36 object-contain p-4 bg-secondary/30"
                      data-ai-hint="team logo"
                    />
                  </CardHeader>
                  <CardContent className="p-4 flex-grow">
                    <CardTitle className="text-lg font-headline mb-1">{team.name}</CardTitle>
                    <CardDescription>Categoría: {team.category || 'N/A'}</CardDescription>
                    <CardDescription>Club: {getClubName(team.clubId)}</CardDescription>
                  </CardContent>
                  <CardFooter className="p-4 border-t flex flex-col sm:flex-row gap-2">
                     <Link href={`/players?teamId=${team.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                          <Eye className="mr-2 h-4 w-4" /> Ver Jugadores
                      </Button>
                    </Link>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => handleOpenEditDialog(team)}>
                            <Edit3 className="h-4 w-4" />
                            <span className="sr-only">Editar Equipo</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTeam(team)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar Equipo</span>
                        </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] hidden sm:table-cell">Logo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="hidden lg:table-cell">Club</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="hidden sm:table-cell">
                        <Avatar className="h-10 w-10 rounded-md border">
                          <AvatarImage src={team.logoUrl || `https://placehold.co/40x40.png`} alt={team.name} data-ai-hint="team logo"/>
                          <AvatarFallback className="rounded-md">{team.name.substring(0,1)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold">{team.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{team.category || 'N/A'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{getClubName(team.clubId)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Link href={`/players?teamId=${team.id}`}>
                            <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5 sm:mr-2" /><span className="hidden sm:inline">Jugadores</span></Button>
                          </Link>
                          <Button variant="ghost" size="icon" aria-label="Editar equipo" onClick={() => handleOpenEditDialog(team)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Eliminar equipo" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTeam(team)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      {editingTeam && (
        <ModernDialog 
          isOpen={isEditTeamDialogOpen}
          onClose={() => {
            setIsEditTeamDialogOpen(false);
            setEditingTeam(null);
            setEditTeamLogoPreview(null);
            setShowEditUrlInput(false);
          }}
          title={`Editar Equipo: ${editingTeam.name}`}
          icon={Edit3}
          size="xl"
          type="info"
          headerActions={editTeamDialogActions}
        >
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <Label htmlFor="edit-team-name">Nombre*</Label>
                <Input id="edit-team-name" name="name" value={editTeamData.name || ''} onChange={handleEditTeamInputChange} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-team-clubId">Club*</Label>
                <Select name="clubId" value={editTeamData.clubId || ''} onValueChange={(value) => handleEditTeamSelectChange('clubId', value)}>
                  <SelectTrigger id="edit-team-clubId"><SelectValue placeholder="Selecciona un club" /></SelectTrigger>
                  <SelectContent>{clubs.map(club => (<SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-team-category">Categoría</Label>
                <Select
                    name="category"
                    value={editTeamData.category || ''}
                    onValueChange={(value) => handleEditTeamSelectChange('category', value)}
                >
                    <SelectTrigger id="edit-team-category">
                        <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Benjamín">Benjamín</SelectItem>
                        <SelectItem value="Alevín">Alevín</SelectItem>
                        <SelectItem value="Infantil">Infantil</SelectItem>
                        <SelectItem value="Cadete">Cadete</SelectItem>
                        <SelectItem value="Juvenil">Juvenil</SelectItem>
                        <SelectItem value="Sub-18">Sub-18</SelectItem>
                        <SelectItem value="Senior">Senior</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                </Select>
              </div>
               <Separator/>
                  <div className="space-y-2">
                    <Label>Logo del Equipo</Label>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border rounded-md">
                            <AvatarImage src={editTeamLogoPreview || `https://placehold.co/64x64.png`} alt="Logo Equipo Preview" data-ai-hint="team logo"/>
                            <AvatarFallback className="rounded-md">{editTeamData.name?.[0]?.toUpperCase() || 'E'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2 flex-1">
                            <Button type="button" variant="outline" size="sm" onClick={triggerEditTeamFileInput}>
                                <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                            </Button>
                            <input type="file" ref={editTeamFileInputRef} onChange={handleEditTeamLogoFileChange} accept="image/*" className="hidden"/>
                             <Button type="button" variant="outline" size="sm" onClick={toggleEditTeamUrlInput}>
                                <LinkIconLucide className="mr-2 h-4 w-4" /> {showEditUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                            </Button>
                        </div>
                    </div>
                    {showEditUrlInput && (
                        <Input
                            name="logoUrl"
                            value={editTeamData.logoUrl || ''}
                            onChange={handleEditTeamInputChange}
                            placeholder="Pega una URL de imagen"
                            className="h-9 text-sm mt-2"
                        />
                    )}
                     {editTeamData.name?.trim() && (
                       <Button type="button" onClick={handleGenerateEditTeamLogo} variant="outline" size="sm" className="w-full mt-2" disabled={isGeneratingEditTeamLogo}>
                         <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingEditTeamLogo && "animate-spin")}/> {isGeneratingEditTeamLogo ? "Generando..." : "Generar Logo con IA"}
                       </Button>
                    )}
                    {editTeamLogoPreview && (
                        <Button type="button" variant="link" size="sm" onClick={removeEditTeamLogo} className="text-xs text-destructive p-0 h-auto">
                            <X className="mr-1 h-3 w-3"/> Quitar logo
                        </Button>
                    )}
                  </div>
            </div>
        </ModernDialog>
      )}


      {teamToDelete && (
        <ModernDialog
          isOpen={!!teamToDelete}
          onClose={() => setTeamToDelete(null)}
          title={`Eliminar "${teamToDelete.name}"`}
          icon={Trash2}
          type="error"
          size="md"
        >
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminará el equipo y todos sus jugadores asociados de forma permanente.
            </p>
             <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setTeamToDelete(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteTeam} className="btn-danger">Eliminar Equipo y Jugadores</Button>
            </div>
          </div>
        </ModernDialog>
      )}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <AuthGuard allowedRoles={['Administrador', 'Directivo Club', 'Entrenador']}>
      <TeamsPageContent />
    </AuthGuard>
  );
}
