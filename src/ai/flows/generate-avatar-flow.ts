
'use server';
/**
 * @fileOverview Flujo de Genkit para generar avataares.
 *
 * - generateAvatar - Función que genera una imagen de avatar.
 * - GenerateAvatarInput - El tipo de entrada para la función generateAvatar.
 * - GenerateAvatarOutput - El tipo de retorno para la función generateAvatar.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAvatarInputSchema = z.object({
  promptText: z.string().describe('Texto base para el avatar, ej. iniciales o nombre.'),
  entityType: z.enum(['player', 'user', 'channel']).describe('Tipo de entidad para la que se genera el avatar.'),
});
export type GenerateAvatarInput = z.infer<typeof GenerateAvatarInputSchema>;

const GenerateAvatarOutputSchema = z.object({
  imageDataUri: z.string().describe("La imagen generada como un Data URI (Base64)."),
});
export type GenerateAvatarOutput = z.infer<typeof GenerateAvatarOutputSchema>;

export async function generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarOutput> {
  return generateAvatarFlow(input);
}

const generateAvatarFlow = ai.defineFlow(
  {
    name: 'generateAvatarFlow',
    inputSchema: GenerateAvatarInputSchema,
    outputSchema: GenerateAvatarOutputSchema,
  },
  async (input) => {
    const basePrompt = `Genera un avatar moderno, minimalista y de alta calidad.`;
    let specificInstructions = '';

    if (input.entityType === 'player' || input.entityType === 'user') {
      specificInstructions = `Utiliza las iniciales "${input.promptText.substring(0,2).toUpperCase()}" como elemento central. El diseño debe ser abstracto, geométrico, con una paleta de colores contemporánea y un toque energético y deportivo. Asegúrate de que las iniciales sean claramente legibles y el diseño sea impactante.`;
    } else if (input.entityType === 'channel') {
      specificInstructions = `Crea un logo icónico y moderno para un canal de comunicación llamado "${input.promptText}". El diseño debe ser flat, minimalista, fácilmente reconocible y usar una paleta de colores vibrante y profesional. Ideal para un avatar de chat.`;
    } else { // Fallback
      specificInstructions = `Estilo abstracto, moderno y colorido con el tema: "${input.promptText}".`;
    }
    
    const finalPrompt = `${basePrompt} ${specificInstructions} El avatar debe ser cuadrado y adecuado para un perfil digital pequeño.`;

    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-preview-image-generation',
        prompt: finalPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (media && media.url) {
        return { imageDataUri: media.url };
      } else {
        console.error('No se generó ninguna imagen o la URL es nula.');
        throw new Error('No se pudo generar la imagen del avatar.');
      }
    } catch (error) {
      console.error('Error en generateAvatarFlow:', error);
      // Consider throwing a more specific error or returning a default/error indicator URI
      throw new Error('Error al generar el avatar con IA.');
    }
  }
);
