
"use client";

import { Player, Team, PlayerProfileField } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Printer, ShieldCheck } from 'lucide-react';
import { defaultPlayerProfileFields } from '@/lib/placeholder-data';
import React, { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModernDialog } from '../ui/modern-dialog';

const groupFieldsBySection = (fields: PlayerProfileField[]) => {
  return fields.reduce((acc, field) => {
    (acc[field.section] = acc[field.section] || []).push(field);
    return acc;
  }, {} as Record<string, PlayerProfileField[]>);
};

const statsFields: { key: string; label: string }[] = [
  { key: 'stat_callups', label: 'Convocatorias Totales' },
  { key: 'stat_minutes', label: 'Minutos Totales' },
  { key: 'stat_assists', label: 'Asistencias Totales' },
];

const ReportPreview = ({ players, team, selectedFields }: { players: Player[]; team: Team | null; selectedFields: string[] }) => {
    if (players.length === 0) {
        return <div className="text-center text-muted-foreground py-10">No hay jugadores en este equipo para mostrar en el informe.</div>;
    }

    return (
        <div id="team-report-printable" className="space-y-8 p-1">
            <header className="text-center pb-4 border-b">
                <h1 className="text-2xl font-bold font-headline">{`Informe del Equipo: ${team?.name || 'Equipo'}`}</h1>
                <p className="text-sm text-muted-foreground">Generado el {format(new Date(), 'dd MMMM yyyy', { locale: es })}</p>
            </header>

            <div className="space-y-6">
                {players.map((player) => {
                    const playerStats = useMemo(() => {
                        const callUps = player.callUpHistory?.filter(c => c.status === 'Convocado' || c.status === 'Banquillo').length || 0;
                        const minutes = player.callUpHistory?.reduce((acc, c) => acc + (c.minutesPlayed || 0), 0) || 0;
                        const assists = player.callUpHistory?.reduce((acc, c) => acc + (c.assists || 0), 0) || 0;
                        return { callUps, minutes, assists };
                    }, [player.callUpHistory]);

                    return (
                        <div key={player.id} className="printable-player-card p-4 border rounded-lg shadow-sm break-inside-avoid">
                            <div className="flex items-center gap-4 mb-3">
                                <Avatar className="h-16 w-16 border-2">
                                    <AvatarImage src={player.avatarUrl} alt={player.name} data-ai-hint="player avatar"/>
                                    <AvatarFallback>{player.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-xl font-semibold">{player.name}</h3>
                                    <p className="text-muted-foreground">
                                        {player.position} {player.jerseyNumber ? `(#${player.jerseyNumber})` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                {selectedFields.filter(key => !key.startsWith('stat_')).map(fieldKey => {
                                    const fieldConfig = defaultPlayerProfileFields.find(f => f.key === fieldKey);
                                    let value = player[fieldKey];

                                    if (!fieldConfig || value === undefined || value === null || value === '') {
                                        return null;
                                    }

                                    if (fieldConfig.type === 'date' && typeof value === 'string' && isValid(parseISO(value))) {
                                        value = format(parseISO(value), 'dd/MM/yyyy');
                                    }
                                    
                                    return (
                                        <div key={fieldKey} className="flex flex-col">
                                            <span className="text-xs font-medium text-muted-foreground">{fieldConfig.label}</span>
                                            <span className="font-medium">{String(value)}</span>
                                        </div>
                                    );
                                })}
                                {selectedFields.includes('stat_callups') && (
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-muted-foreground">Convocatorias</span>
                                        <span className="font-medium">{playerStats.callUps}</span>
                                    </div>
                                )}
                                {selectedFields.includes('stat_minutes') && (
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-muted-foreground">Minutos Jugados</span>
                                        <span className="font-medium">{playerStats.minutes}'</span>
                                    </div>
                                )}
                                {selectedFields.includes('stat_assists') && (
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-muted-foreground">Asistencias</span>
                                        <span className="font-medium">{playerStats.assists}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


export function TeamReportDialog({
  open,
  onOpenChange,
  team,
  players,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  players: Player[];
}) {
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'position', 'jerseyNumber', 'stat_minutes']);

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    setSelectedFields(prev =>
      checked ? [...prev, fieldKey] : prev.filter(key => key !== fieldKey)
    );
  };

  const handlePrint = () => {
    window.print();
  };
  
  const groupedFields = useMemo(() => groupFieldsBySection(defaultPlayerProfileFields), []);

  return (
    <ModernDialog
        isOpen={open}
        onClose={() => onOpenChange(false)}
        title={`Generar Informe de Equipo: ${team?.name}`}
        size="xl"
        type="info"
        showCloseButton={true}
    >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0 p-4">
          <div className="col-span-1 border-r pr-4 no-print">
            <h3 className="font-semibold mb-3">Campos a Incluir</h3>
            <ScrollArea className="h-[calc(80vh-200px)]">
              <div className="space-y-4">
                {Object.entries(groupedFields).map(([section, fields]) => (
                  <div key={section}>
                    <h4 className="font-medium text-primary text-sm mb-2">{section}</h4>
                    <div className="space-y-2 pl-2">
                       {fields.filter(f => f.isActive).map(field => (
                          <div key={field.key} className="flex items-center space-x-2">
                              <Checkbox
                                  id={`field-${field.key}`}
                                  checked={selectedFields.includes(field.key)}
                                  onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
                              />
                              <Label htmlFor={`field-${field.key}`} className="text-sm font-normal cursor-pointer">
                                  {field.label}
                              </Label>
                          </div>
                       ))}
                    </div>
                  </div>
                ))}
                 <div>
                    <h4 className="font-medium text-primary text-sm mb-2">Estadísticas</h4>
                    <div className="space-y-2 pl-2">
                        {statsFields.map(field => (
                            <div key={field.key} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`field-${field.key}`}
                                    checked={selectedFields.includes(field.key)}
                                    onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
                                />
                                <Label htmlFor={`field-${field.key}`} className="text-sm font-normal cursor-pointer">
                                    {field.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="col-span-3 flex flex-col">
            <ScrollArea className="h-[calc(80vh-150px)] border rounded-lg bg-muted/20">
                <ReportPreview players={players} team={team} selectedFields={selectedFields} />
            </ScrollArea>
          </div>
        </div>
         <div className="flex justify-end gap-2 p-4 border-t no-print">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button onClick={handlePrint} className="btn-primary"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
    </ModernDialog>
  );
}
