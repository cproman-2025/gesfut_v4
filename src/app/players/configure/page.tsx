

'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { defaultPlayerProfileFields } from '@/lib/placeholder-data';
import type { PlayerProfileField } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, PlusCircle, Trash2, GripVertical, ArrowLeft, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import AuthGuard from '@/components/auth/auth-guard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to group fields by section
const groupFieldsBySection = (fields: PlayerProfileField[]) => {
  return fields.reduce((acc, field) => {
    (acc[field.section] = acc[field.section] || []).push(field);
    return acc;
  }, {} as Record<string, PlayerProfileField[]>);
};

function ConfigurePlayerProfilePageContent() {
  const [profileFields, setProfileFields] = useState<PlayerProfileField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const configDocRef = doc(db, "appSettings", "playerProfileFields");
  const sectionOrder: PlayerProfileField['section'][] = ['Personal', 'Deportivo', 'Médico'];

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists() && docSnap.data().fields) {
          setProfileFields(docSnap.data().fields);
        } else {
          // If not found, use hardcoded default and save it for initialization
          const initialFields = JSON.parse(JSON.stringify(defaultPlayerProfileFields));
          setProfileFields(initialFields);
          await setDoc(configDocRef, { fields: initialFields });
        }
      } catch (error) {
        console.error("Error fetching player profile config:", error);
        toast({ title: "Error", description: "No se pudo cargar la configuración. Usando valores por defecto.", variant: "destructive" });
        setProfileFields(JSON.parse(JSON.stringify(defaultPlayerProfileFields)));
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const groupedFields = groupFieldsBySection(profileFields);

  const handleFieldChange = (key: string, property: keyof PlayerProfileField, value: any) => {
    setProfileFields(prevFields =>
      prevFields.map(field =>
        field.key === key ? { ...field, [property]: value } : field
      )
    );
  };

  const handleToggleActive = (key: string, isActive: boolean) => {
    setProfileFields(prevFields =>
      prevFields.map(field =>
        field.key === key ? { ...field, isActive } : field
      )
    );
  };

  const handleAddNewField = (section: PlayerProfileField['section']) => {
    const newField: PlayerProfileField = {
      key: `custom_field_${Date.now()}`,
      label: 'Nuevo Campo',
      type: 'text',
      section: section,
      isDefault: false,
      isActive: true,
    };
    setProfileFields(prevFields => {
        const newFieldsArray = [...prevFields];
        let lastIndexOfSection = -1;
        for (let i = prevFields.length - 1; i >= 0; i--) {
            if (prevFields[i].section === section) {
                lastIndexOfSection = i;
                break;
            }
        }
        if (lastIndexOfSection !== -1) {
            newFieldsArray.splice(lastIndexOfSection + 1, 0, newField);
        } else {
            newFieldsArray.push(newField);
        }
        return newFieldsArray;
    });
  };

  const handleDeleteField = (key: string) => {
    setProfileFields(prevFields => prevFields.filter(field => field.key !== key && !field.isDefault));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await setDoc(configDocRef, { fields: profileFields });
      toast({
        title: "Configuración Guardada",
        description: "Los campos del perfil de jugador han sido actualizados.",
      });
    } catch (error) {
      console.error("Error saving player profile config:", error);
      toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveField = (key: string, direction: 'up' | 'down') => {
    setProfileFields(prevFields => {
      const fieldIndexGlobal = prevFields.findIndex(f => f.key === key);
      if (fieldIndexGlobal === -1) return prevFields;

      const fieldToMove = prevFields[fieldIndexGlobal];
      const currentSection = fieldToMove.section;

      const fieldsCopy = [...prevFields];
      fieldsCopy.splice(fieldIndexGlobal, 1);

      let targetGlobalIndex = -1;

      if (direction === 'up') {
        for (let i = fieldIndexGlobal - 1; i >= 0; i--) {
          if (prevFields[i].section === currentSection) {
            targetGlobalIndex = fieldsCopy.findIndex(f => f.key === prevFields[i].key);
            break;
          }
        }
        if (targetGlobalIndex === -1) {
            const firstOfSectionIdx = fieldsCopy.findIndex(f => f.section === currentSection);
            targetGlobalIndex = firstOfSectionIdx !== -1 ? firstOfSectionIdx : 0;
        }
      } else { // 'down'
        for (let i = fieldIndexGlobal + 1; i < prevFields.length; i++) {
          if (prevFields[i].section === currentSection) {
            targetGlobalIndex = fieldsCopy.findIndex(f => f.key === prevFields[i].key) + 1;
            break;
          }
        }
        if (targetGlobalIndex === -1) {
            let lastOfSectionIdx = -1;
            for(let i = fieldsCopy.length -1; i>=0; i--) {
                if(fieldsCopy[i].section === currentSection) {
                    lastOfSectionIdx = i;
                    break;
                }
            }
            targetGlobalIndex = lastOfSectionIdx !== -1 ? lastOfSectionIdx + 1 : fieldsCopy.length;
        }
      }
      fieldsCopy.splice(targetGlobalIndex, 0, fieldToMove);
      return fieldsCopy;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/players">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline">Configurar Perfil de Jugador</h1>
          <p className="text-muted-foreground">Define la información que se rastrea para cada jugador.</p>
        </div>
      </div>

      {sectionOrder.map((section) => {
        const fieldsInSection = groupedFields[section] || [];
        return (
        <Card key={section} className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">{section}</CardTitle>
            <CardDescription>Gestiona los campos para la sección {section.toLowerCase()} del perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldsInSection.map((field) => {
              const isFirstInSection = fieldsInSection[0].key === field.key;
              const isLastInSection = fieldsInSection[fieldsInSection.length - 1].key === field.key;
              return (
              <div key={field.key} className="flex items-start gap-3 p-3 border rounded-md bg-card hover:bg-secondary/30 transition-colors">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <GripVertical className="h-5 w-5 text-muted-foreground mt-2.5 cursor-grab flex-shrink-0" />
                    </TooltipTrigger>
                     <TooltipContent><p>Arrastrar para reordenar (funcionalidad pendiente)</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`label-${field.key}`} className="text-base font-medium">{field.label}</Label>
                     <Checkbox
                        id={`active-${field.key}`}
                        checked={field.isActive}
                        onCheckedChange={(checked) => handleToggleActive(field.key, Boolean(checked))}
                        disabled={field.isDefault && field.key === 'name'}
                      />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      id={`label-${field.key}`}
                      value={field.label}
                      onChange={(e) => handleFieldChange(field.key, 'label', e.target.value)}
                      placeholder="Nombre del Campo"
                      disabled={field.isDefault || !field.isActive}
                    />
                    <Select
                      value={field.type}
                      onValueChange={(value: PlayerProfileField['type']) => handleFieldChange(field.key, 'type', value)}
                      disabled={field.isDefault || !field.isActive}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de Campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto Corto</SelectItem>
                        <SelectItem value="textarea">Texto Largo</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="date">Fecha</SelectItem>
                        <SelectItem value="select">Selección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {field.type === 'select' && (
                    <Input
                      value={field.options?.join(',') || ''}
                      onChange={(e) => handleFieldChange(field.key, 'options', e.target.value.split(','))}
                      placeholder="Opciones separadas por coma (ej. Op1,Op2)"
                      disabled={field.isDefault || !field.isActive}
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center items-center gap-1 ml-2">
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveField(field.key, 'up')} disabled={isFirstInSection}>
                            <ArrowUpCircle className={cn("h-4 w-4", isFirstInSection && "text-muted-foreground/50")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Mover Arriba</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveField(field.key, 'down')} disabled={isLastInSection}>
                            <ArrowDownCircle className={cn("h-4 w-4", isLastInSection && "text-muted-foreground/50")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Mover Abajo</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {!field.isDefault && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteField(field.key)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Eliminar Campo</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
            })}
            <Button variant="outline" onClick={() => handleAddNewField(section as PlayerProfileField['section'])} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Campo a {section}
            </Button>
          </CardContent>
        </Card>
        );
      })}

      <CardFooter className="mt-6 flex justify-end border-t pt-6">
        <Button size="lg" onClick={handleSaveChanges} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </CardFooter>
    </div>
  );
}

export default function ConfigurePlayerProfilePage() {
  return (
    <AuthGuard allowedRoles={['Administrador']}>
      <ConfigurePlayerProfilePageContent />
    </AuthGuard>
  );
}
