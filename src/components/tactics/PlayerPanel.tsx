
'use client';

import React, { useState, useMemo } from 'react';
import type { TacticsPlayer, Player, BoardItem } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Users,
  Target,
  Shirt,
} from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DRAWING_COLORS } from '@/lib/tactics-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';

interface PlayerPanelProps {
  homeTeamPlayers: TacticsPlayer[];
  awayTeamPlayers: TacticsPlayer[];
  boardItems: BoardItem[];
  onPlayerColorChange: (playerId: string, color: string) => void;
  onItemSelectForPlacement: (itemData: any) => void;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  homeTeamPlayers,
  awayTeamPlayers,
  boardItems,
  onPlayerColorChange,
  onItemSelectForPlacement,
}) => {
  const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');
  const [contextMenuPlayerId, setContextMenuPlayerId] = useState<string | null>(null);

  const playersOnBoardIds = useMemo(() => new Set(boardItems.filter(item => item.type === 'player').map(item => item.elementId)), [boardItems]);

  const playerGroups = useMemo(() => {
    const playersToGroup = activeTeamTab === 'home' ? homeTeamPlayers : [];
    return playersToGroup.reduce((acc, player) => {
      const position = player.position || 'Desconocido';
      if (!acc[position]) acc[position] = [];
      acc[position].push(player);
      return acc;
    }, {} as Record<string, TacticsPlayer[]>);
  }, [activeTeamTab, homeTeamPlayers]);
  
  const sortedAwayTeamPlayers = useMemo(() => {
    return [...awayTeamPlayers].sort((a,b) => (a.number || 999) - (b.number || 999));
  }, [awayTeamPlayers]);

  const positionOrder: Player['position'][] = ['Portero', 'Defensa', 'Centrocampista', 'Delantero'];

  const defaultOpenPositions = useMemo(() => {
    return positionOrder.filter(pos => playerGroups[pos]?.length > 0);
  }, [playerGroups, positionOrder]);


  const getCategoryIcon = (position: Player['position']) => {
    const className = "w-4 h-4 mr-2";
    switch (position) {
      case 'Portero': return <Target className={cn(className, "text-yellow-600")} />;
      case 'Defensa': return <Shirt className={cn(className, "text-blue-600")} />;
      case 'Centrocampista': return <Users className={cn(className, "text-green-600")} />;
      case 'Delantero': return <Shirt className={cn(className, "text-red-600")} />;
      default: return <Users className={cn(className, "text-gray-600")} />;
    }
  };

  const renderPlayer = (player: TacticsPlayer) => {
    const isPlayerOnBoard = playersOnBoardIds.has(player.id);
    
    return (
      <ContextMenu key={player.id} onOpenChange={(isOpen) => setContextMenuPlayerId(isOpen ? player.id : null)}>
        <ContextMenuTrigger disabled={player.team !== 'home'}>
            <div
                draggable={!isPlayerOnBoard}
                onDragStart={(e) => {
                  if (isPlayerOnBoard) { e.preventDefault(); return; }
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'player', player }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  if (!isPlayerOnBoard) {
                      onItemSelectForPlacement({ type: 'player', player });
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-1 rounded-md border-2 border-transparent bg-muted/50 text-card-foreground hover:border-primary hover:bg-accent/50 transition-colors",
                  isPlayerOnBoard 
                    ? 'opacity-40 cursor-not-allowed bg-muted border-transparent'
                    : 'cursor-pointer md:cursor-grab'
                )}
            >
                <div className="relative w-12 h-14 bg-muted rounded-md shadow-sm overflow-hidden border" style={{borderColor: player.color}}>
                     {player.avatarUrl ? (
                         <Image src={player.avatarUrl} alt={player.nickname || player.name} layout="fill" objectFit="cover" data-ai-hint="player avatar" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: player.color, color: 'white' }}>
                            {player.nickname ? player.nickname.substring(0, 1) : '?'}
                         </div>
                     )}
                     <div 
                        className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm border border-background"
                        style={{ backgroundColor: player.color }}
                    >
                      {player.number}
                    </div>
                </div>
                <div className="font-medium truncate text-[10px] leading-tight w-full text-center">{player.nickname}</div>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Color de Grupo</ContextMenuLabel>
          <ContextMenuSeparator/>
          {DRAWING_COLORS.map(color => (
            <ContextMenuItem key={color.value} onSelect={() => onPlayerColorChange(player.id, color.value)}>
              <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color.value }} />
              <span>{color.label}</span>
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <div className="bg-card text-card-foreground flex flex-col h-full border-l border-border rounded-lg shadow-md">
      <div className="p-2 border-b shrink-0">
          <Tabs value={activeTeamTab} onValueChange={(v) => setActiveTeamTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="home">Local</TabsTrigger>
                <TabsTrigger value="away">Visitante</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>
      <div className="relative flex-1">
        <ScrollArea className="absolute inset-0">
          <div className="p-2">
            {activeTeamTab === 'home' ? (
                <Accordion
                    type="multiple"
                    className="w-full"
                    defaultValue={defaultOpenPositions}
                >
                    {positionOrder.map(position => {
                        const players = playerGroups[position] || [];
                        if (players.length === 0) return null;
                        const sortedPlayers = [...players].sort((a,b) => (a.number || 999) - (b.number || 999));
                        return (
                            <AccordionItem key={position} value={position} className="border-b-0">
                                <AccordionTrigger className="text-xs uppercase font-semibold hover:no-underline py-2 rounded-md px-2 hover:bg-accent/50">
                                    <div className="flex items-center">
                                        {getCategoryIcon(position)} {position} ({players.length})
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-4 gap-1 pt-1">
                                        {sortedPlayers.map(player => renderPlayer(player))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                  {sortedAwayTeamPlayers.map(player => {
                      const isPlayerOnBoard = playersOnBoardIds.has(player.id);
                      return (
                          <div
                              key={player.id}
                              draggable={!isPlayerOnBoard}
                              onDragStart={(e) => {
                                  if (isPlayerOnBoard) { e.preventDefault(); return; }
                                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'player', player }));
                                  e.dataTransfer.effectAllowed = 'copy';
                              }}
                              onClick={() => {
                                if (!isPlayerOnBoard) {
                                    onItemSelectForPlacement({ type: 'player', player });
                                }
                              }}
                              className={cn(
                                  "flex aspect-square items-center justify-center p-1 rounded-lg",
                                  isPlayerOnBoard
                                      ? 'opacity-40 cursor-not-allowed bg-muted'
                                      : 'bg-card hover:bg-accent/50 border cursor-pointer md:cursor-grab'
                              )}
                              title={`Jugador Visitante #${player.number}`}
                          >
                              <Avatar className="w-full h-full">
                                  <AvatarFallback className="text-base font-bold" style={{ backgroundColor: player.color, color: 'white' }}>
                                      {player.number}
                                  </AvatarFallback>
                              </Avatar>
                          </div>
                      );
                  })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
