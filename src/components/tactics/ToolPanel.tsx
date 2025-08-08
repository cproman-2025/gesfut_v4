
'use client';

import React from 'react';
import type { BoardTool } from '@/types';
import { cn } from '@/lib/utils';
import { TRAINING_OBJECTS } from '@/lib/tactics-data';
import {
  Pencil, Minus, ArrowRight, Circle, Square, Type, icons, Target, Move,
  Waypoints, Spline, Layers, MousePointer
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const drawingTools: { id: BoardTool; icon: React.ElementType, label: string }[] = [
    { id: 'selection', icon: MousePointer, label: 'Seleccionar' },
    { id: 'move', icon: Move, label: 'Mover' },
    { id: 'pencil', icon: Pencil, label: 'Lápiz' },
    { id: 'line', icon: Minus, label: 'Línea' },
    { id: 'dashed-line', icon: Waypoints, label: 'L. Disc.' },
    { id: 'arrow', icon: ArrowRight, label: 'Flecha' },
    { id: 'curved-arrow', icon: Spline, label: 'F. Curva' },
    { id: 'circle', icon: Circle, label: 'Círculo' },
    { id: 'rectangle', icon: Square, label: 'Rect.' },
    { id: 'shaded-area', icon: Layers, label: 'Zona' },
    { id: 'text', icon: Type, label: 'Texto' },
];

interface ToolPanelProps {
  activeTool: BoardTool;
  setActiveTool: (tool: BoardTool) => void;
  onItemSelectForPlacement: (itemData: any) => void;
}

export const ToolPanel: React.FC<ToolPanelProps> = ({
  activeTool,
  setActiveTool,
  onItemSelectForPlacement,
}) => {

  return (
    <div className="bg-card text-card-foreground h-full flex flex-col rounded-lg">
        <div className="p-3 border-b shrink-0">
            <h3 className="font-semibold text-base text-center">Herramientas</h3>
        </div>
        <ScrollArea className="flex-1">
            <Accordion type="multiple" defaultValue={['drawing-tools', 'objects']} className="w-full px-3">
                <AccordionItem value="drawing-tools">
                    <AccordionTrigger className="hover:no-underline">Dibujo</AccordionTrigger>
                    <AccordionContent>
                        <div className="grid grid-cols-3 gap-1">
                        {drawingTools.map(tool => (
                            <Button
                            key={tool.id}
                            variant={activeTool === tool.id ? 'default' : 'ghost'}
                            size="icon"
                            className={cn(
                                "h-14 w-full flex-col gap-1 text-xs",
                                activeTool === tool.id && "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                            onClick={() => setActiveTool(tool.id)}
                            >
                            <tool.icon className="w-5 h-5" />
                            <span>{tool.label}</span>
                            </Button>
                        ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="objects" className="border-b-0">
                    <AccordionTrigger className="hover:no-underline">Objetos</AccordionTrigger>
                    <AccordionContent>
                        <p className="text-xs text-muted-foreground mb-2">Arrastra o toca para colocar</p>
                        <div className="grid grid-cols-3 gap-2">
                            {TRAINING_OBJECTS.map(obj => {
                                // @ts-ignore
                                const { icon, imageUrl } = obj;
                                const LucideIcon = icon ? icons[icon as keyof typeof icons] : null;
                                
                                return (
                                    <div
                                    key={obj.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'shape', shape: obj }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={() => onItemSelectForPlacement({ type: 'shape', shape: obj })}
                                    className="flex flex-col items-center justify-center p-2 rounded-lg border-2 border-transparent bg-muted/50 text-card-foreground hover:border-primary hover:bg-accent/50 cursor-pointer md:cursor-grab transition-colors aspect-square"
                                    >
                                    {imageUrl ? (
                                        <Image src={imageUrl} alt={obj.id} width={40} height={40} className="object-contain w-10 h-10" />
                                    ) : LucideIcon ? (
                                        <LucideIcon className="w-10 h-10" />
                                    ) : null}
                                    </div>
                                )
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </ScrollArea>
    </div>
  );
};
