

'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useEffect, type ChangeEvent, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, writeBatch, where, deleteField as firestoreDeleteField } from 'firebase/firestore';
import type { Club, Team } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, Eye, Edit3, Shield, ShieldOff, Trash2, Star, CheckCircle2, LayoutGrid, List as ListIcon, Users, UploadCloud, X, Link as LinkIconLucide } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import AuthGuard from '@/components/auth/auth-guard';
import { usePageHeader } from '@/contexts/page-header-context';
import { ModernDialog } from '@/components/ui/modern-dialog';


const initialNewClubData: Partial<Omit<Club, 'id' | 'createdAt' | 'updatedAt'>> & { logoFile?: File | null } = { 
  name: '', 
  logoUrl: '', 
  isDefault: false,
  logoFile: null 
};

function ClubsPageContent() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
  const { toast } = useToast();
  const { setHeader } = usePageHeader();

  const [isEditClubDialogOpen, setIsEditClubDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [editClubData, setEditClubData] = useState<Partial<Omit<Club, 'id' | 'createdAt' | 'updatedAt'>> & { logoFile?: File | null }>({ name: '', logoUrl: '', logoFile: null });
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const editClubFileInputRef = useRef<HTMLInputElement>(null);
  const [showEditUrlInput, setShowEditUrlInput] = useState(false);


  const [isAddClubDialogOpen, setIsAddClubDialogOpen] = useState(false);
  const [newClubData, setNewClubData] = useState(initialNewClubData);
  const [newClubLogoPreview, setNewClubLogoPreview] = useState<string | null>(null);
  const newClubFileInputRef = useRef<HTMLInputElement>(null);
  const [showNewUrlInput, setShowNewUrlInput] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const headerAction = useMemo(() => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={() => setIsAddClubDialogOpen(true)} size="sm" className="px-2 sm:px-3">
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Añadir Club</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Crear un nuevo club en el sistema.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ), []);

  useEffect(() => {
    setHeader({
      title: 'Gestión de Clubes',
      description: 'Administra los diferentes clubes.',
      icon: Shield,
      action: headerAction,
    });
  }, [setHeader, headerAction]);


  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const clubsCollection = collection(db, "clubs");
      const qClubs = query(clubsCollection, orderBy("name"));
      const clubsSnapshot = await getDocs(qClubs);
      const clubsData = clubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
      setClubs(clubsData);

      const teamsCollection = collection(db, "teams");
      const qTeams = query(teamsCollection, orderBy("name"));
      const teamsSnapshot = await getDocs(qTeams);
      const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setAllTeams(teamsData);

    } catch (error) {
      console.error("Error fetching page data: ", error);
      toast({ title: "Error", description: "No se pudieron cargar los clubes o equipos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  const filteredClubs = clubs.filter(club =>
    club.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTeamCountForClub = (clubId: string) => {
    return allTeams.filter(team => team.clubId === clubId).length;
  };

  const handleDeleteClub = (club: Club) => {
    if (clubs.length <= 1) {
      toast({
        title: "Acción no permitida",
        description: "No se puede eliminar el último club del sistema.",
        variant: "destructive",
      });
      return;
    }
    setClubToDelete(club);
  };

  const confirmDeleteClub = async () => {
    if (clubToDelete) {
      try {
        const batch = writeBatch(db);
        
        batch.delete(doc(db, "clubs", clubToDelete.id));

        const teamsQuery = query(collection(db, "teams"), where("clubId", "==", clubToDelete.id));
        const teamsSnapshot = await getDocs(teamsQuery);
        teamsSnapshot.forEach(teamDoc => {
            batch.delete(teamDoc.ref);
        });
        
        await batch.commit();
        
        if (clubToDelete.isDefault) {
          const remainingClubs = clubs.filter(c => c.id !== clubToDelete.id);
          if (remainingClubs.length > 0) {
            const newDefaultClub = remainingClubs[0];
            const newDefaultClubRef = doc(db, "clubs", newDefaultClub.id);
            await updateDoc(newDefaultClubRef, { isDefault: true, updatedAt: serverTimestamp() });
          }
        }
        
        toast({
          title: "Club Eliminado",
          description: `El club "${clubToDelete.name}" y sus equipos asociados han sido eliminados.`,
        });
        fetchPageData();
      } catch (error) {
        console.error("Error deleting club and associated teams: ", error);
        toast({ title: "Error", description: "No se pudo eliminar el club y/o sus equipos.", variant: "destructive" });
      } finally {
        setClubToDelete(null);
      }
    }
  };

  const handleOpenEditDialog = (club: Club) => {
    setEditingClub(club);
    setEditClubData({ name: club.name, logoUrl: club.logoUrl || '', isDefault: club.isDefault, logoFile: null });
    setEditLogoPreview(club.logoUrl || null);
    setShowEditUrlInput(!!club.logoUrl && !club.logoUrl.startsWith('data:'));
    setIsEditClubDialogOpen(true);
  };

  const handleEditClubInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "logoUrl") {
        setEditClubData(prev => ({ ...prev, logoUrl: value, logoFile: null }));
        setEditLogoPreview(value.trim() || null);
        if (editClubFileInputRef.current) editClubFileInputRef.current.value = "";
    } else {
       setEditClubData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditClubLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditClubData(prev => ({...prev, logoFile: file, logoUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowEditUrlInput(false);
    }
  };

  const triggerEditClubFileInput = () => {
    editClubFileInputRef.current?.click();
  };

  const removeEditClubLogo = () => {
    setEditClubData(prev => ({...prev, logoFile: null, logoUrl: ''}));
    setEditLogoPreview(null);
    if (editClubFileInputRef.current) editClubFileInputRef.current.value = '';
    setShowEditUrlInput(false);
  };

  const toggleEditClubUrlInput = () => {
      setShowEditUrlInput(prev => {
          const newShowState = !prev;
          if (newShowState && editClubData.logoFile) {
              setEditLogoPreview(editingClub?.logoUrl || null);
              setEditClubData(prevData => ({...prevData, logoFile: null, logoUrl: editingClub?.logoUrl || ''}));
              if (editClubFileInputRef.current) editClubFileInputRef.current.value = "";
          } else if (!newShowState && !editClubData.logoFile) {
              if (!editClubData.logoUrl?.trim()) {
                  setEditLogoPreview(editingClub?.logoUrl || null);
              }
          }
          return newShowState;
      });
  };

  const handleSaveClubChanges = async () => {
    if (!editingClub || !editClubData.name?.trim()) {
      toast({ title: "Error de Validación", description: "El nombre del club no puede estar vacío.", variant: "destructive" });
      return;
    }

    let finalLogoUrl = editClubData.logoUrl;
    if (editClubData.logoFile && editLogoPreview && editLogoPreview.startsWith('data:')) {
        finalLogoUrl = editLogoPreview; 
    } else if (editLogoPreview && !editLogoPreview.startsWith('data:')) {
        finalLogoUrl = editLogoPreview;
    } else if (editLogoPreview === null) {
        finalLogoUrl = undefined;
    }
    
    const clubDataToUpdate: any = { 
        name: editClubData.name!,
        updatedAt: serverTimestamp(),
    };

    if (finalLogoUrl !== undefined) {
        clubDataToUpdate.logoUrl = finalLogoUrl;
    } else {
        clubDataToUpdate.logoUrl = firestoreDeleteField();
    }


    try {
      const clubRef = doc(db, "clubs", editingClub.id);
      await updateDoc(clubRef, clubDataToUpdate);
      
      toast({ title: "Club Actualizado", description: `Los datos del club "${editClubData.name}" han sido actualizados.` });
      fetchPageData();
    } catch (error) {
      console.error("Error updating club: ", error);
      toast({ title: "Error", description: "No se pudo actualizar el club.", variant: "destructive" });
    } finally {
      setIsEditClubDialogOpen(false);
      setEditingClub(null);
      setShowEditUrlInput(false);
    }
  };

  const handleNewClubInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "logoUrl") {
        setNewClubData(prev => ({ ...prev, logoUrl: value, logoFile: null }));
        setNewClubLogoPreview(value.trim() || null);
        if (newClubFileInputRef.current) newClubFileInputRef.current.value = "";
    } else {
      setNewClubData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNewClubLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewClubData(prev => ({...prev, logoFile: file, logoUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewClubLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowNewUrlInput(false);
    }
  };

  const triggerNewClubFileInput = () => {
    newClubFileInputRef.current?.click();
  };
  
  const removeNewClubLogo = () => {
    setNewClubData(prev => ({...prev, logoFile: null, logoUrl: ''}));
    setNewClubLogoPreview(null);
    if (newClubFileInputRef.current) newClubFileInputRef.current.value = '';
    setShowNewUrlInput(false);
  };

  const toggleNewClubUrlInput = () => {
      setShowNewUrlInput(prev => {
          const newShowState = !prev;
          if (newShowState && newClubData.logoFile) {
              setNewClubLogoPreview(null);
              setNewClubData(prevData => ({...prevData, logoFile: null, logoUrl: ''}));
              if (newClubFileInputRef.current) newClubFileInputRef.current.value = "";
          }
          return newShowState;
      });
  };


  const handleAddClubSubmit = async () => {
    if (!newClubData.name?.trim()) {
      toast({ title: "Error de Validación", description: "El nombre del club no puede estar vacío.", variant: "destructive" });
      return;
    }

    let finalLogoUrl = newClubData.logoUrl;
    if (newClubData.logoFile && newClubLogoPreview && newClubLogoPreview.startsWith('data:')) {
        finalLogoUrl = newClubLogoPreview; 
    } else if (newClubLogoPreview && !newClubLogoPreview.startsWith('data:')) {
        finalLogoUrl = newClubLogoPreview;
    } else if (newClubLogoPreview === null) {
        finalLogoUrl = undefined;
    }
    
    const clubDataToAdd: any = { 
      name: newClubData.name!,
      isDefault: clubs.length === 0 ? true : (newClubData.isDefault || false), 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (finalLogoUrl !== undefined) {
        clubDataToAdd.logoUrl = finalLogoUrl;
    } 

    try {
      const clubsCollectionRef = collection(db, "clubs");
      if (clubDataToAdd.isDefault) {
        
        const q = query(clubsCollectionRef, where("isDefault", "==", true));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((docSnap) => {
          batch.update(doc(db, "clubs", docSnap.id), { isDefault: false, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      
      await addDoc(clubsCollectionRef, clubDataToAdd);
      toast({ title: "Club Añadido", description: `El club "${clubDataToAdd.name}" ha sido añadido.` });
      fetchPageData();
    } catch (error) {
      console.error("Error adding club: ", error);
      toast({ title: "Error", description: "No se pudo añadir el club.", variant: "destructive" });
    } finally {
      setIsAddClubDialogOpen(false);
      setNewClubData(initialNewClubData);
      setNewClubLogoPreview(null);
      setShowNewUrlInput(false);
    }
  };

  const handleSetDefaultClub = async (clubId: string) => {
    const clubToSetDefault = clubs.find(c => c.id === clubId);
    if (!clubToSetDefault || clubToSetDefault.isDefault) return;

    try {
      const clubsCollectionRef = collection(db, "clubs");
      const batch = writeBatch(db);

      
      const q = query(clubsCollectionRef, where("isDefault", "==", true));
      const currentDefaultSnapshot = await getDocs(q);
      currentDefaultSnapshot.forEach((docSnap) => {
        batch.update(doc(db, "clubs", docSnap.id), { isDefault: false, updatedAt: serverTimestamp() });
      });

      
      const newDefaultRef = doc(db, "clubs", clubId);
      batch.update(newDefaultRef, { isDefault: true, updatedAt: serverTimestamp() });

      await batch.commit();
      toast({ title: "Club Predeterminado Actualizado", description: `"${clubToSetDefault.name}" es ahora el club predeterminado.` });
      fetchPageData();
    } catch (error) {
      console.error("Error setting default club: ", error);
      toast({ title: "Error", description: "No se pudo actualizar el club predeterminado.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
       <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto lg:flex-1">
              <div className="relative flex-1 w-full sm:min-w-[200px] sm:w-auto">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar club por nombre..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto justify-start lg:justify-end mt-2 lg:mt-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={viewMode === 'card' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('card')} aria-label="Vista de tarjetas">
                      <LayoutGrid className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vista de Tarjetas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')} aria-label="Vista de lista">
                      <ListIcon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vista de Lista</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {isLoading ? (
             <div className="text-center py-10">Cargando clubes...</div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-10">
              <ShieldOff className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay clubes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm ? "No se encontraron clubes que coincidan con tu búsqueda." : "Empieza añadiendo un nuevo club."}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map((club) => {
                const teamCount = getTeamCountForClub(club.id);
                return (
                <Card key={club.id} className={cn("overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col", club.isDefault && "border-2 border-yellow-500 ring-2 ring-yellow-300")}>
                  <CardHeader className="p-0 relative items-center justify-center flex">
                    <Image
                      src={club.logoUrl || `https://placehold.co/300x150.png`}
                      alt={`Logo de ${club.name}`}
                      width={300}
                      height={150}
                      className="w-full h-36 object-contain p-4 bg-secondary/30"
                      data-ai-hint="club logo"
                    />
                     {club.isDefault && (
                           <Badge variant="outline" className="absolute top-2 left-2 border-yellow-600 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 shadow-sm">
                             <CheckCircle2 className="mr-1 h-3 w-3" /> Predeterminado
                           </Badge>
                        )}
                  </CardHeader>
                  <CardContent className="p-4 flex-grow">
                    <CardTitle className="text-lg font-headline mb-1">{club.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5"/> Equipos: {teamCount}
                    </CardDescription>
                  </CardContent>
                  <CardFooter className="p-3 border-t flex items-center gap-1">
                        <Link href={`/teams?clubId=${club.id}`} className="flex-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" className="w-full" size="sm">
                                            <Eye className="mr-2 h-4 w-4" />
                                            <span className="hidden sm:inline">Ver Equipos</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Ver y gestionar los equipos de este club.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Link>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => handleOpenEditDialog(club)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Editar Club</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                       <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => !club.isDefault && clubs.length > 1 && handleSetDefaultClub(club.id)}
                                        disabled={club.isDefault || clubs.length <= 1}
                                        className={cn(
                                            "group",
                                            club.isDefault ? "text-yellow-500 cursor-default" : "text-muted-foreground hover:text-yellow-500"
                                        )}
                                    >
                                        <Star className={cn("h-4 w-4", club.isDefault ? "fill-yellow-400" : "group-hover:fill-yellow-300")} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{club.isDefault ? "Club predeterminado" : "Marcar como predeterminado"}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {clubs.length <= 1 ? (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    disabled
                                    style={{ pointerEvents: 'none' }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>No se puede eliminar el último club.</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        ) : (
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteClub(club)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Eliminar Club</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )}
                  </CardFooter>
                </Card>
              );
            })}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] hidden sm:table-cell">Logo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Nº Equipos</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Predeterminado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClubs.map((club) => {
                    const teamCount = getTeamCountForClub(club.id);
                    return (
                    <TableRow key={club.id} className={cn(club.isDefault && "bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100/80 dark:hover:bg-yellow-800/50")}>
                      <TableCell className="hidden sm:table-cell">
                        <Avatar className="h-10 w-10 rounded-md border">
                          <AvatarImage src={club.logoUrl || `https://placehold.co/40x40.png`} alt={club.name} data-ai-hint="club logo" />
                          <AvatarFallback className="rounded-md">{club.name.substring(0,1)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold">{club.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-center">{teamCount}</TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        {club.isDefault && (
                          <Badge variant="outline" className="border-yellow-600 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Predeterminado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                            <Link href={`/teams?clubId=${club.id}`}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5 sm:mr-2" /><span className="hidden sm:inline">Ver Equipos</span></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ver y gestionar los equipos de este club.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Link>
                            <TooltipProvider>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Editar club" onClick={() => handleOpenEditDialog(club)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger><TooltipContent><p>Editar Club</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        aria-label={club.isDefault ? "Club predeterminado" : "Marcar como predeterminado"}
                                        onClick={() => !club.isDefault && clubs.length > 1 && handleSetDefaultClub(club.id)}
                                        disabled={club.isDefault || clubs.length <= 1}
                                        className={cn("group", club.isDefault ? "text-yellow-500 cursor-default" : "text-muted-foreground hover:text-yellow-500")}
                                    >
                                        <Star className={cn("h-4 w-4", club.isDefault ? "fill-yellow-400" : "group-hover:fill-yellow-300")}/>
                                    </Button>
                                </TooltipTrigger><TooltipContent><p>{club.isDefault ? "Club predeterminado" : "Marcar como predeterminado"}</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                            {clubs.length <= 1 ? (
                                <TooltipProvider>
                                    <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0}>
                                        <Button variant="ghost" size="icon" aria-label="Eliminar club" disabled style={{ pointerEvents: 'none' }} className="text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>No se puede eliminar el último club.</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <TooltipProvider>
                                    <Tooltip><TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label="Eliminar club" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClub(club)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger><TooltipContent><p>Eliminar Club</p></TooltipContent></Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {editingClub && (
        <ModernDialog 
            isOpen={isEditClubDialogOpen} 
            onClose={() => {
                setIsEditClubDialogOpen(false);
                setEditingClub(null);
                setEditLogoPreview(null); 
                setShowEditUrlInput(false);
            }} 
            title={`Editar Club: ${editingClub.name}`}
            icon={Edit3}
            size="xl"
            type="info"
        >
          <div className="space-y-4 py-4 px-2">
              <Input
                id="edit-club-name"
                name="name"
                value={editClubData.name || ''}
                onChange={handleEditClubInputChange}
                placeholder="Nombre del Club*"
              />
              <Separator />
              <div className="space-y-2">
                  <Label>Logo del Club</Label>
                  <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border rounded-md">
                          <AvatarImage src={editLogoPreview || `https://placehold.co/64x64.png`} alt="Logo Club Preview" data-ai-hint="club logo"/>
                          <AvatarFallback className="rounded-md">{editClubData.name?.[0]?.toUpperCase() || 'C'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2 flex-1">
                          <Button type="button" variant="outline" size="sm" onClick={triggerEditClubFileInput}>
                              <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                          </Button>
                          <input type="file" ref={editClubFileInputRef} onChange={handleEditClubLogoFileChange} accept="image/*" className="hidden"/>
                          <Button type="button" variant="outline" size="sm" onClick={toggleEditClubUrlInput}>
                              <LinkIconLucide className="mr-2 h-4 w-4" /> {showEditUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                          </Button>
                      </div>
                  </div>
                  {showEditUrlInput && (
                    <Input
                        name="logoUrl"
                        value={editClubData.logoUrl || ''}
                        onChange={handleEditClubInputChange}
                        placeholder="Pega una URL de imagen"
                        className="h-9 text-sm mt-2"
                    />
                  )}
                  {editLogoPreview && (
                      <Button type="button" variant="link" size="sm" onClick={removeEditClubLogo} className="text-xs text-destructive p-0 h-auto">
                          <X className="mr-1 h-3 w-3"/> Quitar logo
                      </Button>
                  )}
              </div>
            </div>
             <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t">
              <Button type="button" variant="secondary" onClick={() => {setIsEditClubDialogOpen(false); setEditingClub(null); setEditLogoPreview(null); setShowEditUrlInput(false);}}>Cancelar</Button>
              <Button type="button" onClick={handleSaveClubChanges} className="btn-primary">Guardar Cambios</Button>
            </div>
        </ModernDialog>
      )}

      <ModernDialog 
        isOpen={isAddClubDialogOpen} 
        onClose={() => {
          setIsAddClubDialogOpen(false);
          setNewClubData(initialNewClubData);
          setNewClubLogoPreview(null);
          setShowNewUrlInput(false);
        }}
        title="Añadir Nuevo Club"
        icon={PlusCircle}
        size="xl"
        type="info"
      >
        <div className="space-y-4 py-4 px-2">
            <Input
              id="new-club-name"
              name="name"
              value={newClubData.name || ''}
              onChange={handleNewClubInputChange}
              placeholder="Nombre del Club*"
            />
            <Separator />
            <div className="space-y-2">
              <Label>Logo del Club</Label>
              <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border rounded-md">
                      <AvatarImage src={newClubLogoPreview || `https://placehold.co/64x64.png`} alt="Nuevo Logo Club Preview" data-ai-hint="club logo"/>
                      <AvatarFallback className="rounded-md">{newClubData.name?.[0]?.toUpperCase() || 'C'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2 flex-1">
                      <Button type="button" variant="outline" size="sm" onClick={triggerNewClubFileInput}>
                          <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                      </Button>
                      <input type="file" ref={newClubFileInputRef} onChange={handleNewClubLogoFileChange} accept="image/*" className="hidden"/>
                      <Button type="button" variant="outline" size="sm" onClick={toggleNewClubUrlInput}>
                          <LinkIconLucide className="mr-2 h-4 w-4" /> {showNewUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                      </Button>
                  </div>
              </div>
              {showNewUrlInput && (
                  <Input
                    name="logoUrl"
                    value={newClubData.logoUrl || ''}
                    onChange={handleNewClubInputChange}
                    placeholder="Pega una URL de imagen"
                    className="h-9 text-sm mt-2"
                  />
              )}
              {newClubLogoPreview && (
                  <Button type="button" variant="link" size="sm" onClick={removeNewClubLogo} className="text-xs text-destructive p-0 h-auto">
                      <X className="mr-1 h-3 w-3"/> Quitar logo
                  </Button>
              )}
            </div>
            <Separator />
            {clubs.length > 0 && (
              <div className="flex items-center space-x-2 pt-2">
                  <input 
                      type="checkbox" 
                      id="new-club-isDefault" 
                      name="isDefault" 
                      checked={newClubData.isDefault || false} 
                      onChange={(e) => setNewClubData(prev => ({...prev, isDefault: e.target.checked}))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="new-club-isDefault" className="text-sm font-normal">Marcar como club predeterminado</Label>
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setIsAddClubDialogOpen(false); setNewClubData(initialNewClubData); setNewClubLogoPreview(null); setShowNewUrlInput(false);}}>Cancelar</Button>
            <Button type="button" onClick={handleAddClubSubmit} className="btn-primary">Guardar Club</Button>
          </div>
      </ModernDialog>
      
      {clubToDelete && (
        <ModernDialog 
            isOpen={!!clubToDelete} 
            onClose={() => setClubToDelete(null)}
            title={`Eliminar "${clubToDelete.name}"`}
            icon={Trash2}
            type="error"
            size="xl"
        >
          <div className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer. Se eliminará el club y todos sus equipos asociados. La eliminación de jugadores asociados a esos equipos deberá gestionarse por separado.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setClubToDelete(null)}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDeleteClub}>Eliminar Club y Equipos</Button>
              </div>
          </div>
        </ModernDialog>
      )}
    </div>
  );
}

export default function ClubsPage() {
  return (
    <AuthGuard allowedRoles={['Administrador']}>
      <ClubsPageContent />
    </AuthGuard>
  );
}
