
'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { BoardItem, Drawing, BoardTool, TacticsPlayer } from '@/types';
import { PlayerToken } from './PlayerToken';
import { Shape } from './Shape';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DRAWING_COLORS, STROKE_WIDTHS } from '@/lib/tactics-data';
import { Copy, Palette, PencilLine, Trash2, Edit3, Eraser, MousePointer, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface TacticalBoardProps {
  id?: string;
  boardRef: React.RefObject<HTMLDivElement>;
  boardItems: BoardItem[];
  drawings: Drawing[];
  onBoardChange: (updater: (prevState: { boardItems: BoardItem[], drawings: Drawing[] }) => { boardItems: BoardItem[], drawings: Drawing[] }) => void;
  activeTool: BoardTool;
  setActiveTool: (tool: BoardTool) => void;
  activeColor: string;
  strokeWidth: number;
  boardOrientation: 'horizontal' | 'vertical';
  itemForPlacement: any | null;
  onItemPlaced: () => void;
}

function getPathData(points: { x: number; y: number }[], boardRect: DOMRect): string {
    if (points.length < 2 || !boardRect) return '';
    const pathParts = points.map((p, i) => {
        const x = p.x * boardRect.width;
        const y = p.y * boardRect.height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return pathParts.join(' ');
}

function isItemInRect(item: BoardItem | Drawing, rect: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
  if (item.type === 'player' || item.type === 'shape') {
    const { x, y } = (item as BoardItem).position;
    return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
  }
  return (item as Drawing).points.some(p => p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY);
}

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  id, boardRef, boardItems, drawings, onBoardChange,
  activeTool, setActiveTool, activeColor, strokeWidth,
  boardOrientation, itemForPlacement, onItemPlaced,
}) => {
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const [currentAction, setCurrentAction] = useState<{
    type: 'drawing' | 'moving' | 'selecting' | 'resizing',
    data: any
  } | null>(null);

  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; value: string; color: string; strokeWidth: number; isNew: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  const getCanvasPosition = useCallback((e: { clientX: number, clientY: number }) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }, [boardRef]);

   useEffect(() => {
    if (!boardRef.current) return;
    const updateRect = () => {
        if (boardRef.current) {
            setBoardRect(boardRef.current.getBoundingClientRect());
        }
    };
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(boardRef.current);
    updateRect();
    return () => resizeObserver.disconnect();
  }, [boardRef]);
  
  useEffect(() => {
    if (editingText && textAreaRef.current) {
        textAreaRef.current.focus();
    }
  }, [editingText]);

  
  const selectionBoundingBox = useMemo(() => {
    if (selectedItemIds.size === 0) return null;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    
    const checkPoint = (p: {x: number, y: number}) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    };

    boardItems.forEach(item => {
        if (selectedItemIds.has(item.id)) checkPoint(item.position);
    });
    drawings.forEach(drawing => {
        if (selectedItemIds.has(drawing.id)) drawing.points.forEach(checkPoint);
    });
    
    if (maxX < minX) return null;
    
    const padding = 0.02;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(1 - (minX - padding), (maxX - minX) + padding * 2),
      height: Math.min(1 - (minY - padding), (maxY - minY) + padding * 2),
    };

  }, [selectedItemIds, boardItems, drawings]);


  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (editingText) {
      setEditingText({ ...editingText, value: e.target.value });
    }
  };

  const handleTextSubmit = useCallback(() => {
    if (!editingText) return;
    const trimmedValue = editingText.value.trim();

    onBoardChange(prev => {
      const existingIndex = prev.drawings.findIndex(d => d.id === editingText.id);
      
      if (trimmedValue) {
        const textDrawing: Drawing = {
          id: editingText.id, type: 'text', points: [{ x: editingText.x, y: editingText.y }],
          text: trimmedValue, color: editingText.color, strokeWidth: editingText.strokeWidth,
        };
        if (existingIndex > -1) {
          const newDrawings = [...prev.drawings];
          newDrawings[existingIndex] = textDrawing;
          return { ...prev, drawings: newDrawings };
        } else {
          return { ...prev, drawings: [...prev.drawings, textDrawing] };
        }
      } else {
        if (existingIndex > -1) {
          return { ...prev, drawings: prev.drawings.filter(d => d.id !== editingText.id) };
        }
      }
      return prev; // No change if new text is empty
    });

    setEditingText(null);
  }, [editingText, onBoardChange]);
  
  const handleEditText = useCallback((drawingId: string | null) => {
    if (!drawingId) return;
    const drawingToEdit = drawings.find(d => d.id === drawingId);
    if (drawingToEdit?.type === 'text') {
      setEditingText({
        id: drawingToEdit.id, x: drawingToEdit.points[0].x, y: drawingToEdit.points[0].y,
        value: drawingToEdit.text || '', color: drawingToEdit.color, strokeWidth: drawingToEdit.strokeWidth, isNew: false,
      });
      setActiveTool('text');
    }
  }, [drawings, setActiveTool]);
  
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;

    if (itemForPlacement) {
      const position = getCanvasPosition(e);
      const newItem: BoardItem = {
        id: `item_${Date.now()}`,
        type: itemForPlacement.type,
        elementId: itemForPlacement.type === 'player' ? itemForPlacement.player.id : itemForPlacement.shape.id,
        position,
        data: itemForPlacement.type === 'player' ? itemForPlacement.player : itemForPlacement.shape,
        scale: 1, rotation: 0,
      };
      onBoardChange(prev => ({...prev, boardItems: [...prev.boardItems, newItem]}));
      onItemPlaced();
      e.stopPropagation(); // Stop propagation to prevent other actions
      return;
    }

    if (editingText && !target.closest('textarea')) {
      handleTextSubmit();
      return; 
    }
    
    if (target.closest('[data-item-id]') || target.closest('[data-handle-type]') || target.closest('textarea')) {
        return;
    }
    
    const pos = getCanvasPosition(e);
    
    switch (activeTool) {
        case 'text':
            setEditingText({
                id: `text_${Date.now()}`,
                x: pos.x, y: pos.y, value: '',
                color: activeColor, strokeWidth, isNew: true,
            });
            break;
        case 'selection':
            setCurrentAction({ type: 'selecting', data: { start: pos, end: pos } });
            setSelectedItemIds(new Set());
            break;
        case 'move':
            setSelectedItemIds(new Set());
            break;
        default: // Drawing tools
            const newDrawing = {
                id: `drawing_${Date.now()}`,
                type: activeTool,
                points: [pos],
                color: activeColor,
                strokeWidth,
            };
            setCurrentAction({ type: 'drawing', data: { drawing: newDrawing } });
            break;
    }
  };


  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentAction) return;

    const pos = getCanvasPosition(e);

    switch(currentAction.type) {
        case 'drawing': {
            let newDrawing = currentAction.data.drawing;
            if (['line', 'arrow', 'circle', 'rectangle', 'dashed-line', 'curved-arrow', 'shaded-area'].includes(newDrawing.type)) {
              newDrawing = { ...newDrawing, points: [newDrawing.points[0], pos] };
            } else {
              newDrawing = { ...newDrawing, points: [...newDrawing.points, pos] };
            }
            setCurrentAction({ ...currentAction, data: { drawing: newDrawing } });
            break;
        }
        case 'selecting': {
            setCurrentAction({ ...currentAction, data: { ...currentAction.data, end: pos } });
            break;
        }
        case 'moving': {
            const dx = pos.x - currentAction.data.initialPos.x;
            const dy = pos.y - currentAction.data.initialPos.y;
            onBoardChange(prevState => ({
                boardItems: prevState.boardItems.map(item => {
                    if (currentAction.data.movingIds.has(item.id)) {
                        const originalPos = currentAction.data.originalItemPositions.get(item.id)!;
                        const newX = Math.max(0, Math.min(1, originalPos.x + dx));
                        const newY = Math.max(0, Math.min(1, originalPos.y + dy));
                        return { ...item, position: { x: newX, y: newY } };
                    }
                    return item;
                }),
                drawings: prevState.drawings.map(drawing => {
                    if (currentAction.data.movingIds.has(drawing.id)) {
                        const originalPoints = currentAction.data.originalDrawingPoints.get(drawing.id)!;
                        return { ...drawing, points: originalPoints.map(p => ({ 
                          x: Math.max(0, Math.min(1, p.x + dx)), 
                          y: Math.max(0, Math.min(1, p.y + dy)) 
                        })) };
                    }
                    return drawing;
                })
            }));
            break;
        }
        case 'resizing': {
          onBoardChange(prev => ({
              ...prev,
              drawings: prev.drawings.map(d => {
                  if (d.id === currentAction.data.id) {
                      const newPoints = [...d.points];
                      if (currentAction.data.handle === 'start') newPoints[0] = pos;
                      else newPoints[1] = pos;
                      return { ...d, points: newPoints };
                  }
                  return d;
              })
          }));
          break;
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentAction) return;

    switch(currentAction.type) {
        case 'drawing': {
            const { drawing } = currentAction.data;
            if (drawing.points.length < 1) break;

            let finalDrawing = { ...drawing };
            if (['line', 'arrow', 'circle', 'rectangle', 'dashed-line', 'curved-arrow', 'shaded-area'].includes(finalDrawing.type) && drawing.points.length > 1) {
                finalDrawing.points = [finalDrawing.points[0], finalDrawing.points[finalDrawing.points.length - 1]];
            }
            onBoardChange(prev => ({...prev, drawings: [...prev.drawings, finalDrawing]}));
            break;
        }
        case 'selecting': {
            const { start, end } = currentAction.data;
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            const idsInRect = new Set<string>();
            [...boardItems, ...drawings].forEach(item => {
                if (isItemInRect(item, { minX, maxX, minY, maxY })) {
                idsInRect.add(item.id);
                }
            });
            setSelectedItemIds(idsInRect);
            break;
        }
        case 'moving':
        case 'resizing': {
            break;
        }
    }

    setCurrentAction(null);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dataString = e.dataTransfer.getData('application/json');
    if (!dataString) return;
    const data = JSON.parse(dataString);
    const pos = getCanvasPosition(e);
    
    const newItem: BoardItem = {
      id: `item_${Date.now()}`, type: data.type,
      elementId: data.type === 'player' ? data.player.id : data.shape.id,
      position: pos, data: data.type === 'player' ? data.player : data.shape,
      scale: 1, rotation: 0,
    };
    onBoardChange(prev => ({...prev, boardItems: [...prev.boardItems, newItem]}));
  };
  
  const handleItemMoveStart = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    
    const pos = getCanvasPosition(e);
    let newSelectedIds: Set<string>;

    if (activeTool === 'selection') {
        newSelectedIds = e.ctrlKey || e.metaKey ? new Set(selectedItemIds).add(id) : new Set([id]);
        setSelectedItemIds(newSelectedIds);
    } else {
        newSelectedIds = new Set([id]);
        setSelectedItemIds(new Set()); 
    }
    
    const originalItemPositions = new Map<string, { x: number, y: number }>();
    const originalDrawingPoints = new Map<string, { x: number, y: number }[]>();
    boardItems.forEach(item => { if (newSelectedIds.has(item.id)) originalItemPositions.set(item.id, item.position); });
    drawings.forEach(drawing => { if (newSelectedIds.has(drawing.id)) originalDrawingPoints.set(drawing.id, drawing.points); });

    setCurrentAction({ type: 'moving', data: { movingIds: newSelectedIds, initialPos: pos, originalItemPositions, originalDrawingPoints } });
  }, [boardItems, drawings, selectedItemIds, getCanvasPosition, activeTool]);

  const handleDrawingMoveStart = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    
    const pos = getCanvasPosition(e);
    let newSelectedIds: Set<string>;
    
    if (activeTool === 'selection') {
        newSelectedIds = e.ctrlKey || e.metaKey ? new Set(selectedItemIds).add(id) : new Set([id]);
        setSelectedItemIds(newSelectedIds);
    } else {
        newSelectedIds = new Set([id]);
        setSelectedItemIds(new Set());
    }
    
    const originalItemPositions = new Map<string, { x: number, y: number }>();
    const originalDrawingPoints = new Map<string, { x: number, y: number }[]>();
    boardItems.forEach(item => { if (newSelectedIds.has(item.id)) originalItemPositions.set(item.id, item.position); });
    drawings.forEach(drawing => { if (newSelectedIds.has(drawing.id)) originalDrawingPoints.set(drawing.id, drawing.points); });

    setCurrentAction({ type: 'moving', data: { movingIds: newSelectedIds, initialPos: pos, originalItemPositions, originalDrawingPoints } });
  }, [boardItems, drawings, selectedItemIds, getCanvasPosition, activeTool]);

  const deleteItem = useCallback((id: string) => onBoardChange(prev => ({ ...prev, boardItems: prev.boardItems.filter(i => i.id !== id) })), [onBoardChange]);
  const deleteDrawing = useCallback((id: string) => onBoardChange(prev => ({ ...prev, drawings: prev.drawings.filter(d => d.id !== id) })), [onBoardChange]);
  
  const onDuplicateItem = useCallback((id: string) => {
    const originalItem = boardItems.find(i => i.id === id);
    if (originalItem && originalItem.type !== 'player') {
      const newItem = { ...originalItem, id: `item_${Date.now()}`, position: { x: originalItem.position.x + 0.02, y: originalItem.position.y + 0.02 }};
      onBoardChange(prev => ({ ...prev, boardItems: [...prev.boardItems, newItem] }));
    }
  }, [boardItems, onBoardChange]);
  
  const onChangeItemColor = useCallback((id: string, color: string) => {
    onBoardChange(prev => ({ ...prev, boardItems: prev.boardItems.map(item => {
        if (item.id === id) {
             if (item.type === 'player' || item.type === 'shape') return { ...item, data: { ...item.data, color } };
        }
        return item;
    })}));
  }, [onBoardChange]);
  
  const onResizeItem = useCallback((id: string, factor: number) => {
    onBoardChange(prev => ({ ...prev, boardItems: prev.boardItems.map(item => {
      if (item.id === id && item.type === 'shape') {
        const newScale = Math.max(0.2, Math.min(5, (item.scale || 1) * factor));
        return { ...item, scale: newScale };
      }
      return item;
    })}));
  }, [onBoardChange]);

  const onRotateItem = useCallback((id: string) => {
    onBoardChange(prev => ({ ...prev, boardItems: prev.boardItems.map(item => {
      if (item.id === id && item.type === 'shape') {
        return { ...item, rotation: ((item.rotation || 0) + 90) % 360 };
      }
      return item;
    })}));
  }, [onBoardChange]);

  const changeDrawingColor = useCallback((id: string, color: string) => onBoardChange(prev => ({...prev, drawings: prev.drawings.map(d => d.id === id ? {...d, color} : d)})), [onBoardChange]);
  const changeDrawingStrokeWidth = useCallback((id: string, width: number) => onBoardChange(prev => ({...prev, drawings: prev.drawings.map(d => d.id === id ? {...d, strokeWidth: width} : d)})), [onBoardChange]);
  const duplicateDrawing = useCallback((id: string) => {
    const originalDrawing = drawings.find(d => d.id === id);
    if (originalDrawing) {
      const newDrawing = { ...originalDrawing, id: `drawing_${Date.now()}`, points: originalDrawing.points.map(p => ({ x: p.x + 0.02, y: p.y + 0.02 }))};
      onBoardChange(prev => ({...prev, drawings: [...prev.drawings, newDrawing]}));
    }
  }, [drawings, onBoardChange]);
  
  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.size === 0) return;
    onBoardChange(prev => ({
        boardItems: prev.boardItems.filter(item => !selectedItemIds.has(item.id)),
        drawings: prev.drawings.filter(drawing => !selectedItemIds.has(drawing.id)),
    }));
    setSelectedItemIds(new Set());
  }, [selectedItemIds, onBoardChange]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedItemIds.size === 0) return;
    onBoardChange(prev => {
      const newItems = prev.boardItems.filter(i => selectedItemIds.has(i.id) && i.type !== 'player').map(item => ({...item, id: `item_${Date.now()}_${Math.random()}`, position: { x: item.position.x + 0.02, y: item.position.y + 0.02 }}));
      const newDrawings = prev.drawings.filter(d => selectedItemIds.has(d.id)).map(drawing => ({...drawing, id: `drawing_${Date.now()}_${Math.random()}`, points: drawing.points.map(p => ({ x: p.x + 0.02, y: p.y + 0.02 }))}));
      const newIds = new Set([...newItems.map(i => i.id), ...newDrawings.map(d => d.id)]);
      setSelectedItemIds(newIds);
      return { boardItems: [...prev.boardItems, ...newItems], drawings: [...prev.drawings, ...newDrawings] };
    });
  }, [selectedItemIds, onBoardChange]);

  const handleChangeSelectedColor = useCallback((color: string) => {
    if (selectedItemIds.size === 0) return;
    onBoardChange(prev => ({
      boardItems: prev.boardItems.map(item => selectedItemIds.has(item.id) ? { ...item, data: { ...item.data, color } } : item),
      drawings: prev.drawings.map(drawing => selectedItemIds.has(drawing.id) ? { ...drawing, color } : drawing),
    }));
  }, [selectedItemIds, onBoardChange]);
  
  if (!boardRect) {
    return (
      <div id={id} ref={boardRef} className={cn("relative bg-center bg-no-repeat bg-contain shadow-xl border border-border/50 rounded-lg", "max-w-full max-h-full", boardOrientation === 'horizontal' ? 'aspect-[3/2] w-full' : 'aspect-[2/3] h-full', "flex items-center justify-center bg-muted")} >
        <p className="text-muted-foreground">Cargando pizarra...</p>
      </div>
    );
  }

  const drawingsToRender = currentAction?.type === 'drawing' ? [...drawings, currentAction.data.drawing] : drawings;

  return (
    <div
      id={id} ref={boardRef}
      className={cn(
        "relative bg-center bg-no-repeat bg-contain shadow-xl border border-border/50 rounded-lg overflow-hidden", 
        "max-w-full max-h-full", 
        boardOrientation === 'horizontal' ? 'aspect-[3/2] w-full' : 'aspect-[2/3] h-full', 
        itemForPlacement 
            ? 'cursor-copy' 
            : (activeTool !== 'move' && activeTool !== 'selection' && 'cursor-crosshair')
      )}
      style={{ 
        backgroundImage: boardOrientation === 'horizontal' ? "url('/pitch-background-horizontal.png')" : "url('/pitch-background-vertical.png')", 
        backgroundColor: 'hsl(var(--muted))',
        touchAction: 'none'
      }}
      onDragOver={handleDragOver} onDrop={handleDrop} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
        {drawingsToRender.map(drawing => {
            if (drawing.points.length < 1) return null;
            if (drawing.type !== 'text' && drawing.points.length < 2) return null;
            const rect = boardRect;
            
            const drawingElementAndHandles = (() => {
                const start = { x: drawing.points[0].x * rect.width, y: drawing.points[0].y * rect.height };
                const end = drawing.points.length > 1 ? { x: drawing.points[1].x * rect.width, y: drawing.points[1].y * rect.height } : start;
                let visualElement: React.ReactNode = null, hitAreaElement: React.ReactNode = null;
                
                switch (drawing.type) {
                  case 'pencil':
                    const pathData = getPathData(drawing.points, rect);
                    visualElement = <path d={pathData} stroke={drawing.color} strokeWidth={drawing.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                    hitAreaElement = <path d={pathData} stroke="transparent" strokeWidth={drawing.strokeWidth + 10} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                    break;
                  case 'line': case 'arrow': case 'dashed-line':
                    visualElement = (<>
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={drawing.color} strokeWidth={drawing.strokeWidth} strokeLinecap="round" strokeDasharray={drawing.type === 'dashed-line' ? `${drawing.strokeWidth * 2} ${drawing.strokeWidth * 2}` : 'none'} />
                        {drawing.type === 'arrow' && (() => { const angle = Math.atan2(end.y - start.y, end.x - start.x), headlen = drawing.strokeWidth * 2.5, p1 = { x: end.x - headlen * Math.cos(angle - Math.PI / 6), y: end.y - headlen * Math.sin(angle - Math.PI / 6) }, p2 = { x: end.x - headlen * Math.cos(angle + Math.PI / 6), y: end.y - headlen * Math.sin(angle + Math.PI / 6) }; return <path d={`M ${p1.x} ${p1.y} L ${end.x} ${end.y} L ${p2.x} ${p2.y}`} strokeWidth={drawing.strokeWidth} fill={drawing.color} strokeLinecap="round" strokeLinejoin="round" />; })()}
                      </>);
                    hitAreaElement = <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={drawing.strokeWidth + 10} strokeLinecap="round" />;
                    break;
                  case 'curved-arrow':
                    const curvature = 0.3, mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2, dx = end.x - start.x, dy = end.y - start.y, controlX = mx - dy * curvature, controlY = my + dx * curvature, curvedPathData = `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`, angle = Math.atan2(end.y - controlY, end.x - controlX), headlen = drawing.strokeWidth * 2.5, p1 = { x: end.x - headlen * Math.cos(angle - Math.PI / 6), y: end.y - headlen * Math.sin(angle - Math.PI / 6) }, p2 = { x: end.x - headlen * Math.cos(angle + Math.PI / 6), y: end.y - headlen * Math.sin(angle + Math.PI / 6) };
                    visualElement = (<><path d={curvedPathData} stroke={drawing.color} strokeWidth={drawing.strokeWidth} fill="none" strokeLinecap="round" /><path d={`M ${p1.x} ${p1.y} L ${end.x} ${end.y} L ${p2.x} ${p2.y}`} stroke={drawing.color} strokeWidth={drawing.strokeWidth} fill={drawing.color} strokeLinecap="round" strokeLinejoin="round" /></>);
                    hitAreaElement = <path d={curvedPathData} stroke="transparent" strokeWidth={drawing.strokeWidth + 10} fill="none" />;
                    break;
                  case 'rectangle': case 'shaded-area':
                    visualElement = <rect x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)} width={Math.abs(start.x - end.x)} height={Math.abs(start.y - end.y)} stroke={drawing.color} strokeWidth={drawing.strokeWidth} fill={drawing.type === 'shaded-area' ? drawing.color : 'none'} fillOpacity={drawing.type === 'shaded-area' ? 0.3 : 0} rx="4" />;
                    hitAreaElement = visualElement; break;
                  case 'circle':
                    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                    visualElement = <circle cx={start.x} cy={start.y} r={radius} stroke={drawing.color} strokeWidth={drawing.strokeWidth} fill="none" />;
                    hitAreaElement = visualElement; break;
                  case 'text':
                    if (!drawing.text || drawing.points.length === 0 || (editingText && editingText.id === drawing.id)) return null;
                    const textStart = { x: drawing.points[0].x * rect.width, y: drawing.points[0].y * rect.height };
                    const lines = drawing.text.split('\n'), fontSize = (drawing.strokeWidth * 2) + 8, textProps = { fill: drawing.color, fontSize: fontSize, fontWeight: "bold" as const, paintOrder: "stroke" as const, stroke: "rgba(0,0,0,0.7)", strokeWidth: 2, strokeLinejoin: "round" as const, };
                    visualElement = (<g transform={`translate(${textStart.x}, ${textStart.y})`}>{lines.map((line, index) => (<text key={index} x="0" y={index * (fontSize * 1.2)} {...textProps}>{line}</text>))}</g>);
                    hitAreaElement = visualElement; break;
                  default: return null;
                }
                const isSelected = selectedItemIds.has(drawing.id);
                return (
                  <g>
                    <g 
                      className={cn(
                        "pointer-events-none",
                        isSelected && "brightness-150"
                      )}
                      style={{ filter: isSelected ? 'drop-shadow(0 0 5px hsl(var(--primary)))' : 'none' }}
                    >
                      {visualElement}
                    </g>
                    <g className="pointer-events-auto cursor-move" onPointerDown={(e) => { if (e.button === 0) handleDrawingMoveStart(e, drawing.id); }}>{hitAreaElement}</g>
                     {['line', 'arrow', 'dashed-line', 'curved-arrow'].includes(drawing.type) && activeTool === 'move' && (<><circle cx={start.x} cy={start.y} r="8" fill="rgba(0, 123, 255, 0.5)" data-handle-type="start" className="pointer-events-auto cursor-grab" onPointerDown={(e) => { e.stopPropagation(); setCurrentAction({ type: 'resizing', data: { id: drawing.id, handle: 'start' } }) }}/><circle cx={end.x} cy={end.y} r="8" fill="rgba(0, 123, 255, 0.5)" data-handle-type="end" className="pointer-events-auto cursor-grab" onPointerDown={(e) => { e.stopPropagation(); setCurrentAction({ type: 'resizing', data: { id: drawing.id, handle: 'end' } }) }}/></>)}
                  </g>
                );
            })();

            if (!drawingElementAndHandles) return null;

            return (
              <ContextMenu key={drawing.id}>
                  <ContextMenuTrigger asChild><g data-drawing-id={drawing.id} onDoubleClick={() => handleEditText(drawing.id)} onPointerDown={(e) => { if (e.button === 0) handleDrawingMoveStart(e, drawing.id); }}>{drawingElementAndHandles}</g></ContextMenuTrigger>
                  <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                      {drawing.type === 'text' && (<><ContextMenuItem onSelect={() => handleEditText(drawing.id)}><Edit3 className="mr-2 h-4 w-4" /> Editar Texto</ContextMenuItem><ContextMenuSeparator /></>)}
                      <ContextMenuSub><ContextMenuSubTrigger><Palette className="mr-2 h-4 w-4" />Color</ContextMenuSubTrigger><ContextMenuSubContent>{DRAWING_COLORS.map(color => (<ContextMenuItem key={color.value} onSelect={() => changeDrawingColor(drawing.id, color.value)}><div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color.value }} />{color.label}</ContextMenuItem>))}</ContextMenuSubContent></ContextMenuSub>
                      <ContextMenuSub><ContextMenuSubTrigger><PencilLine className="mr-2 h-4 w-4" />Grosor</ContextMenuSubTrigger><ContextMenuSubContent>{STROKE_WIDTHS.map(width => (<ContextMenuItem key={width.value} onSelect={() => changeDrawingStrokeWidth(drawing.id, width.value)}><span className="mr-2">{width.label}</span> ({width.value}px)</ContextMenuItem>))}</ContextMenuSubContent></ContextMenuSub>
                      <ContextMenuSeparator /><ContextMenuItem onSelect={() => duplicateDrawing(drawing.id)}><Copy className="mr-2 h-4 w-4" /> Duplicar</ContextMenuItem>
                      <ContextMenuItem className="text-destructive" onSelect={() => deleteDrawing(drawing.id)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</ContextMenuItem>
                  </ContextMenuContent>
              </ContextMenu>
            );
        })}
      </svg>
      
      {currentAction?.type === 'selecting' && (
        <div className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-500/20"
          style={{
            left: `${Math.min(currentAction.data.start.x, currentAction.data.end.x) * 100}%`, top: `${Math.min(currentAction.data.start.y, currentAction.data.end.y) * 100}%`,
            width: `${Math.abs(currentAction.data.start.x - currentAction.data.end.x) * 100}%`, height: `${Math.abs(currentAction.data.start.y - currentAction.data.end.y) * 100}%`, zIndex: 60,
          }}
        />
      )}

      {selectionBoundingBox && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div data-selection-box="true" className="absolute border-2 border-blue-500 cursor-move"
              style={{
                left: `${selectionBoundingBox.x * 100}%`, top: `${selectionBoundingBox.y * 100}%`,
                width: `${selectionBoundingBox.width * 100}%`, height: `${selectionBoundingBox.height * 100}%`, zIndex: 60,
              }}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={handleDuplicateSelected}><Copy className="mr-2 h-4 w-4" /> Duplicar Selección</ContextMenuItem>
            <ContextMenuSub><ContextMenuSubTrigger><Palette className="mr-2 h-4 w-4" />Cambiar Color</ContextMenuSubTrigger>
              <ContextMenuSubContent>{DRAWING_COLORS.map(color => (<ContextMenuItem key={color.value} onSelect={() => handleChangeSelectedColor(color.value)}><div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color.value }} /> {color.label}</ContextMenuItem>))}</ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onSelect={handleDeleteSelected}><Trash2 className="mr-2 h-4 w-4" /> Eliminar Selección</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}

      {editingText && (
        <textarea
            ref={textAreaRef}
            value={editingText.value}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingText(null); // Cancel without saving
                }
            }}
            onChange={handleTextChange}
            style={{
                position: 'absolute',
                left: `${editingText.x * 100}%`,
                top: `${editingText.y * 100}%`,
                transform: 'translateY(-50%)',
                zIndex: 70,
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid hsl(var(--primary))',
                color: editingText.color,
                padding: '4px 8px',
                borderRadius: '6px',
                minWidth: '150px',
                minHeight: '40px',
                fontSize: `${(editingText.strokeWidth * 2) + 8}px`,
                fontWeight: 'bold',
                resize: 'none',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
        />
      )}
      
      {boardItems.filter(item => item.type === 'shape').map(item => (
        <Shape 
            key={item.id} 
            item={item} 
            isSelected={selectedItemIds.has(item.id)}
            isMoving={currentAction?.type === 'moving' && currentAction.data.movingIds.has(item.id)}
            onMoveStart={handleItemMoveStart} 
            onDelete={deleteItem} 
            onChangeColor={onChangeItemColor} 
            onResize={onResizeItem} 
            onRotate={onRotateItem} 
            onDuplicate={onDuplicateItem} 
            onDoubleClick={() => {}} 
            boardOrientation={boardOrientation}
        />
      ))}

      {boardItems.filter(item => item.type === 'player').map(item => (
        <PlayerToken 
            key={item.id} 
            item={item} 
            isSelected={selectedItemIds.has(item.id)}
            isMoving={currentAction?.type === 'moving' && currentAction.data.movingIds.has(item.id)}
            onMoveStart={handleItemMoveStart} 
            onDelete={deleteItem} 
            onChangeColor={onChangeItemColor} 
            onDoubleClick={() => {}} 
            boardOrientation={boardOrientation} 
        />
      ))}
    </div>
  );
};
