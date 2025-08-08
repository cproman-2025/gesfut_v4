'use server';
/**
 * @fileOverview Flujo de Genkit para generar detalles y un diagrama para una tarea de entrenamiento.
 *
 * - generateTrainingTask - Función que genera nombre, descripción, duración y un diagrama esquemático.
 * - GenerateTrainingTaskInput - El tipo de entrada.
 * - GenerateTrainingTaskOutput - El tipo de retorno.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { TrainingTaskCategory } from '@/types';

const GenerateTrainingTaskInputSchema = z.object({
  taskIdea: z.string().describe('La idea principal o el objetivo del ejercicio de entrenamiento. Ej: "mejorar pases cortos en espacio reducido", "trabajo de finalización 1vs1".'),
  taskCategory: z.custom<TrainingTaskCategory>().optional().describe('Categoría opcional del ejercicio (Calentamiento, Técnica, Táctica, Físico, Partido, Otro) para guiar a la IA.'),
});
export type GenerateTrainingTaskInput = z.infer<typeof GenerateTrainingTaskInputSchema>;

const GenerateTrainingTaskOutputSchema = z.object({
  taskName: z.string().describe('Un nombre claro y conciso para el ejercicio.'),
  taskDescription: z.string().describe('Una descripción detallada de cómo realizar el ejercicio, formateada en Markdown, incluyendo material necesario, organización de jugadores y objetivos principales.'),
  taskDurationMinutes: z.number().optional().describe('Una duración estimada para el ejercicio en minutos.'),
  taskImageDataUri: z.string().optional().describe("Un diagrama esquemático del ejercicio como un Data URI (Base64). Formato: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateTrainingTaskOutput = z.infer<typeof GenerateTrainingTaskOutputSchema>;

export async function generateTrainingTask(input: GenerateTrainingTaskInput): Promise<GenerateTrainingTaskOutput> {
  return generateTrainingTaskFlow(input);
}

const generateTrainingTaskFlow = ai.defineFlow(
  {
    name: 'generateTrainingTaskFlow',
    inputSchema: GenerateTrainingTaskInputSchema,
    outputSchema: GenerateTrainingTaskOutputSchema,
  },
  async (input) => {
    
    let systemPrompt = `Eres un experto entrenador de fútbol y diseñador de ejercicios de entrenamiento.
Basado en la siguiente idea, genera:
1.  **Nombre del Ejercicio:** Un nombre claro y conciso.
2.  **Descripción Detallada en Markdown:** Proporciona una descripción clara y bien estructurada utilizando formato Markdown. Incluye las siguientes secciones:
    -   **Objetivo:** El propósito principal del ejercicio.
    -   **Material Necesario:** Una lista con viñetas.
    -   **Organización:** Cómo se disponen los jugadores y el material.
    -   **Instrucciones:** Pasos detallados del ejercicio.
3.  **Duración Estimada:** En minutos.
4.  **Diagrama Esquemático:** Un diagrama de entrenamiento de fútbol dinámico y de alta calidad, con un estilo de arte anime vibrante. La imagen debe ser clara, colorida y renderizada profesionalmente. Usa una perspectiva isométrica para dar profundidad. Los jugadores deben parecer figuras de acción de anime, con estelas de movimiento para indicar velocidad y pases.

Idea Principal: ${input.taskIdea}`;
    if (input.taskCategory) {
      systemPrompt += `\nCategoría del Ejercicio: ${input.taskCategory}`;
    }
    systemPrompt += `\n\nPor favor, proporciona los detalles textuales claramente separados y la imagen.
Formato esperado para el texto (antes de la imagen):
Nombre del Ejercicio: [Nombre aquí]
Duración Estimada: [Duración aquí] min
Descripción Markdown:
[Descripción detallada en formato Markdown aquí]`;


    try {
      const {text, media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: systemPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      let taskName = "Ejercicio Sugerido";
      let taskDescription = "Descripción generada por IA.";
      let taskDurationMinutes: number | undefined = undefined;
      
      if (text) {
        const nameMatch = text.match(/Nombre del Ejercicio:\s*(.*)/i);
        if (nameMatch && nameMatch[1]) taskName = nameMatch[1].trim();

        const descMatch = text.match(/Descripción Markdown:\s*([\s\S]*)/i);
        if (descMatch && descMatch[1]) {
            taskDescription = descMatch[1].trim();
        } else {
             const fallbackDescMatch = text.match(/Descripción Detallada:\s*([\s\S]*?)(Duración Estimada:|Diagrama Esquemático:|$)/i);
             if (fallbackDescMatch && fallbackDescMatch[1]) taskDescription = fallbackDescMatch[1].trim();
             else if (text.length > 10) taskDescription = text;
        }
        
        const durationMatch = text.match(/Duración Estimada:\s*(\d+)\s*min/i);
        if (durationMatch && durationMatch[1]) {
          const duration = parseInt(durationMatch[1], 10);
          if (!isNaN(duration)) taskDurationMinutes = duration;
        }

      } else if (!media?.url) {
          throw new Error('La IA no generó texto ni imagen para la tarea.');
      }


      return {
        taskName,
        taskDescription,
        taskDurationMinutes,
        taskImageDataUri: media?.url,
      };

    } catch (error) {
      console.error('Error en generateTrainingTaskFlow:', error);
      throw new Error('Error al generar la tarea de entrenamiento con IA.');
    }
  }
);
