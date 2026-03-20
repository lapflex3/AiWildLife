
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { db } from './firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

const API_KEY = process.env.API_KEY;

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!API_KEY) {
      console.error("API_KEY environment variable not set.");
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async analyzeImage(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    try {
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      };
      const textPart = { text: prompt };
      
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, textPart] },
      });

      return response.text;
    } catch (error) {
      console.error('Error analyzing image:', error);
      return 'An error occurred while analyzing the image. Please check the console for details.';
    }
  }

  async generateImage(prompt: string, aspectRatio: string): Promise<string> {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio,
        },
      });
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64ImageBytes}`;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error('Failed to generate image. Please check your prompt and API key.');
    }
  }
  
  async generateVideo(prompt: string, aspectRatio: string): Promise<any> {
    try {
      let operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
        }
      });
      return operation;
    } catch(error) {
      console.error('Error starting video generation:', error);
      throw new Error('Failed to start video generation.');
    }
  }

  async getVideosOperation(operation: any): Promise<any> {
    try {
      return await this.ai.operations.getVideosOperation({operation: operation});
    } catch (error) {
      console.error('Error fetching video operation status:', error);
      throw new Error('Failed to fetch video operation status.');
    }
  }


  async advancedReasoning(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error with advanced reasoning:', error);
      return 'An error occurred during reasoning. Please check the console for details.';
    }
  }

  async analyzeCameraFrame(imageBase64: string): Promise<any> {
    try {
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      };
      
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        contents: { parts: [imagePart] },
        config: {
          systemInstruction: `You are an AI security guard for a farm. 
          Analyze the image and identify if there are any humans or wild animals (elephants, tigers, lions, crocodiles, cheetahs, etc.).
          Return the result in JSON format.
          Example: { "detected": true, "type": "animal", "label": "tiger", "confidence": 0.95, "message": "Tiger detected near the fence!" }
          If nothing significant is detected, return { "detected": false }.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              type: { type: Type.STRING, enum: ['human', 'animal', 'unknown'] },
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              message: { type: Type.STRING }
            },
            required: ['detected']
          }
        }
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.error('Error analyzing camera frame:', error);
      return { detected: false, error: 'Failed to analyze frame' };
    }
  }

  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  }

  generateSpeech(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Your browser does not support the Text-to-Speech API.');
    }
  }
}
