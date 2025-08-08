
'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useEffect, type ChangeEvent, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, where, writeBatch, type WriteBatch, deleteField as firestoreDeleteField, limit
} from 'firebase/firestore';
import type { User, UserRole, Club, Team, Player } from '@/types';
import { placeholderUserRoles } from '@/lib/placeholder-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Search, Eye, Edit3, Trash2, UserCheck, UserCog as UserCogIcon, Users as UsersIcon, Briefcase, ShieldAlert, Sparkles, LayoutGrid, List as ListIcon, Building, CheckSquare, User as UserPlayerIcon, ShieldQuestion, Phone as PhoneIcon, UploadCloud, X, Filter, Link as LinkIconLucide, MailPlus, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import AuthGuard from '@/components/auth/auth-guard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePageHeader } from '@/contexts/page-header-context';
import { ModernDialog } from '@/components/ui/modern-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MAX_AVATAR_URL_LENGTH = 700000; 

type DisplayUser = User & { status?: 'Active' | 'Invitación Pendiente' };

const initialNewUserDataState: Partial<User> & { avatarFile?: File | null } = {
  name: '',
  email: '',
  phone: '',
  role: undefined,
  avatarUrl: '',
  avatarFile: null,
  clubId: undefined,
  teamId: undefined,
  managedTeamIds: [],
  playerId: undefined,
  linkedPlayerIds: [],
};

function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userToDelete, setUserToDelete] = useState<DisplayUser | null>(null);
  const { toast } = useToast();
  const { setHeader } = usePageHeader();

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState<Partial<User> & { avatarFile?: File | null }>(initialNewUserDataState);
  const [isGeneratingAvatarNewUser, setIsGeneratingAvatarNewUser] = useState(false);
  const [avatarPreviewDialogNewUser, setAvatarPreviewDialogNewUser] = useState<string | null>(null);
  const newUserFileInputRef = useRef<HTMLInputElement>(null);


  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserData, setEditUserData] = useState<Partial<User> & { avatarFile?: File | null }>({});
  const [isGeneratingAvatarEditUser, setIsGeneratingAvatarEditUser] = useState(false);
  const [avatarPreviewDialogEditUser, setAvatarPreviewDialogEditUser] = useState<string | null>(null);
  const editUserAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [showAvatarUrlInputEditUser, setShowAvatarUrlInputEditUser] = useState(false);


  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const [clubs, setClubsData] = useState<Club[]>([]);
  const [teams, setTeamsData] = useState<Team[]>([]);
  const [players, setPlayersData] = useState<Player[]>([]);

  const headerAction = useMemo(() => (
    <Button onClick={() => setIsAddUserDialogOpen(true)} size="sm" className="px-2 sm:px-3">
      <PlusCircle className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Añadir Usuario</span>
    </Button>
  ), []);

  useEffect(() => {
    setHeader({
      title: 'Gestión de Usuarios',
      description: 'Administra los usuarios y sus roles de acceso a la plataforma.',
      icon: UsersIcon,
      action: headerAction,
    });
  }, [setHeader, headerAction]);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const clubsSnap = await getDocs(query(collection(db, "clubs"), orderBy("name")));
      setClubsData(clubsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club)));

      const teamsSnap = await getDocs(query(collection(db, "teams"), orderBy("name")));
      setTeamsData(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));

      const playersSnap = await getDocs(query(collection(db, "players"), orderBy("name")));
      setPlayersData(playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));

      const usersQuery = query(collection(db, "users"), orderBy("name"));
      const usersSnapshot = await getDocs(usersQuery);
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      
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

  const displayList = useMemo<DisplayUser[]>(() => {
    return users.map(u => ({
        ...u,
        status: u.status === 'Pending' ? 'Invitación Pendiente' : 'Active'
    }));
  }, [users]);

  const handleRoleChangeOnTable = async (userId: string, newRole: UserRole) => {
    const userBeingChanged = users.find(u => u.id === userId);
    if (!userBeingChanged) return;

    if (newRole === 'Entrenador' && (!userBeingChanged.clubId || !userBeingChanged.managedTeamIds || userBeingChanged.managedTeamIds.length === 0)) {
        toast({ title: "Asignación Requerida", description: `Para 'Entrenador', edita el usuario y asígnale club y equipo(s).`, variant: "destructive", duration: 7000 });
        return;
    }

    try {
      const userDocRef = doc(db, "users", userId);
      const updates: any = { role: newRole, updatedAt: serverTimestamp() };
      
      updates.managedTeamIds = (newRole === 'Entrenador' && userBeingChanged.managedTeamIds?.length) ? userBeingChanged.managedTeamIds : firestoreDeleteField();
      updates.playerId = (newRole === 'Jugador' && userBeingChanged.playerId) ? userBeingChanged.playerId : firestoreDeleteField();
      updates.linkedPlayerIds = (newRole === 'Tutor' && userBeingChanged.linkedPlayerIds?.length) ? userBeingChanged.linkedPlayerIds : firestoreDeleteField();
      
      if (newRole === 'Administrador') {
        updates.clubId = firestoreDeleteField();
        updates.teamId = firestoreDeleteField();
      }

      await updateDoc(userDocRef, updates);
      fetchPageData();
      toast({ title: "Rol Actualizado", description: `Rol de ${userBeingChanged.name} cambiado a ${newRole}.` });
    } catch (error) {
      console.error("Error updating user role in Firestore:", error);
      toast({ title: "Error al Actualizar Rol", variant: "destructive" });
    }
  };

  const filteredUsers = displayList.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (roleFilter === 'all' || user.role === roleFilter)
  ).sort((a,b) => a.name.localeCompare(b.name));

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'Administrador': return <UserCogIcon className="h-4 w-4 text-red-500" />;
      case 'Entrenador': return <UserCheck className="h-4 w-4 text-blue-500" />;
      case 'Jugador': return <UserPlayerIcon className="h-4 w-4 text-green-500" />;
      case 'Tutor': return <ShieldQuestion className="h-4 w-4 text-yellow-500" />;
      case 'Directivo Club': return <Briefcase className="h-4 w-4 text-purple-500" />;
      default: return <UserCogIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getClubName = (clubId: string | undefined) => clubs.find(c => c.id === clubId)?.name || 'N/A';
  const getTeamName = (teamId: string | undefined) => teams.find(t => t.id === teamId)?.name || 'N/A';
  const getPlayerName = (playerId: string | undefined) => players.find(p => p.id === playerId)?.name || 'N/A';

  const getManagedTeamNames = (teamIds: string[] | undefined) => {
    if (!teamIds || teamIds.length === 0) return 'Ninguno';
    return teamIds.map(id => teams.find(t => t.id === id)?.name || 'Desconocido').join(', ');
  };
  const getLinkedPlayerNames = (playerIds: string[] | undefined) => {
    if (!playerIds || playerIds.length === 0) return 'Ninguno';
    return playerIds.map(id => players.find(p => p.id === id)?.name || 'Desconocido').join(', ');
  };


  const handleDeleteUser = (user: DisplayUser) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        await deleteDoc(doc(db, "users", userToDelete.id));
        fetchPageData(); 
        toast({ title: "Usuario Eliminado", description: `El usuario "${userToDelete.name}" ha sido eliminado.` });
      } catch (error) {
        console.error(`Error deleting from users:`, error);
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar el usuario.", variant: "destructive" });
      } finally {
        setUserToDelete(null);
      }
    }
  };

  const handleNewUserInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "avatarUrl") {
      setNewUserData(prev => ({ ...prev, avatarUrl: value, avatarFile: null }));
      setAvatarPreviewDialogNewUser(value);
    } else {
      setNewUserData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNewUserAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewUserData(prev => ({...prev, avatarFile: file, avatarUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreviewDialogNewUser(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerNewUserFileInput = () => {
    newUserFileInputRef.current?.click();
  };

  const removeNewUserAvatar = () => {
    setNewUserData(prev => ({...prev, avatarFile: null, avatarUrl: ''}));
    setAvatarPreviewDialogNewUser(null);
    if (newUserFileInputRef.current) newUserFileInputRef.current.value = '';
  };


  const handleNewUserRoleChange = (value: UserRole) => {
    setNewUserData(prev => ({
      name: prev.name,
      email: prev.email,
      phone: prev.phone,
      avatarUrl: prev.avatarUrl,
      avatarFile: prev.avatarFile,
      role: value,
      clubId: (value !== 'Administrador' && prev.role !== 'Administrador' && prev.clubId) ? prev.clubId : undefined,
      teamId: undefined,
      managedTeamIds: [],
      playerId: undefined,
      linkedPlayerIds: [],
    }));
    setAvatarPreviewDialogNewUser(newUserData.avatarUrl || (newUserData.avatarFile ? avatarPreviewDialogNewUser : null));
  };

  const handleNewUserClubChange = (clubId: string) => {
    setNewUserData(prev => ({...prev, clubId, teamId: undefined, managedTeamIds: [], playerId: undefined, linkedPlayerIds: [] }));
  };

  const handleNewUserTeamChange = (teamId: string) => {
     setNewUserData(prev => ({...prev, teamId, playerId: undefined, linkedPlayerIds: [] }));
  };

  const handleNewUserPlayerIdChange = (playerId: string) => {
    setNewUserData(prev => ({...prev, playerId}));
  };

  const handleNewUserManagedTeamAssignment = (teamId: string, checked: boolean) => {
    setNewUserData(prev => {
      const currentManaged = prev.managedTeamIds || [];
      let newManagedTeamIds;
      if (checked) {
        if (currentManaged.length < 3) {
          newManagedTeamIds = [...currentManaged, teamId];
        } else {
          toast({ title: "Límite Alcanzado", description: "Un entrenador puede gestionar un máximo de 3 equipos.", variant: "destructive"});
          return prev;
        }
      } else {
        newManagedTeamIds = currentManaged.filter(id => id !== teamId);
      }
      return {...prev, managedTeamIds: newManagedTeamIds};
    });
  };

   const handleNewUserLinkedPlayerAssignment = (playerId: string, checked: boolean) => {
    setNewUserData(prev => {
      const currentLinked = prev.linkedPlayerIds || [];
      let newLinkedPlayerIds;
      if (checked) {
        if (currentLinked.length < 3) {
          newLinkedPlayerIds = [...currentLinked, playerId];
        } else {
          toast({ title: "Límite Alcanzado", description: "Un tutor puede vincular un máximo de 3 jugadores.", variant: "destructive"});
          return prev;
        }
      } else {
        newLinkedPlayerIds = currentLinked.filter(id => id !== playerId);
      }
      return {...prev, linkedPlayerIds: newLinkedPlayerIds};
    });
  };

  const handleGenerateAvatarForNewUser = async () => {
    if (!newUserData.name?.trim()) {
      toast({ title: "Nombre Requerido", description: "Introduce un nombre para generar el avatar.", variant: "destructive" });
      return;
    }
    setIsGeneratingAvatarNewUser(true);
    toast({ title: "Generando Avatar", description: "Creando un avatar..." });
    try {
      const avatarResult = await generateAvatar({ promptText: newUserData.name.trim(), entityType: 'user' });
      
      if (avatarResult.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande. Se usará uno por defecto. Intenta con un prompt más simple o sube una imagen.", variant: "default", duration: 7000 });
        setNewUserData(prev => ({ ...prev, avatarUrl: `https://placehold.co/80x80.png?text=${(prev.name || 'U')[0].toUpperCase()}`, avatarFile: null }));
        setAvatarPreviewDialogNewUser(`https://placehold.co/80x80.png?text=${(newUserData.name || 'U')[0].toUpperCase()}`);
      } else {
        setNewUserData(prev => ({ ...prev, avatarUrl: avatarResult.imageDataUri, avatarFile: null }));
        setAvatarPreviewDialogNewUser(avatarResult.imageDataUri);
        toast({ title: "Avatar Generado", description: "El avatar se ha creado con éxito." });
      }
    } catch (error) {
      console.error("Error generando avatar:", error);
      toast({ title: "Error de Avatar", description: "No se pudo generar el avatar.", variant: "destructive" });
    } finally {
      setIsGeneratingAvatarNewUser(false);
    }
  };

  const handleAddUserSubmit = async () => {
    if (!newUserData.name?.trim() || !newUserData.email?.trim() || !newUserData.role) {
      toast({ title: "Campos Incompletos", description: "Nombre, email y rol son obligatorios.", variant: "destructive" });
      return;
    }

    const email = newUserData.email!.trim().toLowerCase();
    
    const userEmailQuery = query(collection(db, "users"), where("email", "==", email), limit(1));
    const userEmailSnapshot = await getDocs(userEmailQuery);
    if (!userEmailSnapshot.empty) {
        toast({ title: "Email ya en Uso", description: "Ya existe un usuario (activo o pendiente) con este email.", variant: "destructive" });
        return;
    }

    if (newUserData.role !== 'Administrador' && !newUserData.clubId) {
      toast({ title: "Club Requerido", description: `Debes seleccionar un club para el rol ${newUserData.role}.`, variant: "destructive"}); return;
    }
    if (newUserData.role === 'Entrenador' && (!newUserData.managedTeamIds || newUserData.managedTeamIds.length === 0 || newUserData.managedTeamIds.length > 3)) {
      toast({ title: "Equipos Gestionados Requeridos", description: "Un entrenador debe gestionar entre 1 y 3 equipos.", variant: "destructive"}); return;
    }
    if (newUserData.role === 'Jugador' && (!newUserData.teamId || !newUserData.playerId)) {
      toast({ title: "Equipo y Jugador Vinculado Requeridos", description: "Debes seleccionar un equipo y un jugador específico.", variant: "destructive"}); return;
    }
    if (newUserData.role === 'Jugador' && users.some(u => u.role === 'Jugador' && u.playerId === newUserData.playerId)) {
      toast({ title: "Jugador Ya Vinculado", description: "Este jugador ya está vinculado a otro usuario.", variant: "destructive"}); return;
    }
    if (newUserData.role === 'Tutor' && (!newUserData.teamId || !newUserData.linkedPlayerIds || newUserData.linkedPlayerIds.length === 0 || newUserData.linkedPlayerIds.length > 3)) {
      toast({ title: "Jugadores Vinculados Requeridos", description: "Un tutor debe tener vinculado entre 1 y 3 jugadores.", variant: "destructive"}); return;
    }

    const userDocData: Record<string, any> = { 
      name: newUserData.name!,
      email: email,
      role: newUserData.role!,
      status: 'Pending',
      phone: newUserData.phone || null,
      clubId: newUserData.clubId || null,
      teamId: newUserData.teamId || null,
      managedTeamIds: newUserData.managedTeamIds || [],
      playerId: newUserData.playerId || null,
      linkedPlayerIds: newUserData.linkedPlayerIds || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(userDocData).forEach(key => {
      if (userDocData[key] === null || (Array.isArray(userDocData[key]) && userDocData[key].length === 0)) {
        delete userDocData[key];
      }
    });

    try {
      await addDoc(collection(db, "users"), userDocData);
      toast({ title: "Usuario Creado", description: `${userDocData.name} ha sido creado como pendiente. El usuario debe registrarse con el email ${userDocData.email} para activar su cuenta.` });
      fetchPageData();
      setIsAddUserDialogOpen(false);
      setNewUserData(initialNewUserDataState);
      setAvatarPreviewDialogNewUser(null);
    } catch (error) {
        console.error("Error creating user:", error);
        toast({ title: "Error al Crear Usuario", description: "No se pudo crear el usuario. " + (error as Error).message, variant: "destructive" });
    }
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setEditUserData({
      ...user,
      managedTeamIds: user.managedTeamIds ? [...user.managedTeamIds] : [],
      linkedPlayerIds: user.linkedPlayerIds ? [...user.linkedPlayerIds] : [],
      avatarFile: null,
    });
    setAvatarPreviewDialogEditUser(user.avatarUrl);
    setShowAvatarUrlInputEditUser(!!user.avatarUrl && !user.avatarUrl.startsWith('data:'));
    setIsGeneratingAvatarEditUser(false);
    setIsEditUserDialogOpen(true);
  };

  const handleEditUserInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "avatarUrl") {
      setEditUserData(prev => ({ ...prev, avatarUrl: value, avatarFile: null }));
      setAvatarPreviewDialogEditUser(value);
    } else {
      setEditUserData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditUserAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditUserData(prev => ({...prev, avatarFile: file, avatarUrl: ''}));
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreviewDialogEditUser(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowAvatarUrlInputEditUser(false);
    }
  };

  const triggerEditUserFileInput = () => {
    editUserAvatarFileInputRef.current?.click();
  };

  const removeEditUserAvatar = () => {
    setEditUserData(prev => ({...prev, avatarFile: null, avatarUrl: ''}));
    setAvatarPreviewDialogEditUser(null);
    if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = '';
    setShowAvatarUrlInputEditUser(false);
  };
  
  const toggleAvatarUrlInputEditUser = () => {
    setShowAvatarUrlInputEditUser(prev => {
      const newShowState = !prev;
      if (newShowState && editUserData.avatarFile) { 
        setAvatarPreviewDialogEditUser(editingUser?.avatarUrl || null); 
        setEditUserData(prevData => ({
          ...prevData,
          avatarFile: null, 
          avatarUrl: editingUser?.avatarUrl || '' 
        }));
        if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = "";
      }
      return newShowState;
    });
  };


  const handleGenerateAvatarForEditUser = async () => {
    if (!editUserData.name?.trim()) {
      toast({ title: "Nombre Requerido", description: "Introduce un nombre para generar el avatar.", variant: "destructive" });
      return;
    }
    setIsGeneratingAvatarEditUser(true);
    toast({ title: "Generando Avatar", description: "Actualizando el avatar..." });
    try {
      const avatarResult = await generateAvatar({ promptText: editUserData.name.trim(), entityType: 'user' });
      if (avatarResult.imageDataUri.length > MAX_AVATAR_URL_LENGTH) {
        toast({ title: "Avatar Muy Grande", description: "El avatar generado es demasiado grande. Se usará uno por defecto. Intenta con un prompt más simple o sube una imagen.", variant: "default", duration: 7000 });
        setEditUserData(prev => ({ ...prev, avatarUrl: `https://placehold.co/80x80.png?text=${(prev.name || 'U')[0].toUpperCase()}`, avatarFile: null }));
        setAvatarPreviewDialogEditUser(`https://placehold.co/80x80.png?text=${(editUserData.name || 'U')[0].toUpperCase()}`);
      } else {
        setEditUserData(prev => ({ ...prev, avatarUrl: avatarResult.imageDataUri, avatarFile: null }));
        setAvatarPreviewDialogEditUser(avatarResult.imageDataUri);
        toast({ title: "Avatar Generado", description: "El avatar se ha actualizado con éxito." });
      }
      setShowAvatarUrlInputEditUser(false); 
    } catch (error) {
      console.error("Error generando avatar:", error);
      toast({ title: "Error de Avatar", description: "No se pudo generar el avatar.", variant: "destructive" });
    } finally {
      setIsGeneratingAvatarEditUser(false);
    }
  };

  const handleEditUserRoleChange = (value: UserRole) => {
    setEditUserData(prev => ({
      ...prev,
      role: value,
      clubId: (value !== 'Administrador' && prev.role !== 'Administrador' && prev.clubId) ? prev.clubId : undefined,
      teamId: undefined,
      managedTeamIds: [],
      playerId: undefined,
      linkedPlayerIds: [],
    }));
  };

  const handleEditUserClubChange = (clubId: string) => {
    setEditUserData(prev => ({...prev, clubId, teamId: undefined, managedTeamIds: [], playerId: undefined, linkedPlayerIds: [] }));
  };

  const handleEditUserTeamChange = (teamId: string) => {
     setEditUserData(prev => ({...prev, teamId, playerId: undefined, linkedPlayerIds: [] }));
  };

  const handleEditUserPlayerIdChange = (playerId: string) => {
    setEditUserData(prev => ({...prev, playerId}));
  };

  const handleEditUserManagedTeamAssignment = (teamId: string, checked: boolean) => {
    setEditUserData(prev => {
      const currentManaged = prev.managedTeamIds || [];
      let newManagedTeamIds;
      if (checked) {
        if (currentManaged.length < 3) {
          newManagedTeamIds = [...currentManaged, teamId];
        } else {
          toast({ title: "Límite Alcanzado", description: "Un entrenador puede gestionar un máximo de 3 equipos.", variant: "destructive"});
          return prev;
        }
      } else {
        newManagedTeamIds = currentManaged.filter(id => id !== teamId);
      }
      return {...prev, managedTeamIds: newManagedTeamIds};
    });
  };

   const handleEditUserLinkedPlayerAssignment = (playerId: string, checked: boolean) => {
    setEditUserData(prev => {
      const currentLinked = prev.linkedPlayerIds || [];
      let newLinkedPlayerIds;
      if (checked) {
        if (currentLinked.length < 3) {
          newLinkedPlayerIds = [...currentLinked, playerId];
        } else {
          toast({ title: "Límite Alcanzado", description: "Un tutor puede vincular un máximo de 3 jugadores.", variant: "destructive"});
          return prev;
        }
      } else {
        newLinkedPlayerIds = currentLinked.filter(id => id !== playerId);
      }
      return {...prev, linkedPlayerIds: newLinkedPlayerIds};
    });
  };

  const handleSaveChanges = async () => {
    if (!editingUser || !editUserData.name?.trim() || !editUserData.email?.trim() || !editUserData.role) {
      toast({ title: "Campos Incompletos", description: "Nombre, email y rol son obligatorios.", variant: "destructive" }); return;
    }
    if (editUserData.role !== 'Administrador' && !editUserData.clubId) {
      toast({ title: "Club Requerido", description: `Debes seleccionar un club para el rol ${editUserData.role}.`, variant: "destructive"}); return;
    }
     if (editUserData.role === 'Entrenador' && (!editUserData.managedTeamIds || editUserData.managedTeamIds.length === 0 || editUserData.managedTeamIds.length > 3)) {
      toast({ title: "Equipos Gestionados Requeridos", description: "Un entrenador debe gestionar entre 1 y 3 equipos.", variant: "destructive"}); return;
    }
    if (editUserData.role === 'Jugador' && (!editUserData.teamId || !editUserData.playerId)) {
      toast({ title: "Equipo y Jugador Vinculado Requeridos", description: "Debes seleccionar un equipo y un jugador específico.", variant: "destructive"}); return;
    }
    if (editUserData.role === 'Jugador' && editUserData.playerId && users.some(u => u.id !== editingUser.id && u.role === 'Jugador' && u.playerId === editUserData.playerId)) {
      toast({ title: "Jugador Ya Vinculado", description: "Este jugador ya está vinculado a OTRO usuario.", variant: "destructive"}); return;
    }
    if (editUserData.role === 'Tutor' && (!editUserData.teamId || !editUserData.linkedPlayerIds || editUserData.linkedPlayerIds.length === 0 || editUserData.linkedPlayerIds.length > 3)) {
      toast({ title: "Jugadores Vinculados Requeridos", description: "Un tutor debe tener vinculado entre 1 y 3 jugadores.", variant: "destructive"}); return;
    }

    let finalAvatarUrl = editUserData.avatarUrl;
    if (editUserData.avatarFile && avatarPreviewDialogEditUser && avatarPreviewDialogEditUser.startsWith('data:')) {
        finalAvatarUrl = avatarPreviewDialogEditUser;
    } else if (avatarPreviewDialogEditUser && !avatarPreviewDialogEditUser.startsWith('data:')) { 
        finalAvatarUrl = avatarPreviewDialogEditUser;
    } else if (avatarPreviewDialogEditUser === null) { 
        finalAvatarUrl = undefined;
    }

    if (finalAvatarUrl && finalAvatarUrl.length > MAX_AVATAR_URL_LENGTH) {
      toast({ title: "Avatar Muy Grande", description: "El avatar es demasiado grande para guardarlo. Se usará el avatar anterior o uno por defecto.", variant: "default", duration: 5000 });
      finalAvatarUrl = editingUser.avatarUrl || `https://placehold.co/80x80.png?text=${(editUserData.name || 'U')[0].toUpperCase()}`;
    }

    const userUpdates: any = {
        name: editUserData.name!,
        email: editUserData.email!.trim().toLowerCase(),
        role: editUserData.role!,
        updatedAt: serverTimestamp(),
    };
    
    userUpdates.phone = (editUserData.phone && editUserData.phone.trim() !== '') ? editUserData.phone.trim() : firestoreDeleteField();
    userUpdates.avatarUrl = (finalAvatarUrl && finalAvatarUrl.trim() !== '') ? finalAvatarUrl.trim() : firestoreDeleteField();
    
    if (editUserData.role === 'Administrador') {
        userUpdates.clubId = firestoreDeleteField();
        userUpdates.teamId = firestoreDeleteField();
        userUpdates.managedTeamIds = firestoreDeleteField();
        userUpdates.playerId = firestoreDeleteField();
        userUpdates.linkedPlayerIds = firestoreDeleteField();
    } else {
        userUpdates.clubId = editUserData.clubId || firestoreDeleteField();
        if (editUserData.role === 'Entrenador') {
            userUpdates.managedTeamIds = editUserData.managedTeamIds && editUserData.managedTeamIds.length > 0 ? editUserData.managedTeamIds : firestoreDeleteField();
            userUpdates.teamId = firestoreDeleteField();
            userUpdates.playerId = firestoreDeleteField();
            userUpdates.linkedPlayerIds = firestoreDeleteField();
        } else {
            userUpdates.managedTeamIds = firestoreDeleteField();
            if (editUserData.role === 'Jugador' || editUserData.role === 'Tutor') {
                userUpdates.teamId = editUserData.teamId || firestoreDeleteField();
            } else {
                userUpdates.teamId = firestoreDeleteField();
            }

            if (editUserData.role === 'Jugador') {
                userUpdates.playerId = editUserData.playerId || firestoreDeleteField();
                userUpdates.linkedPlayerIds = firestoreDeleteField();
            } else {
                userUpdates.playerId = firestoreDeleteField();
            }

            if (editUserData.role === 'Tutor') {
                userUpdates.linkedPlayerIds = editUserData.linkedPlayerIds && editUserData.linkedPlayerIds.length > 0 ? editUserData.linkedPlayerIds : firestoreDeleteField();
            } else {
                userUpdates.linkedPlayerIds = firestoreDeleteField();
            }
        }
    }
    
    try {
      const userDocRef = doc(db, "users", editingUser.id);
      await updateDoc(userDocRef, userUpdates);
      fetchPageData();
      toast({ title: "Usuario Actualizado", description: `Los datos de ${userUpdates.name} han sido actualizados.` });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user in Firestore:", error); 
      toast({ title: "Error al Guardar", description: "No se pudo actualizar el usuario. Revisa la consola para más detalles. " + (error as Error).message, variant: "destructive" });
    }
  };
  
  const addUserDialogActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAddUserSubmit}
            disabled={isGeneratingAvatarNewUser}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            {isGeneratingAvatarNewUser ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Guardar Usuario</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const editUserDialogActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSaveChanges}
            disabled={isGeneratingAvatarEditUser}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            {isGeneratingAvatarEditUser ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Guardar Cambios</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (isLoading) {
    return <div className="p-4 text-center">Cargando usuarios...</div>;
  }

  return (
    <div className="space-y-6">
       <ModernDialog 
        isOpen={isAddUserDialogOpen} 
        onClose={() => {
          setIsAddUserDialogOpen(false);
          setNewUserData(initialNewUserDataState);
          setAvatarPreviewDialogNewUser(null);
        }}
        title="Invitar Nuevo Usuario"
        icon={MailPlus}
        size="xl"
        type="info"
        headerActions={addUserDialogActions}
      >
        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="pt-4 space-y-4">
             {/* Info content */}
          </TabsContent>
          <TabsContent value="assignments" className="pt-4 space-y-4">
              {/* Assignments content */}
          </TabsContent>
        </Tabs>
      </ModernDialog>

      <Card className="shadow-lg">
        <CardContent className="pt-6">
           <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto lg:flex-1">
              <div className="relative flex-1 w-full sm:min-w-[200px] sm:w-auto">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuario..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={(value: UserRole | 'all') => setRoleFilter(value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Roles</SelectItem>
                  {placeholderUserRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || roleFilter !== 'all') && (
                <Button variant="ghost" onClick={() => {setSearchTerm(''); setRoleFilter('all');}} className="text-sm w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" /> Limpiar filtros
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto justify-start lg:justify-end mt-2 lg:mt-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant={viewMode === 'card' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('card')} aria-label="Vista de tarjetas">
                       <LayoutGrid className="h-5 w-5" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Vista de Tarjetas</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')} aria-label="Vista de Lista">
                      <ListIcon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Vista de Lista</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <UserCogIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay usuarios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                 {searchTerm || roleFilter !== 'all' ? "No se encontraron usuarios que coincidan con tu búsqueda/filtro." : "Empieza invitando a un nuevo usuario."}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <CardHeader className="items-center text-center p-4">
                    <Avatar className="h-20 w-20 border-2 border-primary mb-2">
                      <AvatarImage src={user.avatarUrl || `https://placehold.co/80x80.png`} alt={user.name} data-ai-hint="user avatar" />
                      <AvatarFallback className="text-2xl">{user.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-lg font-headline">{user.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5">{getRoleIcon(user.role)}{user.role}</CardDescription>
                     {user.status === 'Invitación Pendiente' && <Badge variant="secondary">Invitación Pendiente</Badge>}
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground text-center flex-grow">
                    <p className="truncate" title={user.email}>{user.email}</p>
                    {user.phone && <p className="truncate" title={user.phone}><PhoneIcon className="inline h-3 w-3 mr-1"/>{user.phone}</p>}
                    {user.clubId && user.role !== 'Administrador' && <p><Building className="inline h-3 w-3 mr-1"/>Club: {getClubName(user.clubId)}</p>}
                  </CardContent>
                  <CardFooter className="p-3 border-t flex justify-end gap-1">
                     <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(user)} disabled={user.status === 'Invitación Pendiente'}>
                        <Edit3 className="mr-2 h-3.5 w-3.5" />Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] hidden sm:table-cell">Avatar</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden lg:table-cell">Detalles Rol</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={cn(user.status === 'Invitación Pendiente' && "bg-muted/50")}>
                      <TableCell className="hidden sm:table-cell">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl || `https://placehold.co/36x36.png`} alt={user.name} data-ai-hint="user avatar" />
                          <AvatarFallback>{user.name.substring(0,1)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {user.name}
                        {user.status === 'Invitación Pendiente' && <Badge variant="outline" className="ml-2 text-xs">Invitación Pendiente</Badge>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                         <Select value={user.role} onValueChange={(value: UserRole) => handleRoleChangeOnTable(user.id, value)} disabled={user.status === 'Invitación Pendiente'}>
                          <SelectTrigger className="h-8 text-xs w-[130px] sm:w-auto">
                            <SelectValue placeholder="Rol" />
                          </SelectTrigger>
                          <SelectContent>
                            {placeholderUserRoles.map(role => (
                              <SelectItem key={role} value={role}>
                                <div className="flex items-center gap-1.5">{getRoleIcon(role)} {role}</div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {user.clubId && user.role !== 'Administrador' && (<div><Building className="inline h-3 w-3 mr-1"/>Club: {getClubName(user.clubId)}</div>)}
                        {user.role === 'Entrenador' && (<div><UsersIcon className="inline h-3 w-3 mr-1"/>Gestiona: {getManagedTeamNames(user.managedTeamIds)}</div>)}
                        {user.role === 'Jugador' && (<div><UsersIcon className="inline h-3 w-3 mr-1"/>Eq: {getTeamName(user.teamId)} - <UserPlayerIcon className="inline h-3 w-3 mr-1"/>Jug: {getPlayerName(user.playerId)}</div>)}
                        {user.role === 'Tutor' && (<div><UsersIcon className="inline h-3 w-3 mr-1"/>Tutor de: {getLinkedPlayerNames(user.linkedPlayerIds)}</div>)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(user)} disabled={user.status === 'Invitación Pendiente'}>
                              <Edit3 className="mr-1 h-3.5 w-3.5 sm:mr-2" /><span className="hidden sm:inline">Editar</span>
                          </Button>
                           <Button variant="ghost" size="icon" aria-label="Eliminar usuario" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteUser(user)}>
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

      <ModernDialog 
        isOpen={isEditUserDialogOpen} 
        onClose={() => setIsEditUserDialogOpen(false)}
        title={`Editar Usuario: ${editingUser?.name}`}
        icon={Edit3}
        size="xl"
        type="info"
        headerActions={editUserDialogActions}
      >
        <Tabs defaultValue="info" className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
              </TabsList>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
            <TabsContent value="info" className="pt-4 space-y-4 mt-0">
               <div className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="profile-edit-name">Nombre*</Label>
                      <Input
                        id="profile-edit-name"
                        name="name"
                        value={editUserData.name || ''}
                        onChange={handleEditUserInputChange}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-edit-email">Email*</Label>
                      <Input
                        id="profile-edit-email"
                        name="email"
                        type="email"
                        value={editUserData.email || ''}
                        disabled
                      />
                       <p className="text-xs text-muted-foreground">El email no se puede cambiar.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-edit-phone">Teléfono</Label>
                      <Input
                        id="profile-edit-phone"
                        name="phone"
                        type="tel"
                        value={editUserData.phone || ''}
                        onChange={handleEditUserInputChange}
                      />
                    </div>
                  </div>

                  <Separator className="my-6"/>
                  <h4 className="font-semibold text-primary border-b pb-1">Avatar</h4>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border">
                        <AvatarImage src={avatarPreviewDialogEditUser || `https://placehold.co/80x80.png`} alt="Avatar Preview" data-ai-hint="user avatar"/>
                        <AvatarFallback>{editUserData.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2 flex-1">
                          <Button type="button" variant="outline" size="sm" onClick={triggerEditUserFileInput} className="w-full">
                              <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                          </Button>
                          <input type="file" ref={editUserAvatarFileInputRef} onChange={handleEditUserAvatarFileChange} accept="image/*" className="hidden"/>
                      </div>
                    </div>
                    {editUserData.name?.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAvatarForEditUser}
                        disabled={isGeneratingAvatarEditUser || !editUserData.name?.trim()}
                        className="w-full mt-2"
                      >
                        <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingAvatarEditUser && "animate-spin")} />
                        {isGeneratingAvatarEditUser ? "Generando..." : "Generar Avatar con IA"}
                      </Button>
                    )}
                    {avatarPreviewDialogEditUser && (
                      <Button type="button" variant="link" size="sm" onClick={removeEditUserAvatar} className="text-xs text-destructive p-0 h-auto mt-1">
                        <X className="mr-1 h-3 w-3"/> Quitar avatar
                      </Button>
                    )}
                  </div>
            </TabsContent>
            <TabsContent value="assignments" className="pt-4 space-y-4 mt-0">
               <div className="space-y-4">
                  <div className="space-y-1">
                      <Label htmlFor="edit-user-role">Rol del Usuario</Label>
                       <Select value={editUserData.role || ''} onValueChange={(value: UserRole) => handleEditUserRoleChange(value)} disabled={editingUser?.status === 'Pending'}>
                          <SelectTrigger id="edit-user-role"><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                          <SelectContent>{placeholderUserRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent>
                       </Select>
                  </div>

                  {editUserData.role && editUserData.role !== 'Administrador' && (
                    <div className="space-y-1">
                      <Label htmlFor="edit-user-club">Club Asignado</Label>
                      <Select value={editUserData.clubId || ''} onValueChange={handleEditUserClubChange}>
                          <SelectTrigger id="edit-user-club"><SelectValue placeholder="Selecciona un club" /></SelectTrigger>
                          <SelectContent>{clubs.map(club => (<SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {editUserData.role === 'Entrenador' && editUserData.clubId && (
                    <div className="space-y-2">
                      <Label>Equipos que Gestiona (máx. 3)</Label>
                      <ScrollArea className="h-32 border rounded-md p-2">
                        <div className="space-y-1">
                            {teams.filter(t => t.clubId === editUserData.clubId).map(team => (
                                <div key={team.id} className="flex items-center space-x-2">
                                    <Checkbox id={`edit-managed-${team.id}`} checked={editUserData.managedTeamIds?.includes(team.id)} onCheckedChange={(checked) => handleEditUserManagedTeamAssignment(team.id, !!checked)} />
                                    <Label htmlFor={`edit-managed-${team.id}`} className="font-normal">{team.name}</Label>
                                </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {(editUserData.role === 'Jugador' || editUserData.role === 'Tutor') && editUserData.clubId && (
                     <div className="space-y-1">
                        <Label>Equipo del Jugador/Tutor</Label>
                        <Select value={editUserData.teamId || ''} onValueChange={handleEditUserTeamChange}>
                          <SelectTrigger><SelectValue placeholder="Selecciona un equipo" /></SelectTrigger>
                          <SelectContent>{teams.filter(t => t.clubId === editUserData.clubId).map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}</SelectContent>
                        </Select>
                     </div>
                  )}

                  {editUserData.role === 'Jugador' && editUserData.teamId && (
                     <div className="space-y-1">
                        <Label>Jugador Vinculado</Label>
                        <Select value={editUserData.playerId || ''} onValueChange={handleEditUserPlayerIdChange}>
                          <SelectTrigger><SelectValue placeholder="Selecciona un jugador" /></SelectTrigger>
                          <SelectContent>
                            {players.filter(p => p.teamId === editUserData.teamId).map(player => (<SelectItem key={player.id} value={player.id}>{player.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                     </div>
                  )}

                  {editUserData.role === 'Tutor' && editUserData.teamId && (
                    <div className="space-y-2">
                        <Label>Jugadores Vinculados al Tutor (máx. 3)</Label>
                        <ScrollArea className="h-32 border rounded-md p-2">
                            <div className="space-y-1">
                                {players.filter(p => p.teamId === editUserData.teamId).map(player => (
                                    <div key={player.id} className="flex items-center space-x-2">
                                        <Checkbox id={`edit-linked-${player.id}`} checked={editUserData.linkedPlayerIds?.includes(player.id)} onCheckedChange={(checked) => handleEditUserLinkedPlayerAssignment(player.id, !!checked)} />
                                        <Label htmlFor={`edit-linked-${player.id}`} className="font-normal">{player.name}</Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                  )}
              </div>
            </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </ModernDialog>


      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Seguro que quieres eliminar a "{userToDelete.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el registro de la base de datos.
                {userToDelete.status === 'Active' && ' La cuenta de autenticación de Firebase asociada NO será eliminada.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard allowedRoles={['Administrador']}>
      <UsersPageContent />
    </AuthGuard>
  );
}

    