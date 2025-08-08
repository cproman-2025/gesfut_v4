
'use server';
/**
 * @fileOverview Flujo de Genkit para generar contenido para publicaciones en el muro del equipo.
 *
 * - generatePostContent - Función que genera un borrador de contenido para una publicación.
 * - GeneratePostContentInput - El tipo de entrada para la función generatePostContent.
 * - GeneratePostContentOutput - El tipo de retorno para la función generatePostContent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePostContentInputSchema = z.object({
  topic: z.string().describe('El tema o idea principal para la publicación. Por ejemplo: "Victoria importante del equipo Senior" o "Recordatorio próximo entrenamiento Sub-18".'),
});
export type GeneratePostContentInput = z.infer<typeof GeneratePostContentInputSchema>;

const GeneratePostContentOutputSchema = z.object({
  generatedContent: z.string().describe('El borrador de contenido generado para la publicación.'),
});
export type GeneratePostContentOutput = z.infer<typeof GeneratePostContentOutputSchema>;

export async function generatePostContent(input: GeneratePostContentInput): Promise<GeneratePostContentOutput> {
  return generatePostContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePostContentPrompt',
  input: {schema: GeneratePostContentInputSchema},
  output: {schema: GeneratePostContentOutputSchema},
  prompt: `Eres un asistente de IA encargado de ayudar a redactar publicaciones para el muro de un club de fútbol llamado "A.D. Alhóndiga".
El tono debe ser positivo, informativo y/o motivador, adecuado para una comunidad de equipo (jugadores, entrenadores, padres, aficionados).

Considera los siguientes tipos de publicaciones comunes y adapta el estilo:
- Anuncios de partidos (próximos, resultados).
- Resúmenes de partidos (destacando esfuerzos, momentos clave).
- Anuncios de entrenamientos.
- Felicitaciones por logros.
- Recordatorios importantes.
- Mensajes de ánimo.

Basándote en el siguiente tema, genera un borrador de contenido para la publicación. Sé conciso pero atractivo.

Tema proporcionado: {{{topic}}}

Contenido generado:
`,
});

const generatePostContentFlow = ai.defineFlow(
  {
    name: 'generatePostContentFlow',
    inputSchema: GeneratePostContentInputSchema,
    outputSchema: GeneratePostContentOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("No se pudo generar el contenido de la publicación.");
    }
    return output;
  }
);

