
'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, deleteDoc, getDocs, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { toPng } from 'html-to-image';

import { TacticalBoard } from '@/components/tactics/TacticalBoard';
import { ToolPanel } from '@/components/tactics/ToolPanel';
import { PlayerPanel } from '@/components/tactics/PlayerPanel';
import { TopToolbar } from '@/components/tactics/TopToolbar';
import { MobileToolbar } from '@/components/tactics/MobileToolbar';
import { TacticsLibraryDialog } from '@/components/tactics/TacticsLibraryDialog';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Pencil, Users, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BoardItem, Drawing, BoardTool, Tactic, Player, Team, TacticsPlayer } from '@/types';
import { AWAY_TEAM_PLAYERS } from '@/lib/tactics-data';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function TacticsPage() {
  const isMobile = useIsMobile();
  const boardRef = useRef<HTMLDivElement>(null);
  const { userProfile, authUser } = useAuth();
  const { toast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);

  // Core State
  const [history, setHistory] = useState<{ boardItems: BoardItem[], drawings: Drawing[] }[]>([{ boardItems: [], drawings: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeTactic, setActiveTactic] = useState<Tactic | null>(null);
  const [tacticsList, setTacticsList] = useState<Tactic[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isDirty, setIsDirty] = useState(false);

  // UI State
  const [activeTool, setActiveTool] = useState<BoardTool>('selection');
  const [activeColor, setActiveColor] = useState('#EAB308');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isPlayerPanelOpen, setIsPlayerPanelOpen] = useState(false);
  const [isToolPanelOpen, setIsToolPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToolPanelCollapsed, setIsToolPanelCollapsed] = useState(false);
  const [isPlayerPanelCollapsed, setIsPlayerPanelCollapsed] = useState(false);
  
  // Data State
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [playerColorOverrides, setPlayerColorOverrides] = useState<Record<string, string>>({});

  const [itemForPlacement, setItemForPlacement] = useState<any | null>(null);


  // Derived State from history
  const { boardItems, drawings } = history[historyIndex] || { boardItems: [], drawings: [] };

  // History management
  const setBoardState = useCallback((updater: (prevState: { boardItems: BoardItem[], drawings: Drawing[] }) => { boardItems: BoardItem[], drawings: Drawing[] }) => {
    const newState = updater(history[historyIndex] || { boardItems: [], drawings: [] });
    if (JSON.stringify(newState) !== JSON.stringify(history[historyIndex])) {
        setIsDirty(true);
    }
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newState]);
    setHistoryIndex(newHistory.length);
  }, [history, historyIndex]);

  const handleToggleOrientation = useCallback(() => {
    setBoardOrientation(prevOrientation => {
      const isSwitchingToVertical = prevOrientation === 'horizontal';
      
      const transformPoint = (point: { x: number; y: number }) => {
        return isSwitchingToVertical
          ? { x: 1 - point.y, y: point.x }
          : { x: point.y, y: 1 - point.x };
      };
  
      setBoardState(prevState => {
        const newItems = prevState.boardItems.map(item => {
          const newItem: BoardItem = {
            ...item,
            position: transformPoint(item.position),
          };
          if (item.type === 'shape') {
            const currentRotation = item.rotation || 0;
            const rotationChange = isSwitchingToVertical ? 90 : -90;
            newItem.rotation = (currentRotation + rotationChange + 360) % 360;
          }
          return newItem;
        });
  
        const newDrawings = prevState.drawings.map(drawing => ({
          ...drawing,
          points: drawing.points.map(transformPoint),
        }));
  
        return { boardItems: newItems, drawings: newDrawings };
      });
  
      return isSwitchingToVertical ? 'vertical' : 'horizontal';
    });
  }, [setBoardState]);

  useEffect(() => {
    if (isMobile === undefined) return;
    const targetOrientation = isMobile ? 'vertical' : 'horizontal';
    if (boardOrientation !== targetOrientation) {
      handleToggleOrientation();
    }
  }, [isMobile]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (canUndo) setHistoryIndex(prev => prev - 1);
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) setHistoryIndex(prev => prev + 1);
  }, [canRedo]);
  
  
  const handlePlayerColorChange = useCallback((playerId: string, color: string) => {
    setPlayerColorOverrides(prev => ({ ...prev, [playerId]: color }));
    setBoardState(prevState => ({
      ...prevState,
      boardItems: prevState.boardItems.map(item => {
        if (item.type === 'player' && item.elementId === playerId) {
            return { ...item, data: { ...item.data, color: color } };
        }
        return item;
      })
    }));
  }, [setBoardState]);

  const homeTeamPlayers = useMemo((): TacticsPlayer[] => {
    if (!selectedTeamId) return [];
    return allPlayers
      .filter(p => p.teamId === selectedTeamId)
      .map(p => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname || p.name.split(' ')[0],
          number: p.jerseyNumber || 0,
          position: p.position as any,
          team: 'home',
          color: playerColorOverrides[p.id] || '#3B82F6',
          avatarUrl: p.avatarUrl,
      }));
  }, [selectedTeamId, allPlayers, playerColorOverrides]);

  const handleItemSelectForPlacement = useCallback((itemData: any) => {
    setItemForPlacement(itemData);
    
    // Close any open drawers
    setIsPlayerPanelOpen(false);
    setIsToolPanelOpen(false);

    const itemName = itemData.player?.nickname || itemData.player?.name || itemData.shape?.id || 'Objeto';
    toast({
      title: "Modo de Colocación",
      description: `Toca en la pizarra para colocar "${itemName}".`,
    });
  }, [toast]);


  useEffect(() => {
    if (!authUser) return;
    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            let teamsQuery;
            if (userProfile?.role === 'Administrador') {
                teamsQuery = query(collection(db, 'teams'), orderBy('name'));
            } else if (userProfile?.managedTeamIds && userProfile.managedTeamIds.length > 0) {
                teamsQuery = query(collection(db, 'teams'), where('__name__', 'in', userProfile.managedTeamIds), orderBy('name'));
            } else {
                setUserTeams([]); setAllPlayers([]); setIsLoading(false); return;
            }
            const teamsSnapshot = await getDocs(teamsQuery);
            const teamsData = teamsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Team);
            setUserTeams(teamsData);
            if (teamsData.length > 0 && !selectedTeamId) setSelectedTeamId(teamsData[0].id);

            const playersSnapshot = await getDocs(query(collection(db, 'players'), orderBy('name')));
            setAllPlayers(playersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Player));
        } catch (error) {
            console.error("Error fetching teams/players:", error);
            toast({ title: "Error", description: "No se pudieron cargar tus equipos y jugadores.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    fetchInitialData();
    const tacticsQuery = query(collection(db, 'tactics'), where('authorId', '==', authUser.uid));
    const tacticsUnsub = onSnapshot(tacticsQuery, (querySnapshot) => {
      const tactics = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tactic));
      setTacticsList(tactics.sort((a, b) => ((b.updatedAt as any)?.toMillis() || 0) - ((a.updatedAt as any)?.toMillis() || 0)));
    }, (error) => {
      console.error("Error fetching tactics:", error);
      toast({ title: "Error", description: "No se pudieron cargar las tácticas.", variant: "destructive" });
    });
    return () => tacticsUnsub();
  }, [authUser, userProfile, toast]);

  const resetBoard = useCallback(() => {
    setActiveTactic(null);
    setHistory([{ boardItems: [], drawings: [] }]);
    setHistoryIndex(0);
    setIsDirty(false);
    toast({ title: "Pizarra Limpiada"});
  }, [toast]);

  const handleSelectTactic = useCallback(async (tactic: Tactic) => {
    setIsLoading(true);
    setActiveTactic(tactic);
    try {
        const [boardItemsSnap, drawingsSnap] = await Promise.all([
            getDocs(collection(db, 'tactics', tactic.id, 'boardItems')),
            getDocs(collection(db, 'tactics', tactic.id, 'drawings'))
        ]);
        
        let loadedBoardItems = boardItemsSnap.docs.map(doc => doc.data() as BoardItem);
        let loadedDrawings = drawingsSnap.docs.map(doc => doc.data() as Drawing);
        
        // A tactic is always saved in horizontal coordinate system.
        // If the current board is vertical, we need to transform the loaded data.
        if (boardOrientation === 'vertical') {
            const transformPoint = (point: { x: number; y: number }) => ({ x: 1 - point.y, y: point.x });
            
            loadedBoardItems = loadedBoardItems.map(item => {
                const newItem: BoardItem = { ...item, position: transformPoint(item.position) };
                if (item.type === 'shape') {
                    const currentRotation = item.rotation || 0;
                    const rotationChange = 90;
                    newItem.rotation = (currentRotation + rotationChange + 360) % 360;
                }
                return newItem;
            });
            
            loadedDrawings = loadedDrawings.map(drawing => ({
                ...drawing,
                points: drawing.points.map(transformPoint),
            }));
        }
        
        setHistory([{ boardItems: loadedBoardItems || [], drawings: loadedDrawings || [] }]);
        setHistoryIndex(0);
        setIsDirty(false);
        if (tactic.teamId) setSelectedTeamId(tactic.teamId);
        setIsLibraryOpen(false);
        toast({ title: `Táctica "${tactic.name}" cargada.`});
    } catch (error) {
        console.error("Error loading tactic details:", error);
        toast({ title: "Error al cargar", description: "No se pudieron cargar los detalles de la táctica.", variant: "destructive" });
        resetBoard();
    } finally {
        setIsLoading(false);
    }
  }, [resetBoard, toast, boardOrientation]);

  const handleCreateTactic = async (name: string) => {
    if (!authUser || !userProfile) return;
    setIsLoading(true);
    const newTacticData: Omit<Tactic, 'id'> = {
      name, authorId: authUser.uid, authorName: userProfile.name,
      teamId: selectedTeamId || undefined, 
      orientation: boardOrientation,
      createdAt: serverTimestamp() as any, updatedAt: serverTimestamp() as any,
    };
    const newTacticRef = await addDoc(collection(db, 'tactics'), newTacticData);
    try {
        const batch = writeBatch(db);
        const currentState = history[historyIndex] || { boardItems: [], drawings: [] };
        currentState.boardItems.forEach(item => batch.set(doc(db, 'tactics', newTacticRef.id, 'boardItems', item.id), item));
        currentState.drawings.forEach(drawing => batch.set(doc(db, 'tactics', newTacticRef.id, 'drawings', drawing.id), drawing));
        await batch.commit();
        const newTacticForState: Tactic = { id: newTacticRef.id, ...newTacticData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
        setActiveTactic(newTacticForState); 
        setIsDirty(false);
        setIsLibraryOpen(false);
        toast({ title: `Táctica "${name}" creada y guardada.` });
    } catch (error) {
        console.error("Error creating tactic content:", error);
        await deleteDoc(newTacticRef);
        toast({ title: "Error", description: "No se pudo crear la nueva táctica.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSaveTactic = async () => {
    if (!activeTactic) {
      if (boardItems.length > 0 || drawings.length > 0) {
        setIsLibraryOpen(true);
        toast({ title: "Guardar Nueva Táctica", description: "Por favor, dale un nombre a tu nueva táctica para guardarla." });
      } else {
        toast({ title: "Pizarra Vacía", description: "No hay nada que guardar." });
      }
      return;
    }
    setIsLoading(true);
    toast({ title: "Guardando...", description: "Por favor, espera." });
    try {
        const batch = writeBatch(db);
        const tacticId = activeTactic.id;
        const [oldItemsSnap, oldDrawingsSnap] = await Promise.all([
            getDocs(collection(db, 'tactics', tacticId, 'boardItems')),
            getDocs(collection(db, 'tactics', tacticId, 'drawings')),
        ]);
        oldItemsSnap.forEach(doc => batch.delete(doc.ref));
        oldDrawingsSnap.forEach(doc => batch.delete(doc.ref));
        const currentBoardState = history[historyIndex];
        currentBoardState.boardItems.forEach(item => batch.set(doc(db, 'tactics', tacticId, 'boardItems', item.id), item));
        currentBoardState.drawings.forEach(drawing => batch.set(doc(db, 'tactics', tacticId, 'drawings', drawing.id), drawing));
        batch.update(doc(db, 'tactics', tacticId), { 
          teamId: selectedTeamId || null, 
          orientation: boardOrientation,
          updatedAt: serverTimestamp() 
        });
        await batch.commit();
        setIsDirty(false);
        toast({ title: "Táctica Guardada", description: `"${activeTactic.name}" ha sido guardada.` });
    } catch (error) {
        console.error("Error saving tactic:", error);
        toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleOverwriteTactic = async (tacticToOverwrite: Tactic) => {
    setIsLoading(true);
    toast({ title: "Guardando...", description: `Sobrescribiendo "${tacticToOverwrite.name}"...` });
    try {
        const batch = writeBatch(db);
        const tacticId = tacticToOverwrite.id;
        const [oldItemsSnap, oldDrawingsSnap] = await Promise.all([
            getDocs(collection(db, 'tactics', tacticId, 'boardItems')),
            getDocs(collection(db, 'tactics', tacticId, 'drawings')),
        ]);
        oldItemsSnap.forEach(doc => batch.delete(doc.ref));
        oldDrawingsSnap.forEach(doc => batch.delete(doc.ref));
        const currentBoardState = history[historyIndex];
        currentBoardState.boardItems.forEach(item => batch.set(doc(db, 'tactics', tacticId, 'boardItems', item.id), item));
        currentBoardState.drawings.forEach(drawing => batch.set(doc(db, 'tactics', tacticId, 'drawings', drawing.id), drawing));
        batch.update(doc(db, 'tactics', tacticId), { 
          teamId: selectedTeamId || null, 
          orientation: boardOrientation,
          updatedAt: serverTimestamp() 
        });
        await batch.commit();
        setActiveTactic(tacticToOverwrite);
        setIsDirty(false);
        setIsLibraryOpen(false);
        toast({ title: "Táctica Sobrescrita", description: `"${tacticToOverwrite.name}" ha sido guardada con el nuevo contenido.` });
    } catch (error) {
        console.error("Error overwriting tactic:", error);
        toast({ title: "Error al sobrescribir", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteTactic = async (tacticId: string) => {
    setIsLoading(true);
    try {
        const batch = writeBatch(db);
        const [itemsSnap, drawingsSnap] = await Promise.all([getDocs(collection(db, 'tactics', tacticId, 'boardItems')), getDocs(collection(db, 'tactics', tacticId, 'drawings'))]);
        itemsSnap.forEach(doc => batch.delete(doc.ref));
        drawingsSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(db, 'tactics', tacticId));
        await batch.commit();
        if (activeTactic?.id === tacticId) resetBoard();
        toast({ title: "Táctica eliminada"});
    } catch (error) {
      console.error("Error deleting tactic:", error);
      toast({ title: "Error", description: "No se pudo eliminar la táctica.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdateTacticPreview = async (tacticId: string, imageUrl: string) => {
    try {
        await updateDoc(doc(db, "tactics", tacticId), { previewImageUrl: imageUrl, updatedAt: serverTimestamp() });
        toast({ title: "Vista previa actualizada" });
    } catch (error) {
        console.error("Error updating preview image:", error);
        toast({ title: "Error", description: "No se pudo guardar la vista previa.", variant: "destructive" });
    }
  };
  
  const handleExport = () => {
    const dataStr = JSON.stringify({ boardItems, drawings }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTactic?.name || 'tactica'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Táctica Exportada" });
  };
  
  const handleImportClick = () => importFileRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') throw new Error("File could not be read as text");
        const importedData = JSON.parse(result);
        if (Array.isArray(importedData.boardItems) && Array.isArray(importedData.drawings)) {
          setBoardState(() => ({ boardItems: importedData.boardItems, drawings: importedData.drawings }));
          toast({ title: "Táctica Importada", description: "Se ha cargado el archivo en la pizarra."});
        } else {
          throw new Error("Invalid tactic file format.");
        }
      } catch (error) {
        console.error("Error importing tactic:", error);
        toast({ title: "Error de Importación", description: "El archivo no es una táctica válida.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = async () => {
    if (!boardRef.current) {
        toast({ title: "Error", description: "No se puede encontrar la pizarra.", variant: "destructive" });
        return;
    }
    toast({ title: "Preparando impresión...", description: "Por favor, espera." });

    try {
        const dataUrl = await toPng(boardRef.current, {
            cacheBust: true,
            filter: (node) => {
              if (node instanceof HTMLElement) {
                return !node.hasAttribute('data-snapshot-ignore');
              }
              return true;
            },
            backgroundColor: 'transparent'
        });

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            throw new Error("No se pudo acceder al documento del iframe.");
        }

        iframeDoc.open();
        iframeDoc.write(`
            <html>
                <head>
                    <title>Imprimir Táctica: ${activeTactic?.name || 'Pizarra'}</title>
                    <style>
                        @media print {
                            @page {
                                size: ${boardOrientation === 'horizontal' ? 'landscape' : 'portrait'};
                                margin: 0;
                            }
                            body {
                                margin: 0;
                                background-color: #FFFFFF;
                            }
                            img {
                                width: 100vw;
                                height: 100vh;
                                object-fit: contain;
                            }
                        }
                    </style>
                </head>
                <body>
                    <img src="${dataUrl}" />
                </body>
            </html>
        `);
        iframeDoc.close();
        
        iframe.contentWindow?.focus();

        setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000); 
        }, 500);

    } catch (err) {
        console.error('Error al preparar la impresión:', err);
        toast({ title: "Error de Impresión", description: "No se pudo generar la vista de impresión.", variant: "destructive" });
    }
  };

  const handleSnapshot = async () => {
    if (!boardRef.current) {
        toast({ title: "Error", description: "No se puede encontrar la pizarra.", variant: "destructive" }); return;
    }
    try {
        const dataUrl = await toPng(boardRef.current, { 
            cacheBust: true,
            filter: (node) => {
              if (node instanceof HTMLElement) {
                return !node.hasAttribute('data-snapshot-ignore');
              }
              return true;
            },
            backgroundColor: 'transparent'
        });
        const link = document.createElement('a');
        link.download = `${activeTactic?.name || 'tactica'}-snapshot.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "Snapshot guardado" });
    } catch (err) {
        console.error('Error al tomar el snapshot:', err);
        toast({ title: "Error de Snapshot", description: "No se pudo generar la imagen.", variant: "destructive" });
    }
  };
  
  const handleShare = async () => {
    try {
        if (navigator.share) {
            await navigator.share({ title: `Táctica: ${activeTactic?.name || 'Pizarra Táctica'}`, text: 'Echa un vistazo a esta táctica que he preparado en GesFUT.' });
        } else {
            toast({ title: 'Compartir no soportado', description: 'Tu navegador no soporta la función de compartir. Puedes exportar la táctica.'});
        }
    } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
             console.error('Error al compartir', err);
             toast({ title: 'Error al compartir', description: 'Ha ocurrido un error inesperado.', variant: "destructive"});
        }
    }
  };
  
  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen bg-muted flex flex-col items-center justify-center p-2 sm:p-4 no-print overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        <div className="w-full flex flex-col h-full gap-2">
           <TopToolbar
                activeTacticName={activeTactic?.name}
                onLoadClick={() => setIsLibraryOpen(true)}
                onSaveClick={handleSaveTactic}
                userTeams={userTeams}
                selectedTeamId={selectedTeamId}
                onTeamSelect={setSelectedTeamId}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onExport={handleExport}
                onImport={handleImportClick}
                onPrint={handlePrint}
                onShare={handleShare}
                onToggleOrientation={handleToggleOrientation}
                onSnapshot={handleSnapshot}
                onClearClick={resetBoard}
            />
          <input ref={importFileRef} type="file" onChange={handleImportFile} accept=".json" className="hidden" />
          <div className="flex-1 min-h-0 flex gap-2">
              <div className="relative hidden md:block">
                  <div className={cn("h-full transition-all duration-300 ease-in-out flex flex-col", isToolPanelCollapsed ? 'w-0' : 'w-56')}>
                      <div className={cn("w-56 h-full overflow-hidden", isToolPanelCollapsed && 'invisible')}><ToolPanel activeTool={activeTool} setActiveTool={setActiveTool} onItemSelectForPlacement={handleItemSelectForPlacement} /></div>
                  </div>
                   <Button variant="outline" size="icon" className="absolute bottom-4 -right-3 z-10 h-7 w-7 rounded-full shadow-lg border-2" onClick={() => setIsToolPanelCollapsed(prev => !prev)}>
                        {isToolPanelCollapsed ? <ChevronRight className="h-4 w-4"/> : <ChevronLeft className="h-4 w-4"/>}
                   </Button>
              </div>
              <div className="flex-1 relative min-h-0 flex items-center justify-center">
                <TacticalBoard 
                    id="tactical-board-printable" 
                    boardRef={boardRef} 
                    boardItems={boardItems} 
                    drawings={drawings}
                    onBoardChange={setBoardState}
                    activeTool={activeTool} 
                    setActiveTool={setActiveTool} 
                    activeColor={activeColor} 
                    strokeWidth={strokeWidth} 
                    boardOrientation={boardOrientation}
                    itemForPlacement={itemForPlacement}
                    onItemPlaced={() => setItemForPlacement(null)}
                />
              </div>
               <div className="relative hidden md:block">
                  <div className={cn("h-full transition-all duration-300 ease-in-out flex flex-col", isPlayerPanelCollapsed ? 'w-0' : 'w-56')}>
                      <div className={cn("w-56 h-full overflow-hidden", isPlayerPanelCollapsed && 'invisible')}><PlayerPanel homeTeamPlayers={homeTeamPlayers} awayTeamPlayers={AWAY_TEAM_PLAYERS} boardItems={boardItems} onPlayerColorChange={handlePlayerColorChange} onItemSelectForPlacement={handleItemSelectForPlacement} /></div>
                  </div>
                   <Button variant="outline" size="icon" className="absolute bottom-4 -left-3 z-10 h-7 w-7 rounded-full shadow-lg border-2" onClick={() => setIsPlayerPanelCollapsed(prev => !prev)}>
                        {isPlayerPanelCollapsed ? <ChevronLeft className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                   </Button>
              </div>
          </div>
           <div className="md:hidden">
            <MobileToolbar
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onSave={handleSaveTactic}
              onLoad={() => setIsLibraryOpen(true)}
              onSnapshot={handleSnapshot}
              onPrint={handlePrint}
              onShare={handleShare}
              onClear={resetBoard}
            >
              <Drawer open={isToolPanelOpen} onOpenChange={setIsToolPanelOpen}>
                <DrawerTrigger asChild>
                  <Button variant="ghost" size="icon"><Pencil /></Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Herramientas</DrawerTitle>
                    <DrawerDescription>Selecciona una herramienta o un objeto para colocarlo.</DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4">
                    <ToolPanel 
                      activeTool={activeTool} 
                      setActiveTool={setActiveTool}
                      onItemSelectForPlacement={handleItemSelectForPlacement}
                    />
                  </div>
                </DrawerContent>
              </Drawer>
              <Drawer open={isPlayerPanelOpen} onOpenChange={setIsPlayerPanelOpen}>
                <DrawerTrigger asChild>
                  <Button variant="ghost" size="icon"><Users /></Button>
                </DrawerTrigger>
                <DrawerContent>
                   <DrawerHeader>
                    <DrawerTitle>Jugadores</DrawerTitle>
                    <DrawerDescription>Selecciona un jugador para colocarlo en la pizarra.</DrawerDescription>
                  </DrawerHeader>
                  <div className="p-2">
                    <PlayerPanel 
                      homeTeamPlayers={homeTeamPlayers} 
                      awayTeamPlayers={AWAY_TEAM_PLAYERS} 
                      boardItems={boardItems} 
                      onPlayerColorChange={handlePlayerColorChange}
                      onItemSelectForPlacement={handleItemSelectForPlacement}
                    />
                  </div>
                </DrawerContent>
              </Drawer>
            </MobileToolbar>
          </div>
          <TacticsLibraryDialog
            open={isLibraryOpen}
            onOpenChange={setIsLibraryOpen}
            tactics={tacticsList}
            userTeams={userTeams}
            onSelect={handleSelectTactic}
            onCreate={handleCreateTactic}
            onDelete={handleDeleteTactic}
            isLoading={isLoading}
            onOverwrite={handleOverwriteTactic}
            onUpdatePreview={handleUpdateTacticPreview}
            isDirty={isDirty}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
