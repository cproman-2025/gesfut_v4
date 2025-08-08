
'use client';

import React from 'react';
import type { BoardItem } from '@/types';
import { cn } from '@/lib/utils';
import { icons } from 'lucide-react';
import Image from 'next/image';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ZoomIn, ZoomOut, RotateCw, Copy, Palette, Trash2 } from 'lucide-react';
import { DRAWING_COLORS } from '@/lib/tactics-data';

interface ShapeProps {
  item: BoardItem;
  isMoving: boolean;
  isSelected: boolean;
  onMoveStart: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onDelete: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onResize: (id: string, factor: number) => void;
  onRotate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDoubleClick: () => void;
  boardOrientation: 'horizontal' | 'vertical';
}

export const Shape: React.FC<ShapeProps> = React.memo(({ item, isMoving, isSelected, onMoveStart, onDelete, onChangeColor, onResize, onRotate, onDuplicate, onDoubleClick, boardOrientation }) => {
    
    if (item.type !== 'shape' || !item.data || typeof item.data !== 'object') {
        return null;
    }
    
    const shape = item.data;
    const { icon, imageUrl, color, baseSize } = shape as { icon?: keyof typeof icons, imageUrl?: string, color?: string, baseSize?: number };
    const LucideIcon = icon ? icons[icon] : null;

    const sizeMultiplier = boardOrientation === 'vertical' ? 0.75 : 1;
    const newSize = (baseSize || 42) * sizeMultiplier;
    const halfSize = newSize / 2;

    const content = imageUrl ? (
        <Image src={imageUrl} alt={item.elementId} width={newSize} height={newSize} className="object-contain" style={{ width: `${newSize}px`, height: `${newSize}px` }} />
    ) : LucideIcon ? (
        <LucideIcon style={{ width: `${newSize}px`, height: `${newSize}px` }}/>
    ) : null;

    if (!content) return null;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    data-item-id={item.id}
                    data-item-type="shape"
                    className={cn(
                        "absolute flex items-center justify-center cursor-grab text-white transition-all transform-gpu",
                        isMoving && "scale-110 shadow-2xl z-30",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg",
                    )}
                    style={{
                        width: `${newSize}px`,
                        height: `${newSize}px`,
                        left: `calc(${item.position.x * 100}% - ${halfSize}px)`,
                        top: `calc(${item.position.y * 100}% - ${halfSize}px)`,
                        color: imageUrl ? undefined : color,
                        zIndex: isMoving ? 31 : 20,
                        transform: `scale(${item.scale || 1}) rotate(${item.rotation || 0}deg)`,
                    }}
                    onPointerDown={(e) => {
                        if (e.button === 0) {
                            onMoveStart(e, item.id);
                        }
                    }}
                    onDoubleClick={onDoubleClick}
                >
                    {content}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <ContextMenuItem onSelect={() => onResize(item.id, 1.25)}>
                    <ZoomIn className="mr-2 h-4 w-4" /> Aumentar
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onResize(item.id, 0.8)}>
                    <ZoomOut className="mr-2 h-4 w-4" /> Disminuir
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onRotate(item.id)}>
                    <RotateCw className="mr-2 h-4 w-4" /> Girar 90°
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onDuplicate(item.id)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                </ContextMenuItem>
                <ContextMenuSeparator />
                {!imageUrl && (
                    <>
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
                    </>
                )}
                <ContextMenuItem className="text-destructive" onSelect={() => onDelete(item.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
});
Shape.displayName = 'Shape';
