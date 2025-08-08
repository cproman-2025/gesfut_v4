
'use client';

import { useState, useEffect, type ChangeEvent, useRef } from 'react';
import { db, auth } from '@/lib/firebase'; // Importar auth
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth'; // Importar funciones de Auth
import type { User, Club, Team, Player } from '@/types';
import {
  placeholderClubs,
  placeholderTeams,
  placeholderPlayers
} from '@/lib/placeholder-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Shield, UserCircle2, Edit3, KeyRound, Building, Users as UsersIcon, User as UserPlayerIcon, UploadCloud, Sparkles, X, Link as LinkIcon, Phone as PhoneIcon, Loader2 } from 'lucide-react'; // Importar Loader2
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { generateAvatar } from '@/ai/flows/generate-avatar-flow';
import { cn } from '@/lib/utils';
import AuthGuard from '@/components/auth/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';

const MAX_AVATAR_URL_LENGTH = 700000;

function ProfilePageContent() {
  const { userProfile, authUser, isLoading: authLoading, logout: authLogout, fetchUserProfile } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<Partial<User> & { avatarFile?: File | null }>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false); // Estado para el loader

  const [isGeneratingAvatarEditUser, setIsGeneratingAvatarEditUser] = useState(false);
  const [avatarPreviewDialogEditUser, setAvatarPreviewDialogEditUser] = useState<string | null>(null);
  const editUserAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [showAvatarUrlInputEditUser, setShowAvatarUrlInputEditUser] = useState(false);


  useEffect(() => {
    if (userProfile) {
      setCurrentUser(userProfile);
    }
  }, [userProfile]);

  const getClubName = (clubId?: string): string | null => {
    if (!clubId) return null;
    return placeholderClubs.find(c => c.id === clubId)?.name || null;
  };

  const getTeamName = (teamId?: string): string | null => {
    if (!teamId) return null;
    return placeholderTeams.find(t => t.id === teamId)?.name || null;
  };

  const getPlayerName = (playerId?: string): string | null => {
    if(!playerId) return null;
    return placeholderPlayers.find(p => p.id === playerId)?.name || null;
  }

  const getManagedTeamNames = (teamIds?: string[]): string => {
    if (!teamIds || teamIds.length === 0) return 'Ninguno';
    return teamIds.map(id => getTeamName(id) || 'Desconocido').join(', ');
  };

  const getLinkedPlayerNames = (playerIds?: string[]): string => {
    if (!playerIds || playerIds.length === 0) return 'Ninguno';
    return playerIds.map(id => getPlayerName(id) || 'Desconocido').join(', ');
  };


  const handleOpenEditDialog = () => {
    if (currentUser) {
      setEditUserData({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        avatarUrl: currentUser.avatarUrl || '',
        avatarFile: null,
      });
      setAvatarPreviewDialogEditUser(currentUser.avatarUrl || null);
      setIsGeneratingAvatarEditUser(false);
      setShowAvatarUrlInputEditUser(false);
      setIsEditDialogOpen(true);
    }
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({ ...prev, [name]: value }));
    if (name === "avatarUrl") { 
        setAvatarPreviewDialogEditUser(value || null);
        setEditUserData(prev => ({...prev, avatarFile: null})); 
        if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = "";
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

  const triggerEditUserAvatarFileInput = () => {
    editUserAvatarFileInputRef.current?.click();
  };

  const removeEditUserAvatar = () => {
    setEditUserData(prev => ({...prev, avatarFile: null, avatarUrl: ''}));
    setAvatarPreviewDialogEditUser(null);
    if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = '';
    setShowAvatarUrlInputEditUser(false);
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
        const fallbackUrl = `https://placehold.co/80x80.png?text=${(editUserData.name || 'U')[0].toUpperCase()}`;
        setEditUserData(prev => ({ ...prev, avatarUrl: fallbackUrl, avatarFile: null }));
        setAvatarPreviewDialogEditUser(fallbackUrl);
      } else {
        setEditUserData(prev => ({ ...prev, avatarUrl: avatarResult.imageDataUri, avatarFile: null }));
        setAvatarPreviewDialogEditUser(avatarResult.imageDataUri);
        toast({ title: "Avatar Generado", description: "El avatar se ha actualizado con éxito." });
      }
      setShowAvatarUrlInputEditUser(false); 
      if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = "";
    } catch (error) {
      console.error("Error generando avatar:", error);
      toast({ title: "Error de Avatar", description: "No se pudo generar el avatar.", variant: "destructive" });
    } finally {
      setIsGeneratingAvatarEditUser(false);
    }
  };

  const toggleAvatarUrlInputEditUser = () => {
    setShowAvatarUrlInputEditUser(prev => {
        const newShowState = !prev;
        if (newShowState && editUserData.avatarFile) { 
            setAvatarPreviewDialogEditUser(currentUser?.avatarUrl || null); 
            setEditUserData(prevData => ({...prevData, avatarFile: null, avatarUrl: currentUser?.avatarUrl || ''}));
            if (editUserAvatarFileInputRef.current) editUserAvatarFileInputRef.current.value = "";
        } else if (!newShowState && !editUserData.avatarFile) { 
            
        }
        return newShowState;
    });
  };


  const handleSaveChanges = async () => {
    if (!currentUser || !authUser) return;
    if (!editUserData.name?.trim() || !editUserData.email?.trim()) {
      toast({
        title: "Campos Incompletos",
        description: "El nombre y el email son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    if (editUserData.email !== currentUser.email) {
        console.warn("Cambio de email detectado. La actualización de email en Firebase Auth requiere reautenticación y no se implementa aquí. Solo se actualizará en Firestore.");
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
      toast({ title: "Avatar Muy Grande", description: "El avatar es demasiado grande. Se usará el avatar anterior o uno por defecto.", variant: "default", duration: 5000 });
      finalAvatarUrl = currentUser.avatarUrl || `https://placehold.co/80x80.png?text=${(editUserData.name || 'U')[0].toUpperCase()}`;
    }


    const updatedUserData: Partial<User> = {
      name: editUserData.name,
      email: editUserData.email,
      updatedAt: serverTimestamp() as any,
    };
    
    if (editUserData.phone !== undefined) {
      updatedUserData.phone = editUserData.phone === '' ? deleteField() as any : editUserData.phone;
    }
    
    if (finalAvatarUrl !== undefined) { 
        updatedUserData.avatarUrl = finalAvatarUrl;
    } else if (finalAvatarUrl === undefined && currentUser.avatarUrl) { 
        updatedUserData.avatarUrl = deleteField() as any;
    }

    try {
      const userDocRef = doc(db, "users", currentUser.id);
      await updateDoc(userDocRef, updatedUserData);

      await fetchUserProfile(authUser.uid);

      toast({
        title: "Perfil Actualizado",
        description: "Tu información de perfil ha sido actualizada en Firestore.",
      });
      setIsEditDialogOpen(false);
    } catch (error) {
        console.error("Error updating user profile in Firestore:", error);
        toast({ title: "Error al Actualizar", description: "No se pudo actualizar tu perfil en Firestore.", variant: "destructive" });
    }
  };

  const handlePasswordInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'currentPassword') setCurrentPassword(value);
    else if (name === 'newPassword') setNewPassword(value);
    else if (name === 'confirmPassword') setConfirmPassword(value);
  };

  const handlePasswordChangeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPasswordChanging(true);

    if (!authUser || !authUser.email) {
      toast({ title: "Error", description: "Usuario no autenticado o email no disponible.", variant: "destructive" });
      setIsPasswordChanging(false);
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Campos Incompletos", description: "Por favor, rellena todos los campos de contraseña.", variant: "destructive" });
      setIsPasswordChanging(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Contraseñas no Coinciden", description: "La nueva contraseña y la confirmación no coinciden.", variant: "destructive" });
      setIsPasswordChanging(false);
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Contraseña Débil", description: "La nueva contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      setIsPasswordChanging(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, newPassword);
      toast({ title: "Contraseña Cambiada", description: "Tu contraseña ha sido actualizada con éxito." });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const authError = error as AuthError;
      console.error("Error al cambiar la contraseña:", authError);
      let errorMessage = "Ocurrió un error al cambiar la contraseña.";
      if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
        errorMessage = "La contraseña actual es incorrecta.";
      } else if (authError.code === 'auth/weak-password') {
        errorMessage = "La nueva contraseña es demasiado débil.";
      } else if (authError.code === 'auth/requires-recent-login') {
        errorMessage = "Esta operación es sensible y requiere autenticación reciente. Por favor, vuelve a iniciar sesión e inténtalo de nuevo.";
      }
      toast({ title: "Error al Cambiar Contraseña", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordChanging(false);
    }
  };


  if (authLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p>Cargando perfil...</p>
      </div>
    );
  }

  const clubName = getClubName(currentUser.clubId);
  const teamName = getTeamName(currentUser.teamId);
  const managedTeamsString = getManagedTeamNames(currentUser.managedTeamIds);
  const linkedPlayersString = getLinkedPlayerNames(currentUser.linkedPlayerIds);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-headline">Mi Perfil</CardTitle>
              <CardDescription>Visualiza y gestiona la información de tu cuenta.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 p-6 border rounded-lg bg-muted/30 shadow-sm">
            <Avatar className="h-24 w-24 border-2 border-primary shadow-md">
              <AvatarImage src={currentUser.avatarUrl || `https://placehold.co/96x96.png`} alt={currentUser.name} data-ai-hint="user avatar" />
              <AvatarFallback className="text-3xl">{currentUser.name.substring(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h2 className="text-2xl font-semibold font-headline">{currentUser.name}</h2>
              <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <Mail className="h-4 w-4" />
                {currentUser.email}
              </p>
              {currentUser.phone && (
                <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <PhoneIcon className="h-4 w-4" />
                  {currentUser.phone}
                </p>
              )}
              <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <Shield className="h-4 w-4" />
                Rol: {currentUser.role}
              </p>
              {currentUser.role !== 'Administrador' && clubName && (
                <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <Building className="h-4 w-4" />
                  Club: {clubName}
                </p>
              )}
              {currentUser.role === 'Entrenador' && (
                <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <UsersIcon className="h-4 w-4" />
                  Gestiona: {managedTeamsString}
                </p>
              )}
              {(currentUser.role === 'Jugador' || currentUser.role === 'Tutor') && teamName && (
                 <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <UsersIcon className="h-4 w-4" />
                  Equipo: {teamName}
                </p>
              )}
               {currentUser.role === 'Jugador' && currentUser.playerId && (
                <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <UserPlayerIcon className="h-4 w-4" />
                  Perfil Jugador Vinculado: {getPlayerName(currentUser.playerId)}
                </p>
              )}
              {currentUser.role === 'Tutor' && (
                 <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <UserPlayerIcon className="h-4 w-4" />
                  Tutelados Vinculados: {linkedPlayersString}
                </p>
              )}
            </div>

            <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
                setIsEditDialogOpen(isOpen);
                if (!isOpen) {
                    setEditUserData({});
                    setAvatarPreviewDialogEditUser(null);
                    setShowAvatarUrlInputEditUser(false);
                }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto self-start sm:self-center" onClick={handleOpenEditDialog}>
                  <Edit3 className="mr-2 h-4 w-4" /> Editar Perfil
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-headline">Editar Detalles Personales</DialogTitle>
                  <DialogDescription>Modifica tu nombre, teléfono o avatar.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mr-3 pr-3">
                <div className="space-y-4 py-4 px-4">
                  <h4 className="font-semibold text-primary border-b pb-1">Información de Contacto</h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="profile-edit-name">Nombre*</Label>
                      <Input
                        id="profile-edit-name"
                        name="name"
                        value={editUserData.name || ''}
                        onChange={handleEditInputChange}
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
                        onChange={handleEditInputChange}
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
                          <Button type="button" variant="outline" size="sm" onClick={triggerEditUserAvatarFileInput} className="w-full">
                              <UploadCloud className="mr-2 h-4 w-4" /> Subir Archivo
                          </Button>
                          <input type="file" ref={editUserAvatarFileInputRef} onChange={handleEditUserAvatarFileChange} accept="image/*" className="hidden"/>
                          <Button type="button" variant="outline" size="sm" onClick={toggleAvatarUrlInputEditUser} className="w-full">
                             <LinkIcon className="mr-2 h-4 w-4" /> {showAvatarUrlInputEditUser ? "Ocultar URL" : "Introducir URL"}
                          </Button>
                      </div>
                    </div>
                    {showAvatarUrlInputEditUser && (
                      <Input
                          name="avatarUrl"
                          value={(avatarPreviewDialogEditUser && !avatarPreviewDialogEditUser.startsWith('data:')) ? avatarPreviewDialogEditUser : ''}
                          onChange={handleEditInputChange}
                          placeholder="Pega una URL de imagen"
                          className="h-9 text-sm mt-2"
                      />
                    )}
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
                        <X className="mr-1 h-3 w-3"/> Quitar avatar actual/seleccionado
                      </Button>
                    )}
                  </div>
                </div>
                </ScrollArea>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isGeneratingAvatarEditUser}>Cancelar</Button>
                  <Button type="button" onClick={handleSaveChanges} disabled={isGeneratingAvatarEditUser}>
                     {isGeneratingAvatarEditUser && <Sparkles className="mr-2 h-4 w-4 animate-spin"/>}
                    Guardar Cambios
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Cambiar Contraseña
              </CardTitle>
              <CardDescription>Actualiza tu contraseña de acceso.</CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordChangeSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Introduce tu contraseña actual"
                    disabled={isPasswordChanging}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Introduce tu nueva contraseña (mín. 6 caracteres)"
                    disabled={isPasswordChanging}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Vuelve a introducir tu nueva contraseña"
                    disabled={isPasswordChanging}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isPasswordChanging}>
                  {isPasswordChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Nueva Contraseña
                </Button>
              </CardFooter>
            </form>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfilePageContent />
    </AuthGuard>
  );
}
