
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Team } from '@/types';
import {
  FolderOpen, ArrowLeft, Save, Download, Upload, Undo, Redo, Share2, Printer, SwitchCamera, Camera, Eraser
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface TopToolbarProps {
  activeTacticName?: string | null;
  onLoadClick: () => void;
  onSaveClick: () => void;
  userTeams: Team[];
  selectedTeamId: string | null;
  onTeamSelect: (teamId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onImport: () => void;
  onPrint: () => void;
  onShare: () => void;
  onToggleOrientation: () => void;
  onSnapshot: () => void;
  onClearClick: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeTacticName,
  onLoadClick,
  onSaveClick,
  userTeams,
  selectedTeamId,
  onTeamSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onImport,
  onPrint,
  onShare,
  onToggleOrientation,
  onSnapshot,
  onClearClick,
}) => {
  return (
    <TooltipProvider>
      <div className="bg-card text-card-foreground p-2 flex items-center justify-between border-b border-border shadow-sm shrink-0 rounded-lg no-print">
        {/* Left Section */}
        <div className="flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild><Link href="/"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="w-5 h-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Volver al Dashboard</p></TooltipContent></Tooltip>
          
          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

          <div className="hidden sm:block">
              <h2 className="text-sm font-semibold px-2">
                  {activeTacticName ? (
                      <>Táctica: <span className="text-primary">{activeTacticName}</span></>
                  ) : (
                      "Nueva Táctica (Sin Guardar)"
                  )}
              </h2>
          </div>
        </div>
        
        {/* Center Section - Main Tools */}
        <div className="hidden md:flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onSaveClick}><Save className="w-5 h-5 text-green-600" /></Button></TooltipTrigger><TooltipContent><p>Guardar Táctica (Ctrl+S)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLoadClick}><FolderOpen className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Abrir Táctica (Ctrl+O)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExport}><Download className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Exportar (Ctrl+E)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onImport}><Upload className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Importar</p></TooltipContent></Tooltip>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onUndo} disabled={!canUndo}><Undo className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Deshacer (Ctrl+Z)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRedo} disabled={!canRedo}><Redo className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Rehacer (Ctrl+Y)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={onClearClick}><Eraser className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Limpiar Pizarra</p></TooltipContent></Tooltip>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary" onClick={onToggleOrientation}><SwitchCamera className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Voltear Pizarra</p></TooltipContent></Tooltip>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onShare}><Share2 className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Compartir</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onPrint}><Printer className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Imprimir (Ctrl+P)</p></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" onClick={onSnapshot}><Camera className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent><p>Tomar Snapshot (PNG)</p></TooltipContent></Tooltip>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2">
              <Select value={selectedTeamId || ''} onValueChange={(teamId) => { if(teamId) onTeamSelect(teamId); }}>
                <SelectTrigger id="team-select-toolbar" className="h-9 w-[150px] md:w-[200px] bg-background"><SelectValue placeholder="Selecciona un equipo" /></SelectTrigger>
                <SelectContent>
                  {userTeams.length > 0 ? ( userTeams.map(team => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)) ) : (<SelectItem value="no-teams" disabled>No tienes equipos</SelectItem>)}
                </SelectContent>
              </Select>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
