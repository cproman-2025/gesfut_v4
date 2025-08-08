
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey && process.env.NODE_ENV !== 'production') {
  // Log a warning only during development if the key isn't set.
  // In production, it's assumed to be set, or Genkit will throw an error.
  console.warn(
    'GEMINI_API_KEY environment variable is not set. AI features may not work.' +
    ' Please create a .env.local file (or .env for your environment) and add GEMINI_API_KEY=YOUR_API_KEY.'
  );
}

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: geminiApiKey }), // Explicitly pass the API key
  ],
  // The model property here sets a default model for the ai() instance if not specified elsewhere.
  // It's not directly related to the API key initialization of the plugin.
  // model: 'googleai/gemini-pro', // You can set a default text model here if desired
});
