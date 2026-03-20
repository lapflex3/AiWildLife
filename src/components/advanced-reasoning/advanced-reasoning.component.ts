
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';
import { LoaderComponent } from '../shared/loader.component';
import { HistoryService } from '../../history.service';

@Component({
  selector: 'app-advanced-reasoning',
  templateUrl: './advanced-reasoning.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoaderComponent],
})
export class AdvancedReasoningComponent {
  prompt = signal<string>('Explain the theory of relativity as if I were a curious 10-year-old.');
  result = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string>('');

  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);

  get history() {
    return this.historyService.getHistory('advanced-reasoning');
  }

  updatePrompt(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.prompt.set(input.value);
  }

  useHistoryPrompt(prompt: string): void {
    this.prompt.set(prompt);
  }

  async submitPrompt(): Promise<void> {
    const currentPrompt = this.prompt();
    if (!currentPrompt) {
      this.error.set('Please enter a prompt.');
      return;
    }
    this.isLoading.set(true);
    this.error.set('');
    this.result.set('');

    try {
      const response = await this.geminiService.advancedReasoning(currentPrompt);
      this.result.set(response);
      this.historyService.addToHistory('advanced-reasoning', currentPrompt);
    } catch (err: any) {
      this.error.set(err.message || 'An unknown error occurred.');
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
