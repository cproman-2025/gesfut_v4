
'use client';

import React from 'react';
import type { BoardItem } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Palette, Trash2 } from 'lucide-react';
import { DRAWING_COLORS } from '@/lib/tactics-data';

interface PlayerTokenProps {
  item: BoardItem;
  isMoving: boolean;
  isSelected: boolean;
  onMoveStart: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onDelete: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDoubleClick: () => void;
  boardOrientation: 'horizontal' | 'vertical';
}

export const PlayerToken: React.FC<PlayerTokenProps> = React.memo(({ item, isMoving, isSelected, onMoveStart, onDelete, onChangeColor, onDoubleClick, boardOrientation }) => {

  if (item.type !== 'player' || !item.data || typeof item.data !== 'object' || !('team' in item.data)) {
    return null;
  }
  
  const isVertical = boardOrientation === 'vertical';

  const player = item.data;
  const isHomeTeam = player.team === 'home';
  
  const tokenWidth = isVertical ? 48 : 64;
  const tokenHeight = isVertical ? 62 : 78;
  const halfWidth = tokenWidth / 2;
  const halfHeight = tokenHeight / 2;


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
            data-item-id={item.id}
            data-item-type="player"
            className={cn(
                'absolute flex flex-col items-center justify-center cursor-grab transition-all transform-gpu',
                isMoving && 'scale-110 shadow-2xl z-50 rounded-lg',
                isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg',
                isVertical ? 'w-12' : 'w-16'
            )}
            style={{
                left: `calc(${item.position.x * 100}% - ${halfWidth}px)`,
                top: `calc(${item.position.y * 100}% - ${halfHeight}px)`,
                zIndex: isMoving ? 51 : 40,
            }}
            onPointerDown={(e) => {
                if (e.button === 0) {
                    onMoveStart(e, item.id);
                }
            }}
            onDoubleClick={onDoubleClick}
        >
            <div className={cn(
                "relative bg-muted rounded-md shadow-lg overflow-hidden border-2",
                isVertical ? 'w-10 h-12' : 'w-14 h-16'
                )} style={{ borderColor: player.color }}>
                {isHomeTeam && player.avatarUrl ? (
                    <Image src={player.avatarUrl} alt={player.nickname || ''} layout="fill" objectFit="cover" data-ai-hint="player avatar" />
                ) : (
                    <div className={cn(
                        "w-full h-full flex items-center justify-center font-bold",
                        isVertical ? 'text-lg' : 'text-xl'
                        )} style={{ backgroundColor: player.color, color: 'white' }}>
                    {isHomeTeam ? (player.nickname ? player.nickname.substring(0, 1) : '?') : player.number}
                    </div>
                )}

                {isHomeTeam && (
                    <div 
                        className={cn(
                            "absolute bottom-0.5 right-0.5 flex items-center justify-center rounded-full font-bold text-white shadow-sm border border-background",
                            isVertical ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]'
                        )}
                        style={{ backgroundColor: player.color }}
                    >
                    {player.number}
                    </div>
                )}
            </div>
             {isHomeTeam && (
                <div className={cn(
                    "mt-1 text-center font-semibold text-white bg-black/60 rounded-md px-1.5 py-0.5 truncate w-full",
                    isVertical ? 'text-[9px] max-w-[48px]' : 'text-[10px] max-w-[56px]'
                    )}>
                    {player.nickname}
                </div>
            )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <ContextMenuSub>
                <ContextMenuSubTrigger><Palette className="mr-2 h-4 w-4" />Color</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                    {DRAWING_COLORS.map(c => (
                    <ContextMenuItem key={c.value} onSelect={() => onChangeColor(item.id, c.value)}>
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: c.value }} />
                        <span>{c.label}</span>
                    </ContextMenuItem>
                    ))}
                </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onSelect={() => onDelete(item.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
PlayerToken.displayName = 'PlayerToken';
