
import { Injectable, signal } from '@angular/core';

export type HistoryCategory = 'image-analysis' | 'image-generation' | 'video-generation' | 'advanced-reasoning';

export interface HistoryItem {
  prompt: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly STORAGE_KEY = 'gemini_prompt_history';
  private readonly MAX_HISTORY = 10;

  // Signal to store the history, initialized from localStorage
  private historySignal = signal<Record<HistoryCategory, HistoryItem[]>>(this.loadHistory());

  constructor() {}

  private loadHistory(): Record<HistoryCategory, HistoryItem[]> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const defaultHistory: Record<HistoryCategory, HistoryItem[]> = {
      'image-analysis': [],
      'image-generation': [],
      'video-generation': [],
      'advanced-reasoning': []
    };

    if (stored) {
      try {
        return { ...defaultHistory, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse history from localStorage', e);
        return defaultHistory;
      }
    }
    return defaultHistory;
  }

  private saveHistory(history: Record<HistoryCategory, HistoryItem[]>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  getHistory(category: HistoryCategory) {
    return this.historySignal()[category];
  }

  addToHistory(category: HistoryCategory, prompt: string): void {
    if (!prompt || !prompt.trim()) return;

    this.historySignal.update(history => {
      const categoryHistory = [...history[category]];
      
      // Remove if already exists (to move to top)
      const existingIndex = categoryHistory.findIndex(item => item.prompt === prompt);
      if (existingIndex !== -1) {
        categoryHistory.splice(existingIndex, 1);
      }

      // Add to beginning
      categoryHistory.unshift({
        prompt: prompt.trim(),
        timestamp: Date.now()
      });

      // Limit size
      const updatedCategoryHistory = categoryHistory.slice(0, this.MAX_HISTORY);
      
      const updatedHistory = {
        ...history,
        [category]: updatedCategoryHistory
      };

      this.saveHistory(updatedHistory);
      return updatedHistory;
    });
  }

  clearHistory(category: HistoryCategory): void {
    this.historySignal.update(history => {
      const updatedHistory = {
        ...history,
        [category]: []
      };
      this.saveHistory(updatedHistory);
      return updatedHistory;
    });
  }
}
