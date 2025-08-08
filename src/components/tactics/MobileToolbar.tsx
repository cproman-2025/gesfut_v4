
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Undo, Redo, Save, FolderOpen, Camera, Share2, Printer, Eraser
} from 'lucide-react';

interface MobileToolbarProps {
  children: React.ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  onSnapshot: () => void;
  onPrint: () => void;
  onShare: () => void;
  onClear: () => void;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ 
  children,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onLoad,
  onSnapshot,
  onPrint,
  onShare,
  onClear
}) => {
  return (
    <div className="bg-card text-card-foreground p-1 flex items-center justify-around border-t border-border shadow-t-lg md:hidden">
      <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}><Undo className="w-5 h-5"/></Button>
      <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}><Redo className="w-5 h-5"/></Button>
      
      {children}
      
      <Button variant="ghost" size="icon" onClick={onLoad}><FolderOpen className="w-5 h-5"/></Button>
      <Button variant="ghost" size="icon" onClick={onSave}><Save className="w-5 h-5 text-green-600"/></Button>
      <Button variant="ghost" size="icon" onClick={onSnapshot}><Camera className="w-5 h-5"/></Button>
      <Button variant="ghost" size="icon" onClick={onPrint}><Printer className="w-5 h-5"/></Button>
      <Button variant="ghost" size="icon" onClick={onClear}><Eraser className="w-5 h-5 text-destructive"/></Button>
      <Button variant="ghost" size="icon" onClick={onShare}><Share2 className="w-5 h-5"/></Button>
    </div>
  );
};
