
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';
import { LoaderComponent } from '../shared/loader.component';
import { HistoryService } from '../../history.service';

@Component({
  selector: 'app-image-generation',
  templateUrl: './image-generation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoaderComponent],
})
export class ImageGenerationComponent {
  prompt = signal<string>('A photorealistic image of a futuristic city at sunset, with flying cars.');
  aspectRatio = signal<string>('1:1');
  generatedImage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string>('');
  
  readonly aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];

  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);

  get history() {
    return this.historyService.getHistory('image-generation');
  }

  updatePrompt(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.prompt.set(input.value);
  }

  useHistoryPrompt(prompt: string): void {
    this.prompt.set(prompt);
  }

  setAspectRatio(ratio: string): void {
    this.aspectRatio.set(ratio);
  }

  async generateImage(): Promise<void> {
    const currentPrompt = this.prompt();
    if (!currentPrompt) {
      this.error.set('Please enter a prompt to generate an image.');
      return;
    }
    this.isLoading.set(true);
    this.error.set('');
    this.generatedImage.set(null);

    try {
      const imageUrl = await this.geminiService.generateImage(currentPrompt, this.aspectRatio());
      this.generatedImage.set(imageUrl);
      this.historyService.addToHistory('image-generation', currentPrompt);
    } catch (err: any) {
      this.error.set(err.message || 'An unknown error occurred.');
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
