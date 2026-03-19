import { GoogleGenAI, Modality, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

export interface ReactionDetails {
  name: string;
  equation: string;
  mechanism: string;
  notes: string;
}

export interface ChemistryResponse {
  voiceText: string;
  reactionDetails?: ReactionDetails;
  molecularDescription?: string;
  summary: string;
  language: 'bn' | 'en';
}

export class ChemistryService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async getChemistryExplanation(prompt: string, history: { role: string; parts: { text: string }[] }[] = []): Promise<ChemistryResponse> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: `You are 'Chemistry Expert AI', a professional chemistry teacher. 
        Your goal is to explain complex chemistry topics simply.
        Respond in the language the user uses (Bengali or English).
        
        Return your response in the following JSON format:
        {
          "voiceText": "A short, friendly, and educational explanation to be spoken.",
          "reactionDetails": {
            "name": "Reaction Name",
            "equation": "Chemical Equation (use LaTeX or clear text)",
            "mechanism": "Step-by-step details",
            "notes": "Important points to remember"
          },
          "molecularDescription": "A schematic description of the molecule's structure.",
          "summary": "A brief summary for session history.",
          "language": "bn" or "en"
        }
        
        If the query is not related to chemistry, politely steer the conversation back to chemistry.
        If no specific reaction is mentioned, provide general chemistry knowledge.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            voiceText: { type: Type.STRING },
            reactionDetails: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                equation: { type: Type.STRING },
                mechanism: { type: Type.STRING },
                notes: { type: Type.STRING }
              }
            },
            molecularDescription: { type: Type.STRING },
            summary: { type: Type.STRING },
            language: { type: Type.STRING, enum: ["bn", "en"] }
          },
          required: ["voiceText", "summary", "language"]
        }
      }
    });

    try {
      return JSON.parse(response.text || "{}") as ChemistryResponse;
    } catch (e) {
      console.error("Failed to parse AI response", e);
      return {
        voiceText: "I'm sorry, I encountered an error processing that request.",
        summary: "Error processing request",
        language: "en"
      };
    }
  }

  async generateSpeech(text: string, language: 'bn' | 'en'): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this ${language === 'bn' ? 'Bengali' : 'English'} text naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: language === 'bn' ? 'Kore' : 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (e) {
      console.error("Speech generation failed", e);
      return null;
    }
  }

  async generateMolecularImage(description: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A clean, educational schematic diagram of a chemical molecular structure: ${description}. White background, professional textbook style.`,
            },
          ],
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) {
      console.error("Image generation failed", e);
      return null;
    }
  }
}

export const chemistryService = new ChemistryService();
