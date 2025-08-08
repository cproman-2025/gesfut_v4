

'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteField as firestoreDeleteField } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import AuthGuard from '@/components/auth/auth-guard';
import { Settings as SettingsIcon, Loader2, Palette, Sun, Moon, CheckSquare, Fingerprint, Paintbrush, Shield, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import type { AppSettings, UserRole, Club } from '@/types';
import { mainNavItems } from '@/lib/navigation';
import { placeholderUserRoles } from '@/lib/placeholder-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';

const lightThemes = [
  { name: 'Predeterminado', value: 'default', description: 'El tema original azul y rosa.', colors: ['#29ABE2', '#DB92C8', '#F0F0F0'] },
  { name: 'Azul Corporativo', value: 'theme-azul-corporativo', description: 'Paleta profesional con tonos de azul pizarra y cielo.', colors: ['#2C3E50', '#3498DB', '#EFF2F7'] },
  { name: 'Cohesión de Marca', value: 'theme-cohesion-marca', description: 'Tema elegante centrado en el púrpura de la marca.', colors: ['#7E57C2', '#607D8B', '#F4F2F7'] },
];

const darkThemes = [
  { name: 'Energía y Enfoque', value: 'dark', description: 'El tema oscuro original de alto contraste y verde.', colors: ['#14B8A6', '#1E293B', '#0F172A'] },
  { name: 'Azul Corporativo', value: 'theme-azul-corporativo-dark', description: 'Una paleta oscura, profesional y azulada.', colors: ['#3498DB', '#2C3E50', '#1D2D3C'] },
  { name: 'Cohesión de Marca', value: 'theme-cohesion-marca-dark', description: 'Tema oscuro con elegantes acentos púrpura.', colors: ['#7E57C2', '#4527A0', '#1A237E'] },
];

const allThemeClasses = [...lightThemes.map(t => t.value), ...darkThemes.map(t => t.value)].filter(t => t !== 'default' && t !== 'dark');


function SettingsPageContent() {
  const { userProfile, isLoading: authLoading, fetchUserProfile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const [lightTheme, setLightTheme] = useState('default');
  const [darkTheme, setDarkTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'appearance'>('general');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isClubsLoading, setIsClubsLoading] = useState(true);
  const [authLogoPreview, setAuthLogoPreview] = useState<string | null>(null);

  const settingsDocRef = doc(db, "appSettings", "global");

  useEffect(() => {
    const fetchSettingsAndClubs = async () => {
      setIsLoading(true);
      setIsClubsLoading(true);
      try {
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          const appSettings = settingsSnap.data() as AppSettings;
          setSettings(appSettings);
          setAuthLogoPreview(appSettings.authPagesCustomLogoUrl || null);
        } else {
          const defaultPermissions: Record<string, UserRole[]> = {};
          mainNavItems.forEach(item => {
            defaultPermissions[item.href] = ['Administrador'];
          });
          const defaultSettings: AppSettings = { 
            isRegistrationEnabled: true,
            menuPermissions: defaultPermissions,
            defaultLightTheme: 'default',
            defaultDarkTheme: 'dark',
          };
          await setDoc(settingsDocRef, { ...defaultSettings, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          setSettings(defaultSettings);
        }

        if (userProfile) {
            setLightTheme(userProfile.lightTheme || localStorage.getItem('gesfut-light-theme') || 'default');
            setDarkTheme(userProfile.darkTheme || localStorage.getItem('gesfut-dark-theme') || 'dark');
        } else {
            setLightTheme(localStorage.getItem('gesfut-light-theme') || 'default');
            setDarkTheme(localStorage.getItem('gesfut-dark-theme') || 'dark');
        }

        const clubsSnap = await getDocs(query(collection(db, "clubs"), orderBy("name")));
        setClubs(clubsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club)));

      } catch (error) {
        console.error("Error fetching settings/clubs:", error);
        toast({ title: "Error", description: "No se pudieron cargar las configuraciones o clubes.", variant: "destructive" });
      } finally {
        setIsLoading(false);
        setIsClubsLoading(false);
      }
    };
    
    if (!authLoading) {
      fetchSettingsAndClubs();
    }
  }, [authLoading, userProfile]);

  const handlePermissionChange = async (href: string, role: UserRole, isChecked: boolean) => {
    if (!settings || !settings.menuPermissions) return;

    const newPermissions = { ...settings.menuPermissions };
    const currentRoles = newPermissions[href] || [];

    if (isChecked) {
        if (!currentRoles.includes(role)) {
            newPermissions[href] = [...currentRoles, role];
        }
    } else {
        newPermissions[href] = currentRoles.filter(r => r !== role);
    }
    
    setIsSaving(true);
    try {
        await updateDoc(settingsDocRef, { menuPermissions: newPermissions });
        setSettings(prev => prev ? { ...prev, menuPermissions: newPermissions } : null);
        toast({ title: "Permiso Actualizado", description: `Acceso para ${role} a ${mainNavItems.find(item => item.href === href)?.label} ha sido ${isChecked ? 'concedido' : 'revocado'}.`, variant: "default" });
    } catch(e) {
        toast({ title: "Error al Guardar Permiso", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


  const handleThemeChange = async (themeType: 'light' | 'dark', themeValue: string) => {
    if (!userProfile) return;

    if (themeType === 'light') {
      setLightTheme(themeValue);
    } else {
      setDarkTheme(themeValue);
    }

    localStorage.setItem(`gesfut-${themeType}-theme`, themeValue);
    
    document.documentElement.classList.remove(...allThemeClasses);
    const newLightTheme = localStorage.getItem('gesfut-light-theme') || 'default';
    const newDarkTheme = localStorage.getItem('gesfut-dark-theme') || 'dark';
    if (newLightTheme !== 'default') document.documentElement.classList.add(newLightTheme);
    if (newDarkTheme !== 'dark') document.documentElement.classList.add(newDarkTheme);

    try {
      const userDocRef = doc(db, "users", userProfile.id);
      await updateDoc(userDocRef, {
        [`${themeType}Theme`]: themeValue,
        updatedAt: serverTimestamp()
      });
      await fetchUserProfile(userProfile.id); 
      toast({ title: "Tema Actualizado", description: "Tu preferencia de tema ha sido guardada." });
    } catch (error) {
       console.error("Error saving theme preference:", error);
       toast({ title: "Error al Guardar", description: "No se pudo guardar tu preferencia de tema.", variant: "destructive" });
    }
  };


  const handleRegistrationToggle = async (enabled: boolean) => {
    if (settings === null) return;
    setIsSaving(true);
    try {
      await updateDoc(settingsDocRef, {
        isRegistrationEnabled: enabled,
        updatedAt: serverTimestamp()
      });
      setSettings(prev => prev ? { ...prev, isRegistrationEnabled: enabled } : { isRegistrationEnabled: enabled });
      toast({
        title: "Configuración Actualizada",
        description: `El registro de usuarios ha sido ${enabled ? 'habilitado' : 'deshabilitado'}.`,
      });
    } catch (error) {
      console.error("Error updating registration setting:", error);
      toast({ title: "Error", description: "No se pudo actualizar la configuración.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthLogoClubChange = async (clubId: string) => {
    if (settings === null) return;
    setIsSaving(true);
    try {
        await updateDoc(settingsDocRef, {
            authPagesLogoClubId: clubId,
            updatedAt: serverTimestamp()
        });
        setSettings(prev => prev ? { ...prev, authPagesLogoClubId: clubId } : null);
        toast({
            title: "Configuración Actualizada",
            description: "El logo para las páginas de autenticación ha sido actualizado.",
        });
    } catch (error) {
        console.error("Error updating auth logo club:", error);
        toast({ title: "Error", description: "No se pudo actualizar la configuración del logo.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAuthLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 700000) { // ~700KB limit
            toast({ title: "Archivo muy grande", description: "El logo debe ser menor a 700KB.", variant: "destructive" });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setAuthLogoPreview(dataUrl);
            setIsSaving(true);
            try {
                await updateDoc(settingsDocRef, {
                    authPagesCustomLogoUrl: dataUrl,
                    updatedAt: serverTimestamp(),
                });
                setSettings(prev => prev ? { ...prev, authPagesCustomLogoUrl: dataUrl } : { authPagesCustomLogoUrl: dataUrl });
                toast({ title: "Logo personalizado guardado." });
            } catch (error) {
                 toast({ title: "Error al guardar el logo.", variant: "destructive" });
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const removeCustomAuthLogo = async () => {
    setAuthLogoPreview(null);
    setIsSaving(true);
    try {
        await updateDoc(settingsDocRef, {
            authPagesCustomLogoUrl: firestoreDeleteField(),
            updatedAt: serverTimestamp(),
        });
        setSettings(prev => prev ? { ...prev, authPagesCustomLogoUrl: undefined } : null);
        toast({ title: "Logo personalizado eliminado." });
    } catch (error) {
        toast({ title: "Error al eliminar el logo.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDefaultThemeChange = async (themeType: 'light' | 'dark', themeValue: string) => {
    if (settings === null) return;
    setIsSaving(true);
    const settingKey = themeType === 'light' ? 'defaultLightTheme' : 'defaultDarkTheme';
    try {
      await updateDoc(settingsDocRef, {
        [settingKey]: themeValue,
        updatedAt: serverTimestamp()
      });
      setSettings(prev => prev ? { ...prev, [settingKey]: themeValue } : null);
      toast({ title: "Tema Predeterminado Guardado", description: `Se ha establecido el nuevo tema ${themeType === 'light' ? 'claro' : 'oscuro'} por defecto.`});
    } catch (error) {
      console.error("Error saving default theme:", error);
      toast({ title: "Error", description: "No se pudo guardar el tema predeterminado.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const navButtons = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'permissions', label: 'Permisos de Menú', icon: Fingerprint },
    { id: 'appearance', label: 'Apariencia', icon: Paintbrush },
  ];

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const renderContent = () => (
    <>
      {activeTab === 'general' && (
          <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Registro de Usuarios</CardTitle>
                    <CardDescription>Controla si los nuevos usuarios pueden registrarse en la aplicación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-3 rounded-md border p-4 shadow-sm">
                        <Switch
                        id="registration-toggle"
                        checked={settings?.isRegistrationEnabled === true}
                        onCheckedChange={handleRegistrationToggle}
                        disabled={isSaving}
                        aria-label="Habilitar registro de usuarios"
                        />
                        <Label htmlFor="registration-toggle" className="flex flex-col space-y-1">
                        <span className="font-medium">
                            {settings?.isRegistrationEnabled ? "Registro Habilitado" : "Registro Deshabilitado"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {settings?.isRegistrationEnabled
                            ? "Los nuevos usuarios pueden registrarse."
                            : "Los nuevos usuarios no podrán crear cuentas."}
                        </span>
                        </Label>
                        {isSaving && settings?.isRegistrationEnabled !== undefined && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Logo de Autenticación</CardTitle>
                    <CardDescription>Selecciona el logo del club o sube uno personalizado para las páginas de inicio de sesión y registro.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-1">
                     <Label htmlFor="auth-logo-club">Logo de Club (Opción 1)</Label>
                     {isClubsLoading ? (
                        <Skeleton className="h-10 w-full" />
                     ) : (
                        <Select
                            value={settings?.authPagesLogoClubId || 'none'}
                            onValueChange={handleAuthLogoClubChange}
                            disabled={isSaving}
                        >
                            <SelectTrigger id="auth-logo-club">
                                <SelectValue placeholder="Usar logo del club predeterminado" />
                            </SelectTrigger>
                            <SelectContent>
                                 <SelectItem value="none">Usar logo del club predeterminado</SelectItem>
                                {clubs.map(club => (
                                    <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                     )}
                     <p className="text-xs text-muted-foreground">El logo personalizado (Opción 2) tendrá prioridad si se sube.</p>
                   </div>
                   <div className="space-y-2">
                        <Label>Logo Personalizado (Opción 2)</Label>
                        <div className="flex items-center gap-4">
                             <Avatar className="h-20 w-20 rounded-md border-2 border-dashed flex items-center justify-center bg-muted">
                                {authLogoPreview ? (
                                    <AvatarImage src={authLogoPreview} alt="Logo de autenticación" className="object-contain" />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                )}
                                <AvatarFallback className="rounded-md">LOGO</AvatarFallback>
                             </Avatar>
                             <div className="space-y-2">
                                <Button asChild variant="outline" size="sm">
                                  <Label htmlFor="auth-logo-upload" className="cursor-pointer"><UploadCloud className="mr-2 h-4 w-4" />Subir Archivo</Label>
                                </Button>
                                <input id="auth-logo-upload" type="file" className="hidden" accept="image/*" onChange={handleAuthLogoUpload} />
                                {authLogoPreview && (
                                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={removeCustomAuthLogo}>
                                       <X className="mr-1 h-3 w-3" /> Quitar logo personalizado
                                    </Button>
                                )}
                             </div>
                        </div>
                   </div>
                </CardContent>
            </Card>
          </div>
      )}
      {activeTab === 'permissions' && (
          <Card>
              <CardHeader>
                  <CardTitle>Permisos del Menú de Navegación</CardTitle>
                  <CardDescription>Controla qué roles pueden ver cada sección en el menú principal.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="rounded-md border">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Sección del Menú</TableHead>
                                  {placeholderUserRoles.map(role => (
                                      <TableHead key={role} className="text-center">{role}</TableHead>
                                  ))}
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {mainNavItems.filter(item => item.href !== '/').map(item => (
                              <TableRow key={item.href}>
                                  <TableCell className="font-medium">{item.label}</TableCell>
                                  {placeholderUserRoles.map(role => (
                                  <TableCell key={role} className="text-center">
                                      <Checkbox
                                          id={`perm-${item.href}-${role}`}
                                          checked={settings?.menuPermissions?.[item.href]?.includes(role)}
                                          onCheckedChange={(checked) => handlePermissionChange(item.href, role, !!checked)}
                                          disabled={isSaving}
                                      />
                                  </TableCell>
                                  ))}
                              </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              </CardContent>
          </Card>
      )}
      {activeTab === 'appearance' && (
           <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Palette className="h-5 w-5 text-primary" />
                          Apariencia Global (Predeterminada)
                      </CardTitle>
                      <CardDescription>
                          Establece los temas por defecto para todos los usuarios. Los usuarios pueden sobreescribir esto en su perfil.
                      </CardDescription>
                  </CardHeader>
                   <CardContent className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-2">Tema Claro Predeterminado</h4>
                        <RadioGroup value={settings?.defaultLightTheme || 'default'} onValueChange={(v) => handleDefaultThemeChange('light', v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {lightThemes.map((theme) => (
                                <Label key={`default-${theme.value}`} htmlFor={`default-light-${theme.value}`} className={cn("flex flex-col items-start space-y-2 rounded-md border-2 p-4 transition-colors hover:border-accent cursor-pointer", settings?.defaultLightTheme === theme.value && "border-primary ring-2 ring-primary")}>
                                    <div className="flex w-full items-start justify-between"> <span className="font-bold text-base">{theme.name}</span> <RadioGroupItem value={theme.value} id={`default-light-${theme.value}`} className="shrink-0"/> </div>
                                    <span className="text-sm font-normal text-muted-foreground">{theme.description}</span>
                                    <div className="flex gap-2 pt-2">{theme.colors.map(color => <div key={color} className="h-6 w-10 rounded border" style={{backgroundColor: color}}/>)}</div>
                                </Label>
                           ))}
                        </RadioGroup>
                      </div>
                      <div>
                         <h4 className="font-medium mb-2">Tema Oscuro Predeterminado</h4>
                         <RadioGroup value={settings?.defaultDarkTheme || 'dark'} onValueChange={(v) => handleDefaultThemeChange('dark', v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {darkThemes.map((theme) => (
                                <Label key={`default-${theme.value}`} htmlFor={`default-dark-${theme.value}`} className={cn("flex flex-col items-start space-y-2 rounded-md border-2 p-4 transition-colors hover:border-accent cursor-pointer", settings?.defaultDarkTheme === theme.value && "border-primary ring-2 ring-primary")}>
                                    <div className="flex w-full items-start justify-between"> <span className="font-bold text-base">{theme.name}</span> <RadioGroupItem value={theme.value} id={`default-dark-${theme.value}`} className="shrink-0"/> </div>
                                    <span className="text-sm font-normal text-muted-foreground">{theme.description}</span>
                                    <div className="flex gap-2 pt-2">{theme.colors.map(color => <div key={color} className="h-6 w-10 rounded border" style={{backgroundColor: color}}/>)}</div>
                                </Label>
                           ))}
                        </RadioGroup>
                      </div>
                   </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Sun className="h-5 w-5 text-amber-500" />
                          Tu Tema Claro Personal
                      </CardTitle>
                      <CardDescription>
                          Elige tu paleta de colores personal para el modo diurno.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                  <RadioGroup value={lightTheme} onValueChange={(value) => handleThemeChange('light', value)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {lightThemes.map((theme) => (
                          <Label
                              key={`user-${theme.value}`}
                              htmlFor={`theme-${theme.value}`}
                              className={cn(
                                  "flex flex-col items-start space-y-2 rounded-md border-2 p-4 transition-colors hover:border-accent cursor-pointer",
                                  lightTheme === theme.value && "border-primary ring-2 ring-primary"
                              )}
                          >
                              <div className="flex w-full items-start justify-between">
                                  <span className="font-bold text-base">{theme.name}</span>
                                  <RadioGroupItem value={theme.value} id={`theme-${theme.value}`} className="shrink-0"/>
                              </div>
                              <span className="text-sm font-normal text-muted-foreground">{theme.description}</span>
                              <div className="flex gap-2 pt-2">
                                  {theme.colors.map(color => <div key={color} className="h-6 w-10 rounded border" style={{backgroundColor: color}}/>)}
                              </div>
                          </Label>
                      ))}
                  </RadioGroup>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Moon className="h-5 w-5 text-indigo-400" />
                      Tu Tema Oscuro Personal
                  </CardTitle>
                  <CardDescription>
                      Elige tu paleta de colores preferida para el modo oscuro.
                  </CardDescription>
                  </CardHeader>
                  <CardContent>
                  <RadioGroup value={darkTheme} onValueChange={(value) => handleThemeChange('dark', value)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {darkThemes.map((theme) => (
                          <Label
                              key={`user-dark-${theme.value}`}
                              htmlFor={`theme-dark-${theme.value}`}
                              className={cn(
                                  "flex flex-col items-start space-y-2 rounded-md border-2 p-4 transition-colors hover:border-accent cursor-pointer",
                                  darkTheme === theme.value && "border-primary ring-2 ring-primary"
                              )}
                          >
                              <div className="flex w-full items-start justify-between">
                                  <span className="font-bold text-base">{theme.name}</span>
                                  <RadioGroupItem value={theme.value} id={`theme-dark-${theme.value}`} className="shrink-0" />
                              </div>
                              <span className="text-sm font-normal text-muted-foreground">{theme.description}</span>
                              <div className="flex gap-2 pt-2">
                                  {theme.colors.map(color => <div key={color} className="h-6 w-10 rounded border" style={{backgroundColor: color}}/>)}
                              </div>
                          </Label>
                      ))}
                  </RadioGroup>
                  </CardContent>
              </Card>
           </div>
      )}
    </>
  );

  return (
    <>
      <div className="md:hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                  {navButtons.map(button => (
                      <TabsTrigger key={button.id} value={button.id}>
                          <button.icon className="mr-2 h-4 w-4" />
                          {button.label}
                      </TabsTrigger>
                  ))}
              </TabsList>
          </Tabs>
          <div className="mt-6 grid gap-6">
            {renderContent()}
          </div>
      </div>
      <div className="hidden md:grid md:grid-cols-[250px_1fr] gap-8 items-start">
        <nav className="flex flex-col gap-2 sticky top-20">
            {navButtons.map(button => (
                <Button 
                    key={button.id}
                    variant={activeTab === button.id ? 'secondary' : 'ghost'}
                    className="justify-start text-base py-6"
                    onClick={() => setActiveTab(button.id as any)}
                >
                    <button.icon className="mr-3 h-5 w-5"/>
                    {button.label}
                </Button>
            ))}
        </nav>
        <div className="grid gap-6">
            {renderContent()}
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard allowedRoles={['Administrador']}>
      <SettingsPageContent />
    </AuthGuard>
  );
}
