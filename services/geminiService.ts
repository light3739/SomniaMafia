import { GoogleGenAI } from "@google/genai";
import { GamePhase, Role } from "../types";

// Note: In a production app, you should proxy these requests through a backend
// to protect your API Key. For this demo, it relies on process.env.API_KEY.

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_ID = "gemini-3-flash-preview";

export const generateNarrative = async (
  phase: GamePhase,
  dayCount: number,
  events: string[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Narrator (Offline): The API Key is missing. Imagine a suspenseful description here.";
  }

  let prompt = "";

  switch (phase) {
    case GamePhase.NIGHT:
      prompt = `It is Night ${dayCount}. The village of Somnia goes to sleep. Describe the eerie atmosphere in 2 sentences. Keep it dark and mysterious.`;
      break;
    case GamePhase.DAY:
      prompt = `It is Day ${dayCount}. The sun rises. ${events.join(" ")} Describe the reaction of the villagers in 2 sentences.`;
      break;
    case GamePhase.GAME_OVER:
      prompt = `The game is over. ${events.join(" ")} Write a short 2-sentence epilogue about the fate of the village.`;
      break;
    default:
      return "";
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
    });
    return response.text || "The wind howls silently...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "A strange static interference disrupts the narrator...";
  }
};

export const generateRoleDescription = async (role: Role): Promise<string> => {
    if (!process.env.API_KEY) return "You have been assigned a role.";
    
    const prompt = `You are the Game Master. A player has been assigned the role: ${role}. 
    Write a short, immersive 1-sentence description telling them what they must do to win. 
    Tone: Dark, serious Web3 cyberpunk.`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_ID,
            contents: prompt
        });
        return response.text || "Execute your mission.";
    } catch (e) {
        return "System failure. Check connection.";
    }
}