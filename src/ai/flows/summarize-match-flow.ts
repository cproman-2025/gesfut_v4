
'use server';
/**
 * @fileOverview Flujo de Genkit para generar resúmenes de partidos de fútbol.
 *
 * - summarizeMatch - Función que genera un resumen de un partido.
 * - SummarizeMatchInput - El tipo de entrada para la función summarizeMatch.
 * - SummarizeMatchOutput - El tipo de retorno para la función summarizeMatch.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { MatchCallSheetItem as GenkitMatchCallSheetItem } from '@/types'; // Asegúrate que este tipo esté correctamente definido

// Definición del esquema para MatchCallSheetItem si no está ya globalmente accesible y detallado.
// Si MatchCallSheetItem ya es un z.object en tus tipos, puedes importarlo directamente.
// Por ahora, asumiré una estructura básica.
const CallSheetItemSchema = z.object({
  playerId: z.string(),
  status: z.string(), // 'Convocado', 'No Convocado', 'Banquillo'
  goals: z.number().optional().describe('Número de goles marcados por el jugador en este partido.'),
  // Podrías añadir más campos como playerName si los necesitas directamente en el prompt
});

const SummarizeMatchInputSchema = z.object({
  homeTeamName: z.string().describe('Nombre del equipo local.'),
  awayTeamName: z.string().describe('Nombre del equipo visitante.'),
  homeScore: z.number().describe('Goles marcados por el equipo local.'),
  awayScore: z.number().describe('Goles marcados por el equipo visitante.'),
  competition: z.string().optional().describe('Nombre de la competición (ej. Liga, Copa).'),
  notes: z.string().optional().describe('Notas adicionales o comentarios sobre el partido.'),
  callSheet: z.array(CallSheetItemSchema).optional().describe('Lista de jugadores convocados y sus estadísticas, útil para identificar goleadores.'),
  playersData: z.array(z.object({ id: z.string(), name: z.string() })).optional().describe('Datos de los jugadores para buscar nombres por ID.'),
});
export type SummarizeMatchInput = z.infer<typeof SummarizeMatchInputSchema>;

const SummarizeMatchOutputSchema = z.object({
  summary: z.string().describe('Un resumen conciso y atractivo del partido.'),
});
export type SummarizeMatchOutput = z.infer<typeof SummarizeMatchOutputSchema>;

export async function summarizeMatch(input: SummarizeMatchInput): Promise<SummarizeMatchOutput> {
  // Pre-procesar callSheet para obtener nombres de goleadores si es posible
  let processedInput = {...input};
  if (input.callSheet && input.playersData) {
    const enrichedCallSheet = input.callSheet.map(item => {
      const playerInfo = input.playersData?.find(p => p.id === item.playerId);
      return {
        ...item,
        playerName: playerInfo?.name || 'Jugador Desconocido'
      };
    });
    // Filtrar solo los goleadores para el prompt
    const goalScorers = enrichedCallSheet.filter(item => item.goals && item.goals > 0);
    if (goalScorers.length > 0) {
        processedInput.notes = (processedInput.notes || '') +
        `\nGoleadores destacados: ${goalScorers.map(gs => `${gs.playerName} (${gs.goals} gol/es)`).join(', ')}.`;
    }
  }

  // Asegurar que 'notes' no sea null para el flujo. Si es null, convertir a undefined.
  // Zod .optional() espera string | undefined, no string | null | undefined.
  if (processedInput.notes === null) {
    processedInput.notes = undefined;
  }

  // Eliminar playersData del input final al prompt ya que ya se usó
  const { playersData, ...inputForPrompt } = processedInput;


  return summarizeMatchFlow(inputForPrompt);
}

const prompt = ai.definePrompt({
  name: 'summarizeMatchPrompt',
  input: {schema: SummarizeMatchInputSchema.omit({playersData: true})}, // Omitimos playersData del esquema del prompt
  output: {schema: SummarizeMatchOutputSchema},
  prompt: `Eres un entusiasta comentarista deportivo. Tu tarea es generar un resumen breve, atractivo y profesional del siguiente partido de fútbol.

Información del Partido:
- Equipo Local: {{{homeTeamName}}}
- Equipo Visitante: {{{awayTeamName}}}
- Marcador: {{{homeTeamName}}} {{{homeScore}}} - {{{awayScore}}} {{{awayTeamName}}}
{{#if competition}}
- Competición: {{{competition}}}
{{/if}}
{{#if notes}}
- Notas Adicionales/Goleadores: {{{notes}}}
{{/if}}

Instrucciones para el Resumen:
1. Comienza con una frase que capte la atención.
2. Describe el resultado del partido, indicando claramente quién ganó o si fue un empate.
3. Menciona el marcador final.
4. Si se proporciona información sobre la competición, inclúyela.
5. Si hay notas adicionales o información sobre goleadores, incorpórala de forma natural en el resumen.
6. El resumen debe ser conciso, informativo y con un tono profesional pero emocionante, como si fuera para un noticiero deportivo.
7. No inventes información que no se proporciona.
8. El resumen debe estar en español.

Genera el resumen del partido:
`,
});

const summarizeMatchFlow = ai.defineFlow(
  {
    name: 'summarizeMatchFlow',
    inputSchema: SummarizeMatchInputSchema.omit({playersData: true}),
    outputSchema: SummarizeMatchOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("No se pudo generar el resumen del partido.");
    }
    return output;
  }
);

