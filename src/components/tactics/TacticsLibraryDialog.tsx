
'use client';

import React, { useState, useRef } from 'react';
import type { Tactic, Team } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, PlusCircle, Loader2, UploadCloud, Search, LayoutGrid, List as ListIcon, LibraryBig } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface TacticsLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tactics: Tactic[];
  userTeams: Team[];
  onSelect: (tactic: Tactic) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (tacticId: string) => Promise<void>;
  onOverwrite: (tactic: Tactic) => Promise<void>;
  onUpdatePreview: (tacticId: string, imageUrl: string) => Promise<void>;
  isLoading: boolean;
  isDirty: boolean;
}

export const TacticsLibraryDialog: React.FC<TacticsLibraryDialogProps> = ({
  open,
  onOpenChange,
  tactics,
  userTeams,
  onSelect,
  onCreate,
  onDelete,
  onOverwrite,
  onUpdatePreview,
  isLoading,
  isDirty,
}) => {
  const [newTacticName, setNewTacticName] = useState('');
  const [tacticToLoad, setTacticToLoad] = useState<Tactic | null>(null);
  const [tacticToOverwrite, setTacticToOverwrite] = useState<Tactic | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTacticIdForUpload, setSelectedTacticIdForUpload] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const filteredTactics = tactics.filter(tactic =>
    tactic.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateClick = async () => {
    if (!newTacticName.trim()) return;
    const existingTactic = tactics.find(t => t.name.toLowerCase() === newTacticName.trim().toLowerCase());
    if (existingTactic) {
      setTacticToOverwrite(existingTactic);
    } else {
      await onCreate(newTacticName);
      setNewTacticName('');
    }
  };

  const handleLoadClick = (tactic: Tactic) => {
    if (isDirty) {
      setTacticToLoad(tactic);
    } else {
      onSelect(tactic);
    }
  };

  const handleConfirmLoad = () => {
    if (tacticToLoad) {
      onSelect(tacticToLoad);
    }
    setTacticToLoad(null);
  };
  
  const handleConfirmOverwrite = () => {
    if (tacticToOverwrite) {
      onOverwrite(tacticToOverwrite);
    }
    setTacticToOverwrite(null);
    setNewTacticName('');
  };
  
  const handleUploadPreviewClick = (tacticId: string) => {
    setSelectedTacticIdForUpload(tacticId);
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedTacticIdForUpload) {
        if (file.size > 1000000) { // ~1MB limit
            toast({ title: "Imagen demasiado grande", description: "Por favor, elige una imagen más pequeña.", variant: "destructive" });
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageUrl = e.target?.result as string;
            await onUpdatePreview(selectedTacticIdForUpload, imageUrl);
        };
        reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = '';
    setSelectedTacticIdForUpload(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="font-headline text-xl">Biblioteca de Tácticas</DialogTitle>
            <DialogDescription>
              Carga una táctica existente, o crea una nueva para guardarla más tarde.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col gap-4 p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Buscar táctica..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto items-center">
                    <Input 
                    value={newTacticName} 
                    onChange={(e) => setNewTacticName(e.target.value)} 
                    placeholder="Nombre para nueva táctica..."
                    className="flex-grow"
                    />
                    <Button 
                    onClick={handleCreateClick} 
                    disabled={!newTacticName.trim() || isLoading}
                    className="whitespace-nowrap"
                    >
                    <PlusCircle className="w-4 h-4 mr-2" /> Crear
                    </Button>
                </div>
            </div>
            
            <div className="flex justify-end items-center gap-2">
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('card')}><LayoutGrid className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Vista de Tarjetas</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><ListIcon className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Vista de Lista</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            </div>

            <ScrollArea className="flex-1 border rounded-md -mx-4 sm:mx-0">
              {isLoading && !tactics.length ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredTactics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <LibraryBig className="w-32 h-32 text-muted-foreground/30 mb-4" />
                    <h2 className="text-2xl font-bold font-headline">Tu Biblioteca de Tácticas está Vacía</h2>
                    <p className="text-muted-foreground mt-2">Crea tu primera estrategia para empezar a planificar tus partidos.</p>
                </div>
              ) : (
                viewMode === 'card' ? (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredTactics.map(tactic => {
                      const team = tactic.teamId ? userTeams.find(t => t.id === tactic.teamId) : null;
                      return (
                      <TooltipProvider key={tactic.id} delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                  <Card className="overflow-hidden transition-all hover:shadow-lg hover:border-primary cursor-pointer" onClick={() => handleLoadClick(tactic)}>
                                    <div className="relative aspect-video bg-green-700/20 border-b">
                                        {tactic.previewImageUrl ? (
                                          <Image src={tactic.previewImageUrl} alt={`Vista previa de ${tactic.name}`} layout="fill" objectFit="contain" data-ai-hint="tactic preview"/>
                                        ) : (
                                          <div className="flex items-center justify-center h-full text-muted-foreground/50">
                                             <LayoutGrid className="w-1/2 h-1/2" />
                                          </div>
                                        )}
                                        <div className={cn(
                                          "absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white font-bold text-xs border-2 border-white/80 shadow-md",
                                          tactic.orientation === 'vertical' ? 'bg-red-600' : 'bg-green-600'
                                        )}>
                                          {tactic.orientation === 'vertical' ? 'V' : 'H'}
                                        </div>
                                    </div>
                                    <div className="p-2 flex items-start justify-between">
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium text-sm truncate">{tactic.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {tactic.updatedAt && typeof tactic.updatedAt.toDate === 'function' ? `Mod. ${format(tactic.updatedAt.toDate(), 'dd/MM/yyyy', {locale: es})}` : 'Justo ahora'}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(tactic.id); }}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  </Card>
                              </ContextMenuTrigger>
                               <ContextMenuContent>
                                  <ContextMenuItem onSelect={() => handleUploadPreviewClick(tactic.id)}>
                                    <UploadCloud className="mr-2 h-4 w-4"/>Subir vista previa
                                  </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </TooltipTrigger>
                          <TooltipContent><p>{tactic.name}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )})}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Modificado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTactics.map(tactic => {
                            const team = tactic.teamId ? userTeams.find(t => t.id === tactic.teamId) : null;
                            return (
                                <TableRow key={tactic.id} className="cursor-pointer" onClick={() => handleLoadClick(tactic)}>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                          <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-white font-bold text-xs border-2 border-white/80 shadow-md shrink-0", tactic.orientation === 'vertical' ? 'bg-red-600' : 'bg-green-600')}>{tactic.orientation === 'vertical' ? 'V' : 'H'}</div>
                                          {tactic.name}
                                      </div>
                                    </TableCell>
                                    <TableCell>{team?.name || 'N/A'}</TableCell>
                                    <TableCell>{tactic.updatedAt && typeof tactic.updatedAt.toDate === 'function' ? format(tactic.updatedAt.toDate(), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(tactic.id); }}><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                  </Table>
                )
              )}
            </ScrollArea>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>
           <DialogFooter className="p-4 border-t shrink-0">
            <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!tacticToLoad} onOpenChange={() => setTacticToLoad(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cambios sin Guardar</AlertDialogTitle><AlertDialogDescription>Tienes cambios sin guardar en la pizarra actual. ¿Quieres descartarlos y cargar la nueva táctica?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTacticToLoad(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLoad}>Descartar y Cargar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!tacticToOverwrite} onOpenChange={() => setTacticToOverwrite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sobrescribir Táctica Existente</AlertDialogTitle><AlertDialogDescription>Ya existe una táctica llamada "{tacticToOverwrite?.name}". ¿Quieres sobrescribirla con el contenido actual de tu pizarra? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTacticToOverwrite(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>Sobrescribir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
