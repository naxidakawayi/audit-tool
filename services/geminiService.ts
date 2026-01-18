
import { GoogleGenAI, Type } from "@google/genai";

export const getSmartMapping = async (fileHeaders: string[][]): Promise<string[]> => {
  if (fileHeaders.length < 1) return [];

  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    I have multiple Excel files with varying headers. 
    Analyze these header sets and suggest a single unified header list (schema) that best represents the combination of all data.
    Try to group similar concepts (e.g., 'User ID' and 'Member ID' should probably be mapped to one column).
    
    Input headers:
    ${fileHeaders.map((h, i) => `File ${i + 1}: ${h.join(', ')}`).join('\n')}
    
    Return a unified list of unique column names.
  `;

  try {
    // Calling generateContent directly with both model and prompt as per guidelines.
    // Using gemini-3-pro-preview for the complex task of schema inference across multiple datasets.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            unifiedHeaders: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["unifiedHeaders"]
        }
      }
    });

    // Access the .text property directly (not as a function) to get the generated string.
    const resultText = response.text || "{}";
    const result = JSON.parse(resultText);
    return result.unifiedHeaders || [];
  } catch (error) {
    console.error("Gemini mapping failed:", error);
    // Fallback: simple union of all headers
    const allHeaders = new Set<string>();
    fileHeaders.forEach(h => h.forEach(col => allHeaders.add(col)));
    return Array.from(allHeaders);
  }
};
