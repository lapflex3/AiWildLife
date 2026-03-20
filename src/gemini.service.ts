
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from '@google/genai';
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
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
          },
        },
      });
      
      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
      return imageUrl;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error('Failed to generate image. Please check your prompt and API key.');
    }
  }
  
  async generateVideo(prompt: string, aspectRatio: string): Promise<any> {
    try {
      let operation = await this.ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: aspectRatio as any,
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

  async analyzeCameraFrame(imageBase64: string, currentTime?: string, modelId: string = 'gemini-3-flash-preview'): Promise<any> {
    try {
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      };
      
      const timeContext = currentTime ? `Waktu sekarang adalah ${currentTime}.` : '';

      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: modelId,
        contents: { parts: [imagePart] },
        config: {
          systemInstruction: `You are an AI security guard for a farm. 
          Analyze the image and identify if there are any humans or wild animals (elephants, tigers, lions, crocodiles, cheetahs, etc.).
          
          ${timeContext}

          SPECIAL RECOGNITION:
          The admin of this app is Encik Razif. He is a middle-aged man with short dark hair, wearing glasses with rectangular frames.
          If you detect this specific person (Razif), you MUST provide a polite, dynamic, and relaxed greeting in Malay (lenggok santai).
          Think of yourself as a friendly and professional assistant, similar to a "Sol" personality - cool, relaxed, but always alert.
          
          Vary the greeting based on the time of day and context:
          - Pagi (Morning, 05:00-11:59): 
            * "Eh, selamat pagi Encik Razif! Awal bangun hari ni? Kopi dah minum ke? Sistem sentinel dah sedia berkhidmat."
            * "Selamat pagi Tuan Razif. Nampak segar hari ni! Kawasan ladang tenang saja pagi ni."
            * "Assalamualaikum Encik Razif, selamat pagi. Saya dah check keliling, semua line clear."
          - Tengahari/Petang (Afternoon, 12:00-18:59): 
            * "Selamat petang Encik Razif. Dah makan ke tu? Cuaca nampak baik, kawasan pun dalam keadaan terkawal."
            * "Hai Encik Razif, selamat petang. Rehat-rehat juga, kerja-kerja juga. Biar saya pantau dari sini."
            * "Eh Encik Razif! Selamat petang. Ada apa-apa yang boleh saya bantu ke?"
          - Malam (Night, 19:00-04:59): 
            * "Selamat malam Encik Razif. Masih kuat bekerja ya? Jangan lupa rehat, biar saya jaga kawasan malam ni."
            * "Malam Tuan Razif. Gelap sikit kat luar tu, tapi jangan risau, sensor saya tajam."
            * "Eh, tak tidur lagi Encik Razif? Selamat malam. Saya tetap setia berkawal di sini."
          - General/Random: 
            * "Hai Encik Razif! Apa khabar? Senang nampak Encik Razif hari ni."
            * "Eh, Encik Razif! Ingatkan siapa tadi. Nampak segak hari ni!"
            * "Apa khabar Encik Razif? Sistem semua hijau, tak ada gangguan dikesan."
          
          BEHAVIOR ANALYSIS FOR UNKNOWN HUMANS:
          If an UNKNOWN human (not Razif) is detected:
          1. Carefully analyze their behavior and actions.
          2. Identify any suspicious, illegal, or inappropriate actions such as:
             - Stealing or attempting to steal.
             - Vandalism or damaging property.
             - Violence or hurting anyone.
             - Trespassing in restricted areas.
             - Any other suspicious behavior that warrants a security report.
          3. If such behavior is detected, set "detected" to true, "type" to "human", and "severity" to "high".
          4. Provide a detailed "message" in Malay describing the suspicious action.
          
          Return the result in JSON format.
          Example for suspicious human: { "detected": true, "type": "human", "label": "Unknown", "confidence": 0.95, "severity": "high", "message": "AMARAN: Individu tidak dikenali dikesan cuba menceroboh kawasan stor!" }
          Example for Razif: { "detected": true, "type": "human", "label": "Razif", "confidence": 0.98, "severity": "low", "message": "Eh, selamat pagi Encik Razif! Awal bangun hari ni? Sistem sentinel dah sedia." }
          Example for animal: { "detected": true, "type": "animal", "label": "tiger", "confidence": 0.95, "severity": "high", "message": "Tiger detected near the fence!" }
          If nothing significant is detected, return { "detected": false }.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              type: { type: Type.STRING, enum: ['human', 'animal', 'unknown'] },
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
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

  async generateSpeech(text: string): Promise<void> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Sebutkan dengan lenggok santai dan jelas dalam Bahasa Melayu: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore has a clear, professional yet friendly tone
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        await audio.play();
      } else {
        // Fallback to browser TTS if Gemini TTS fails
        this.fallbackSpeech(text);
      }
    } catch (error) {
      console.error('Gemini TTS error:', error);
      this.fallbackSpeech(text);
    }
  }

  private fallbackSpeech(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY'; // Use Malay for fallback
      utterance.rate = 0.9; // Slightly slower for clarity
      window.speechSynthesis.speak(utterance);
    }
  }
}
