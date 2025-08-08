

'use client';

import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, deleteField as firestoreDeleteField
} from 'firebase/firestore';
import { trainingTaskCategories } from '@/lib/placeholder-data';
import type { TrainingTask, TrainingTaskCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, LibraryBig, Search, UploadCloud, X, Sparkles, Image as ImageIcon, Filter, LayoutGrid, List as ListIcon, Link as LinkIconLucide, ClipboardList, BookOpen, Save, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { generateTrainingTask } from '@/ai/flows/generate-training-task-flow';
import { Badge } from '@/components/ui/badge';
import { usePageHeader } from '@/contexts/page-header-context';
import ReactMarkdown from 'react-markdown';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModernDialog } from '@/components/ui/modern-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const MAX_IMAGE_URL_LENGTH = 700000;

const initialDrillData: Partial<Omit<TrainingTask, 'id' | 'createdAt' | 'updatedAt'>> & { imageFile?: File | null } = {
  name: '',
  description: '',
  durationMinutes: undefined,
  category: undefined,
  imageUrl: undefined,
  imageFile: null,
};


export default function DrillsLibraryPage() {
  const [drills, setDrills] = useState<TrainingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrillFormOpen, setIsDrillFormOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<TrainingTask | null>(null);
  const [drillFormData, setDrillFormData] = useState(initialDrillData);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [aiTaskIdea, setAiTaskIdea] = useState('');
  const [aiTaskCategory, setAiTaskCategory] = useState<TrainingTaskCategory | undefined>(undefined);
  const [showDiagramUrlInput, setShowDiagramUrlInput] = useState(false);

  const [drillToDelete, setDrillToDelete] = useState<TrainingTask | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TrainingTaskCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const { setHeader } = usePageHeader();
  
  const [activeDrill, setActiveDrill] = useState<TrainingTask | null>(null);


  const handleOpenNewDrillDialog = () => {
    setEditingDrill(null);
    resetFormStates();
    setIsDrillFormOpen(true);
  };
  
  const headerAction = useMemo(() => (
    <Button onClick={handleOpenNewDrillDialog} size="sm" className="px-2 sm:px-3">
      <PlusCircle className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Nuevo Ejercicio</span>
    </Button>
  ), []);

  useEffect(() => {
    setHeader({
      title: 'Biblioteca de Ejercicios',
      description: 'Crea, gestiona y reutiliza tus ejercicios de entrenamiento.',
      icon: LibraryBig,
      action: headerAction,
    });
  }, [setHeader, headerAction]);

  const fetchDrills = async () => {
    setIsLoading(true);
    try {
      const drillsCollection = collection(db, "drillsLibrary");
      const q = query(drillsCollection, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const drillsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingTask));
      setDrills(drillsData);
    } catch (error) {
      console.error("Error fetching drills from Firestore: ", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los ejercicios de la biblioteca.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrills();
  }, []);

  const filteredDrills = drills.filter(drill => {
    const matchesSearch = drill.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (drill.description && drill.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || drill.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a,b) => a.name.localeCompare(b.name));


  const resetFormStates = () => {
    setDrillFormData(initialDrillData);
    setImagePreview(null);
    setAiTaskIdea('');
    setAiTaskCategory(undefined);
    setShowDiagramUrlInput(false);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  };

  const handleOpenEditDrillDialog = (drill: TrainingTask) => {
    setActiveDrill(null); // Close details dialog if open
    setEditingDrill(drill);
    setDrillFormData({
      name: drill.name,
      description: drill.description || '',
      durationMinutes: drill.durationMinutes,
      category: drill.category,
      imageUrl: drill.imageUrl,
      imageFile: null,
    });
    setImagePreview(drill.imageUrl || null);
    setShowDiagramUrlInput(!!drill.imageUrl && !drill.imageUrl.startsWith('data:'));
    setAiTaskIdea('');
    setAiTaskCategory(drill.category);
    setIsDrillFormOpen(true);
  };

  const handleFormInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "imageUrl") {
      setDrillFormData(prev => ({ ...prev, imageUrl: value, imageFile: null }));
      setImagePreview(value.trim() || null);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    } else {
      setDrillFormData(prev => ({ 
        ...prev, 
        [name]: name === 'durationMinutes' ? (value ? parseInt(value, 10) : undefined) : value 
      }));
    }
  };

  const handleCategoryChange = (value: string) => {
    setDrillFormData(prev => ({ ...prev, category: value === '_none_' ? undefined : value as TrainingTaskCategory }));
  };
  
  const handleAiCategoryChange = (value: string) => {
    const newAiCategory = value === '_none_' ? undefined : value as TrainingTaskCategory;
    setAiTaskCategory(newAiCategory);
    if(newAiCategory) {
      setDrillFormData(prev => ({ ...prev, category: newAiCategory }));
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDrillFormData(prev => ({ ...prev, imageFile: file, imageUrl: undefined }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowDiagramUrlInput(false);
    }
  };

  const triggerImageFileInput = () => {
    imageFileInputRef.current?.click();
  };

  const removeImagePreview = () => {
    setImagePreview(null);
    setDrillFormData(prev => ({ ...prev, imageUrl: undefined, imageFile: null }));
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    setShowDiagramUrlInput(false);
  };
  
  const toggleDiagramUrlInput = () => {
    setShowDiagramUrlInput(prev => {
        const newShowState = !prev;
        if (newShowState && drillFormData.imageFile) {
            setImagePreview(editingDrill?.imageUrl || null);
            setDrillFormData(prevData => ({...prevData, imageFile: null, imageUrl: editingDrill?.imageUrl || undefined}));
            if (imageFileInputRef.current) imageFileInputRef.current.value = "";
        } else if (!newShowState && !drillFormData.imageFile) {
             if (!drillFormData.imageUrl?.trim()) {
                 setImagePreview(editingDrill?.imageUrl || null);
             }
        }
        return newShowState;
    });
  };

  const handleGenerateDiagramWithAI = async () => {
    if (!drillFormData.name?.trim() && !aiTaskIdea.trim()) {
      toast({ title: "Idea Requerida", description: "Por favor, introduce un nombre para el ejercicio o una idea para la IA.", variant: "destructive" });
      return;
    }
    setIsGeneratingDiagram(true);
    toast({ title: "Generando Diagrama con IA...", description: "Por favor, espera." });
    try {
      const idea = aiTaskIdea.trim() || drillFormData.name || "Ejercicio de fútbol";
      const category = aiTaskCategory || drillFormData.category;
      const result = await generateTrainingTask({ taskIdea: idea, taskCategory: category });
      
      if (!drillFormData.name && result.taskName) setDrillFormData(prev => ({...prev, name: result.taskName}));
      if (!drillFormData.description && result.taskDescription) setDrillFormData(prev => ({...prev, description: result.taskDescription}));
      if (!drillFormData.durationMinutes && result.taskDurationMinutes) setDrillFormData(prev => ({...prev, durationMinutes: result.taskDurationMinutes}));
      
      if (result.taskImageDataUri) {
        if (result.taskImageDataUri.length > MAX_IMAGE_URL_LENGTH) {
            toast({ title: "Diagrama Muy Grande", description: "El diagrama generado es demasiado grande. Intenta de nuevo o sube una imagen más pequeña.", variant: "default", duration: 7000 });
            setDrillFormData(prev => ({ ...prev, imageUrl: undefined, imageFile: null }));
            setImagePreview(null);
        } else {
            setDrillFormData(prev => ({ ...prev, imageUrl: result.taskImageDataUri, imageFile: null }));
            setImagePreview(result.taskImageDataUri);
            setShowDiagramUrlInput(true);
        }
      }
      toast({ title: "Diagrama y Detalles Sugeridos por IA", description: "Se han rellenado algunos campos y el diagrama." });
    } catch (error) {
      console.error("Error generating diagram with AI:", error);
      toast({ title: "Error de IA", description: "No se pudo generar el diagrama. " + (error instanceof Error ? error.message : ""), variant: "destructive" });
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const handleSaveDrill = async () => {
    if (!drillFormData.name?.trim()) {
        toast({ title: "Nombre Requerido", description: "El nombre del ejercicio es obligatorio.", variant: "destructive" });
        return;
    }

    let finalImageUrl = imagePreview;

    if (finalImageUrl && finalImageUrl.length > MAX_IMAGE_URL_LENGTH) {
        toast({ title: "Diagrama Muy Grande", description: "El diagrama es demasiado grande para guardarlo. Se guardará sin diagrama.", variant: "default", duration: 5000 });
        finalImageUrl = undefined;
    }

    try {
        if (editingDrill) {
            const drillRef = doc(db, "drillsLibrary", editingDrill.id);
            const drillDataToUpdate: any = {
                name: drillFormData.name!,
                description: drillFormData.description || firestoreDeleteField(),
                durationMinutes: drillFormData.durationMinutes ?? null,
                category: drillFormData.category || firestoreDeleteField(),
                imageUrl: finalImageUrl || firestoreDeleteField(),
                updatedAt: serverTimestamp(),
            };
            await updateDoc(drillRef, drillDataToUpdate);
            toast({ title: "Ejercicio Actualizado", description: `"${drillDataToUpdate.name}" ha sido actualizado en la biblioteca.` });
        } else {
            const drillDataToAdd: any = {
                name: drillFormData.name!,
                description: drillFormData.description || null,
                durationMinutes: drillFormData.durationMinutes ?? null,
                category: drillFormData.category || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            if (finalImageUrl) {
                drillDataToAdd.imageUrl = finalImageUrl;
            }
            await addDoc(collection(db, "drillsLibrary"), drillDataToAdd);
            toast({ title: "Ejercicio Añadido", description: `"${drillDataToAdd.name}" ha sido añadido a la biblioteca.` });
        }
        fetchDrills();
        setIsDrillFormOpen(false);
        resetFormStates();
    } catch (error) {
        console.error("Error saving drill to Firestore:", error);
        toast({ title: "Error al Guardar Ejercicio", variant: "destructive" });
    }
  };


  const handleDeleteDrillRequest = (drill: TrainingTask) => {
    setActiveDrill(null); // Close details dialog if open
    setDrillToDelete(drill);
  };

  const confirmDeleteDrill = async () => {
    if (drillToDelete) {
      try {
        await deleteDoc(doc(db, "drillsLibrary", drillToDelete.id));
        fetchDrills();
        toast({ title: "Ejercicio Eliminado", description: `"${drillToDelete.name}" ha sido eliminado de la biblioteca.` });
      } catch (error) {
        console.error("Error deleting drill from Firestore: ", error);
        toast({ title: "Error al Eliminar Ejercicio", variant: "destructive" });
      } finally {
        setDrillToDelete(null);
      }
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Cargando biblioteca de ejercicios...</div>;
  }
  
  const drillDialogActions = activeDrill ? (
    <div className="flex items-center gap-1">
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => { handleOpenEditDrillDialog(activeDrill); }} className="text-white hover:bg-white/20">
                <Edit3 className="h-4 w-4" />
            </Button>
        </TooltipTrigger><TooltipContent><p>Editar Ejercicio</p></TooltipContent></Tooltip></TooltipProvider>
    </div>
  ) : undefined;
  
  const drillFormDialogActions = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSaveDrill}
            disabled={isGeneratingDiagram}
            className="text-white hover:text-white/80 hover:bg-white/10"
          >
            {isGeneratingDiagram ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Guardar Ejercicio</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );


  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto lg:flex-1">
              <div className="relative flex-1 w-full sm:min-w-[200px] sm:w-auto">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ejercicio..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={(value: TrainingTaskCategory | 'all') => setCategoryFilter(value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Categorías</SelectItem>
                  {trainingTaskCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || categoryFilter !== 'all') && (
                <Button variant="ghost" onClick={() => {setSearchTerm(''); setCategoryFilter('all');}} className="text-sm w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" /> Limpiar filtros
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto justify-start lg:justify-end mt-2 lg:mt-0">
                <Button variant={viewMode === 'card' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('card')} aria-label="Vista de tarjetas"><LayoutGrid className="h-5 w-5"/></Button>
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')} aria-label="Vista de lista"><ListIcon className="h-5 w-5" /></Button>
            </div>
          </div>
          
          {filteredDrills.length === 0 ? (
            <div className="text-center py-10">
              <LibraryBig className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay ejercicios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || categoryFilter !== 'all' ? "No se encontraron ejercicios que coincidan con tu búsqueda/filtro." : "Empieza añadiendo un nuevo ejercicio a la biblioteca."}
              </p>
            </div>
          ) : viewMode === 'card' ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDrills.map((drill) => (
                <Card key={drill.id} className="cursor-pointer flex flex-col shadow-sm hover:shadow-md transition-shadow" onClick={() => setActiveDrill(drill)}>
                    <div className="relative aspect-video bg-muted border-b">
                        <Image
                            src={drill.imageUrl || "https://placehold.co/400x300.png?text=Exc"}
                            alt={drill.name}
                            fill
                            className="object-contain"
                            data-ai-hint="exercise diagram"
                        />
                    </div>
                    <CardHeader className="p-3 flex-1">
                        <CardTitle className="text-base line-clamp-2">{drill.name}</CardTitle>
                        {drill.category && <Badge variant="secondary" className="mt-1">{drill.category}</Badge>}
                    </CardHeader>
                    <CardFooter className="p-3 border-t flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenEditDrillDialog(drill); }}><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteDrillRequest(drill); }}><Trash2 className="h-4 w-4" /></Button>
                    </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] hidden sm:table-cell"></TableHead>
                    <TableHead>Nombre del Ejercicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="hidden md:table-cell">Duración</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrills.map((drill) => (
                    <TableRow key={drill.id} className="cursor-pointer" onClick={() => setActiveDrill(drill)}>
                      <TableCell className="hidden sm:table-cell">
                        <Avatar className="h-10 w-10 rounded-md border bg-muted/30">
                          <AvatarImage src={drill.imageUrl} alt={drill.name} className="object-contain" data-ai-hint="exercise diagram"/>
                          <AvatarFallback className="rounded-md"><ImageIcon className="h-5 w-5 text-muted-foreground"/></AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold">{drill.name}</TableCell>
                      <TableCell>{drill.category ? <Badge variant="outline">{drill.category}</Badge> : 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell">{drill.durationMinutes ? `${drill.durationMinutes} min` : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenEditDrillDialog(drill); }}><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteDrillRequest(drill); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

       {activeDrill && (
        <ModernDialog
          isOpen={!!activeDrill}
          onClose={() => setActiveDrill(null)}
          title={activeDrill.name}
          size="2xl"
          type="info"
          headerActions={drillDialogActions}
        >
          <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {activeDrill.category && <Badge variant="secondary">{activeDrill.category}</Badge>}
                  {activeDrill.durationMinutes && <span>{activeDrill.durationMinutes} min</span>}
              </div>
              <Separator />
              <div className="space-y-4">
                  <div className="relative bg-muted rounded-md border self-start max-w-sm mx-auto">
                      {activeDrill.imageUrl ? (
                          <Image src={activeDrill.imageUrl} alt={activeDrill.name} width={400} height={300} className="object-contain w-full h-auto rounded-md" data-ai-hint="exercise diagram" />
                      ) : (
                          <div className="aspect-video flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-16 w-16" />
                          </div>
                      )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{activeDrill.description || 'No hay descripción para este ejercicio.'}</ReactMarkdown>
                  </div>
              </div>
          </div>
        </ModernDialog>
       )}

      <ModernDialog
        isOpen={isDrillFormOpen}
        onClose={() => {
          setIsDrillFormOpen(false);
          resetFormStates();
        }}
        title={editingDrill ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
        icon={LibraryBig}
        size="xl"
        type="info"
        headerActions={drillFormDialogActions}
      >
        <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
                <Tabs defaultValue="details" className="p-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="details"><BookOpen className="mr-2 h-4 w-4" />Detalles</TabsTrigger>
                        <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" />Generación IA</TabsTrigger>
                        <TabsTrigger value="diagram"><ImageIcon className="mr-2 h-4 w-4" />Diagrama</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="pt-4 space-y-4">
                        <div className="space-y-1">
                        <Label htmlFor="drill-name">Nombre del Ejercicio*</Label>
                        <Input id="drill-name" name="name" value={drillFormData.name || ''} onChange={handleFormInputChange} placeholder="Ej: Rondo 4v2" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="drill-duration">Duración (min)</Label>
                            <Input id="drill-duration" name="durationMinutes" type="number" value={drillFormData.durationMinutes || ''} onChange={handleFormInputChange} placeholder="Ej: 15" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="drill-category">Categoría</Label>
                            <Select value={drillFormData.category || '_none_'} onValueChange={(value: string) => handleCategoryChange(value)}>
                                <SelectTrigger id="drill-category"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                                <SelectContent>
                                <SelectItem value="_none_">Ninguna</SelectItem>
                                {trainingTaskCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                        <div className="space-y-1">
                        <Label htmlFor="drill-description">Descripción (soporta Markdown)</Label>
                        <Textarea id="drill-description" name="description" value={drillFormData.description || ''} onChange={handleFormInputChange} placeholder="Cómo realizar el ejercicio, material, objetivos..." rows={4} />
                        </div>
                    </TabsContent>
                    <TabsContent value="ai" className="pt-4 space-y-4">
                        <div className="space-y-1">
                        <Label htmlFor="ai-task-idea">Idea Principal para IA</Label>
                        <Input id="ai-task-idea" value={aiTaskIdea} onChange={(e) => setAiTaskIdea(e.target.value)} placeholder="Ej: Mejorar pases en espacios reducidos" />
                        </div>
                        <div className="space-y-1">
                        <Label htmlFor="ai-task-category">Categoría (para IA)</Label>
                        <Select value={aiTaskCategory || '_none_'} onValueChange={(value: string) => handleAiCategoryChange(value)}>
                            <SelectTrigger id="ai-task-category"><SelectValue placeholder="Opcional, ayuda a la IA" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none_">Ninguna</SelectItem>
                                {trainingTaskCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        </div>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={handleGenerateDiagramWithAI} 
                            disabled={(!drillFormData.name?.trim() && !aiTaskIdea.trim()) || isGeneratingDiagram}
                            className="w-full"
                        >
                            <Sparkles className={cn("mr-2 h-4 w-4", isGeneratingDiagram && "animate-spin")} />
                            {isGeneratingDiagram ? 'Generando...' : 'Sugerir Detalles y Diagrama con IA'}
                        </Button>
                    </TabsContent>
                    <TabsContent value="diagram" className="pt-4 space-y-2">
                        {imagePreview && (
                        <div className="relative group border rounded-md overflow-hidden shadow-sm bg-muted/20 max-w-sm mx-auto">
                            <Image src={imagePreview} alt="Vista previa del diagrama" width={300} height={200} className="object-contain w-full h-auto max-h-[250px]" data-ai-hint="exercise diagram"/>
                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-70 group-hover:opacity-100 transition-opacity" onClick={removeImagePreview}>
                            <X className="h-3 w-3" />
                            </Button>
                        </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2 items-center">
                        <Button type="button" variant="outline" size="sm" onClick={triggerImageFileInput} className="flex-1">
                            <UploadCloud className="mr-2 h-4 w-4" /> Subir Diagrama
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={toggleDiagramUrlInput} className="flex-1">
                            <LinkIconLucide className="mr-2 h-4 w-4" /> {showDiagramUrlInput ? 'Ocultar URL' : 'Introducir URL'}
                        </Button>
                        </div>
                        {showDiagramUrlInput && (
                            <Input
                                name="imageUrl"
                                value={drillFormData.imageUrl || ''}
                                onChange={handleFormInputChange}
                                placeholder="Pega URL de imagen del diagrama"
                                className="h-9 text-sm mt-2"
                                disabled={!!drillFormData.imageFile}
                            />
                        )}
                        <input type="file" ref={imageFileInputRef} onChange={handleImageFileChange} accept="image/*" className="hidden" id={`image-upload-drill-${editingDrill?.id || 'new'}`} />
                    </TabsContent>
                </Tabs>
            </ScrollArea>
        </div>
      </ModernDialog>

      {drillToDelete && (
        <ModernDialog
          isOpen={!!drillToDelete}
          onClose={() => setDrillToDelete(null)}
          title={`Eliminar Ejercicio "${drillToDelete.name}"`}
          icon={Trash2}
          type="error"
          size="md"
        >
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta acción no se puede deshacer. El ejercicio será eliminado permanentemente de la biblioteca.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDrillToDelete(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteDrill}>Eliminar Ejercicio</Button>
            </div>
          </div>
        </ModernDialog>
      )}
    </div>
  );
}
