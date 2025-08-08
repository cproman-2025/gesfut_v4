
"use client";

import { Player, InjuryRecord, Match, Team } from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Calendar, Stethoscope, Printer, PieChart as PieChartIcon, FileText, Camera, X } from 'lucide-react';
import { format, parseISO, differenceInYears, isValid, getYear, getMonth, isSameMonth, isSameYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModernDialog } from '../ui/modern-dialog';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';


interface PlayerReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  teamMatches: Match[];
  matchStats: {
    totalMatchesPlayed: number;
    totalMinutesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalYellowCards: number;
    totalRedCards: number;
  } | null;
  attendanceStats: {
    presente: number;
    ausente: number;
    justificado: number;
    tarde: number;
    total: number;
    percentage: number;
  } | null;
}

const getAge = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  try {
    const birthDate = parseISO(dateString);
    if (!isValid(birthDate)) return 'N/A';
    return differenceInYears(new Date(), birthDate);
  } catch (e) {
    return 'N/A';
  }
};

const CHART_COLORS = {
  presente: 'hsl(var(--chart-3))', // green
  tarde: 'hsl(var(--chart-4))', // yellow/orange
  justificado: 'hsl(var(--chart-1))', // blue/primary
  ausente: 'hsl(var(--destructive))', // red
};

export function PlayerReportDialog({
  open,
  onOpenChange,
  player,
  teamMatches,
  matchStats,
  attendanceStats,
}: PlayerReportDialogProps) {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [minutesFilterType, setMinutesFilterType] = useState<'season' | 'month'>('season');
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const { theme: activeTheme } = useTheme();


  const seasons = useMemo(() => {
    if (!teamMatches) return [];
    const seasonSet = new Set<string>();
    teamMatches.forEach(match => {
        const date = match.date instanceof Date ? match.date : parseISO(String(match.date));
        const year = getYear(date);
        const month = getMonth(date);
        const season = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
        seasonSet.add(season);
    });
    return Array.from(seasonSet).sort().reverse();
  }, [teamMatches]);

  const months = useMemo(() => {
    if (!teamMatches) return [];
    const monthSet = new Set<string>();
    teamMatches.forEach(match => {
        const date = match.date instanceof Date ? match.date : parseISO(String(match.date));
        monthSet.add(format(date, 'yyyy-MM', { locale: es }));
    });
    return Array.from(monthSet).sort().reverse().map(m => ({
        value: m,
        label: format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())
    }));
  }, [teamMatches]);

  useEffect(() => {
    if (seasons.length > 0 && selectedSeason === 'all') {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);


  const minutesPerMatchData = useMemo(() => {
    if (!player || !teamMatches) return [];

    let filteredMatches = teamMatches;

    if (minutesFilterType === 'season' && selectedSeason !== 'all') {
        const [startYearStr, endYearStr] = selectedSeason.split('/');
        const startYear = parseInt(startYearStr, 10);
        const endYear = parseInt(endYearStr, 10);
        const seasonStartDate = new Date(startYear, 7, 1); // August 1st
        const seasonEndDate = new Date(endYear, 6, 31); // July 31st

        filteredMatches = teamMatches.filter(match => {
            const matchDate = match.date instanceof Date ? match.date : parseISO(String(match.date));
            return matchDate >= seasonStartDate && matchDate <= seasonEndDate;
        });
    } else if (minutesFilterType === 'month' && selectedMonth !== 'all') {
        const [year, month] = selectedMonth.split('-').map(Number);
        filteredMatches = teamMatches.filter(match => {
            const matchDate = match.date instanceof Date ? match.date : parseISO(String(match.date));
            return isSameYear(matchDate, new Date(year,0)) && isSameMonth(matchDate, new Date(year, month -1));
        });
    }

    return filteredMatches
        .sort((a,b) => (a.date instanceof Date ? a.date : new Date(a.date)).getTime() - (b.date instanceof Date ? b.date : new Date(b.date)).getTime())
        .map((match, index) => {
            const callUp = player.callUpHistory?.find(c => c.matchId === match.id);
            const opponentName = (match.homeTeamId === player.teamId ? match.awayTeamName : match.homeTeamName) || 'Rival desc.';
            return {
                name: `${format(match.date instanceof Date ? match.date : new Date(match.date), 'dd/MM')} vs ${opponentName.substring(0,8)}...`,
                minutos: callUp?.minutesPlayed || 0,
            };
        });
  }, [player, teamMatches, minutesFilterType, selectedSeason, selectedMonth]);


 const handleExport = useCallback(async (action: 'print' | 'snapshot') => {
    if (!reportRef.current) {
        toast({ title: "Error", description: "No se puede encontrar el contenido del informe.", variant: "destructive" });
        return;
    }
    toast({ title: "Generando...", description: "Preparando el informe, por favor espera.", variant: "default" });

    const reportElement = reportRef.current;
    
    // Create a temporary container with explicit background for export
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'absolute';
    exportContainer.style.left = '-9999px'; // Move it off-screen
    exportContainer.style.width = `${reportElement.offsetWidth}px`;
    exportContainer.style.backgroundColor = 'white'; // Force white background
    
    const clonedReport = reportElement.cloneNode(true) as HTMLElement;
    exportContainer.appendChild(clonedReport);
    document.body.appendChild(exportContainer);

    try {
        // Find charts in the original and cloned elements
        const originalCharts = reportElement.querySelectorAll('[data-chart]');
        const clonedCharts = clonedReport.querySelectorAll('[data-chart]');

        originalCharts.forEach((originalChart, index) => {
            if (clonedCharts[index]) {
                const originalSvgs = originalChart.querySelectorAll('svg .recharts-bar-rectangle path, svg .recharts-pie-sector path');
                const clonedSvgs = clonedCharts[index].querySelectorAll('svg .recharts-bar-rectangle path, svg .recharts-pie-sector path');
                
                originalSvgs.forEach((originalSvg, svgIndex) => {
                    if (clonedSvgs[svgIndex]) {
                        const computedFill = window.getComputedStyle(originalSvg).getPropertyValue('fill');
                        (clonedSvgs[svgIndex] as HTMLElement).style.fill = computedFill;
                    }
                });
            }
        });

        const dataUrl = await toPng(clonedReport, {
            quality: 0.98,
            pixelRatio: 2.5,
            backgroundColor: 'white',
        });

        if (action === 'snapshot') {
            const link = document.createElement('a');
            link.download = `informe-${player?.name.replace(/ /g, '_') || 'jugador'}.png`;
            link.href = dataUrl;
            link.click();
        } else { // print
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error("No se pudo acceder al documento del iframe.");
            iframeDoc.open();
            iframeDoc.write(`
                <html><head><title>Informe de Jugador</title>
                <style>@media print { @page { size: A4 portrait; margin: 1cm; } body { margin: 0; } img { width: 100%; height: auto; } }</style>
                </head><body><img src="${dataUrl}" /></body></html>
            `);
            iframeDoc.close();
            iframe.contentWindow?.focus();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        }
    } catch (error) {
        console.error('Error al generar imagen:', error);
        toast({ title: "Error al generar imagen", variant: "destructive" });
    } finally {
        document.body.removeChild(exportContainer);
    }
}, [player, toast, activeTheme]);
  

  if (!player) return null;
  const age = getAge(player.dateOfBirth);

  const attendanceChartData = [
    { name: 'Presente', value: attendanceStats?.presente || 0, fill: CHART_COLORS.presente },
    { name: 'Tarde', value: attendanceStats?.tarde || 0, fill: CHART_COLORS.tarde },
    { name: 'Justificado', value: attendanceStats?.justificado || 0, fill: CHART_COLORS.justificado },
    { name: 'Ausente', value: attendanceStats?.ausente || 0, fill: CHART_COLORS.ausente },
  ].filter(item => item.value > 0);

  const attendanceChartConfig = {
    value: { label: 'Asistencias' },
    ...attendanceChartData.reduce((acc, cur) => {
      acc[cur.name] = { label: cur.name, color: cur.fill };
      return acc;
    }, {} as ChartConfig),
  } satisfies ChartConfig;

  const headerActions = (
    <div className="flex items-center gap-1">
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => handleExport('snapshot')} className="h-8 w-8 text-white hover:bg-white/20">
            <Camera className="h-4 w-4" />
          </Button>
      </TooltipTrigger><TooltipContent><p>Tomar Snapshot (PNG)</p></TooltipContent></Tooltip></TooltipProvider>
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => handleExport('print')} className="h-8 w-8 text-white hover:bg-white/20">
          <Printer className="h-4 w-4" />
        </Button>
      </TooltipTrigger><TooltipContent><p>Imprimir Informe</p></TooltipContent></Tooltip></TooltipProvider>
    </div>
  );

  return (
    <ModernDialog
        isOpen={open}
        onClose={() => onOpenChange(false)}
        title="Informe de Jugador"
        type="info"
        size="2xl"
        headerActions={headerActions}
    >
       <ScrollArea className="flex-1 max-h-[80vh]">
          <div ref={reportRef} id="player-report-printable" className="bg-card text-card-foreground">
            <div className="p-4 md:p-6 space-y-4 printable-content">
              <header className="flex flex-col sm:flex-row items-center gap-4 pb-4 border-b printable-header">
                <Avatar className="h-24 w-24 border-4 border-border shrink-0">
                  <AvatarImage src={player.avatarUrl} alt={player.name} data-ai-hint="player avatar"/>
                  <AvatarFallback className="text-4xl bg-muted text-muted-foreground">
                    {player.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <h2 className="text-3xl font-bold font-headline">{player.name}</h2>
                  <p className="text-muted-foreground text-base">
                    {player.jerseyNumber && `Dorsal: #${player.jerseyNumber} | `}
                    Edad: {age}
                  </p>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                  <Card className="bg-muted/30 border-0 printable-card">
                      <CardHeader className="p-4"><CardTitle className="text-base text-muted-foreground">Partidos Jugados</CardTitle></CardHeader>
                      <CardContent className="p-4 pt-0"><p className="text-4xl font-bold font-headline">{matchStats?.totalMatchesPlayed || 0}</p></CardContent>
                  </Card>
                   <Card className="bg-muted/30 border-0 printable-card">
                      <CardHeader className="p-4"><CardTitle className="text-base text-muted-foreground">Minutos Totales</CardTitle></CardHeader>
                      <CardContent className="p-4 pt-0"><p className="text-4xl font-bold font-headline">{matchStats?.totalMinutesPlayed || 0}</p></CardContent>
                  </Card>
                   <Card className="bg-muted/30 border-0 printable-card">
                      <CardHeader className="p-4"><CardTitle className="text-base text-muted-foreground">Goles</CardTitle></CardHeader>
                      <CardContent className="p-4 pt-0"><p className="text-4xl font-bold font-headline text-green-600">{matchStats?.totalGoals || 0}</p></CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-0 printable-card">
                      <CardHeader className="p-4"><CardTitle className="text-base text-muted-foreground">Asistencias</CardTitle></CardHeader>
                      <CardContent className="p-4 pt-0"><p className="text-4xl font-bold font-headline text-blue-600">{matchStats?.totalAssists || 0}</p></CardContent>
                  </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 page-break-before">
                <Card className="bg-background border printable-card">
                    <CardHeader className="p-4"><CardTitle className="flex items-center gap-2 text-base"><Calendar /> Rendimiento en Entrenamientos</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        {attendanceStats && attendanceStats.total > 0 ? (
                            <div className="space-y-3">
                                <ChartContainer config={attendanceChartConfig} className="mx-auto aspect-square h-[150px]" data-chart>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                            <Pie data={attendanceChartData} dataKey="value" nameKey="name" innerRadius={40} strokeWidth={3}>
                                            {attendanceChartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} />))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between"><span>Asistencia Total:</span> <span className="font-semibold">{attendanceStats.percentage}%</span></div>
                                    <Progress value={attendanceStats.percentage} className="h-2"/>
                                    <span className="text-xs text-muted-foreground">Sesiones asistidas: {attendanceStats.presente + attendanceStats.tarde} de {attendanceStats.total}</span>
                                </div>
                            </div>
                        ) : (<p className="text-sm text-muted-foreground text-center py-10">No hay datos de asistencia.</p>)}
                    </CardContent>
                </Card>

                  <Card className="bg-background border printable-card">
                      <CardHeader className="p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 no-print">
                              <CardTitle className="flex items-center gap-2 text-base"><BarChart3 /> Minutos Jugados por Partido</CardTitle>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Select value={minutesFilterType} onValueChange={(v) => setMinutesFilterType(v as 'season' | 'month')}><SelectTrigger className="w-full sm:w-auto h-8 text-xs bg-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="season">Por Temporada</SelectItem><SelectItem value="month">Por Mes</SelectItem></SelectContent></Select>
                                  {minutesFilterType === 'season' ? (<Select value={selectedSeason} onValueChange={setSelectedSeason}><SelectTrigger className="w-full sm:w-auto h-8 text-xs bg-white"><SelectValue/></SelectTrigger><SelectContent>{seasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>) : (<Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-full sm:w-auto h-8 text-xs bg-white"><SelectValue placeholder="Selecciona mes"/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Meses</SelectItem>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>)}
                              </div>
                          </div>
                          <h3 className="text-base font-semibold items-center gap-2 hidden print:flex"><Calendar /> Minutos Jugados por Partido ({minutesFilterType === 'season' ? selectedSeason : selectedMonth !== 'all' ? (months.find(m => m.value === selectedMonth)?.label) : 'Todos'})</h3>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                          {minutesPerMatchData.length > 0 ? (
                              <ChartContainer config={{minutos: {label: "Minutos", color: "hsl(var(--chart-1))"}}} className="h-[200px] w-full" data-chart>
                                  <BarChart data={minutesPerMatchData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                      <CartesianGrid vertical={false} />
                                      <XAxis dataKey="name" tickLine={false} tickMargin={5} axisLine={false} tickFormatter={(value) => value.slice(0, 10)} angle={-45} textAnchor="end" height={50} interval={0} className="text-xs" />
                                      <YAxis dataKey="minutos" className="text-xs"/>
                                      <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                      <Bar dataKey="minutos" fill="var(--color-minutos)" radius={4} />
                                  </BarChart>
                              </ChartContainer>
                          ) : (<p className="text-sm text-muted-foreground text-center py-10">No hay minutos de juego registrados para el periodo seleccionado.</p>)}
                      </CardContent>
                  </Card>

                <Card className="lg:col-span-2 bg-background border printable-card">
                  <CardHeader className="p-4"><CardTitle className="flex items-center gap-2 text-base"><Stethoscope /> Historial de Lesiones</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0">
                    {player.injuryHistory && player.injuryHistory.length > 0 ? (
                      <ul className="space-y-2">
                        {player.injuryHistory.map((injury: InjuryRecord) => (<li key={injury.id} className="text-sm p-2 bg-muted/50 rounded-md"><p className="font-semibold">{injury.injuryType} <span className="text-xs font-normal text-gray-500">({injury.status})</span></p><p className="text-xs text-muted-foreground">Desde: {format(parseISO(injury.startDate), 'dd/MM/yyyy', {locale: es})}</p>{injury.description && <p className="text-xs text-muted-foreground mt-1">{injury.description}</p>}</li>))}
                      </ul>
                    ) : (<p className="text-sm text-muted-foreground text-center py-4">No hay lesiones registradas.</p>)}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>
    </ModernDialog>
  );
}
