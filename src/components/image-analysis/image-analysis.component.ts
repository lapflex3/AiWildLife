
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';
import { LoaderComponent } from '../shared/loader.component';
import { HistoryService } from '../../history.service';

@Component({
  selector: 'app-image-analysis',
  templateUrl: './image-analysis.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoaderComponent],
})
export class ImageAnalysisComponent {
  prompt = signal<string>('What do you see in this image?');
  imagePreview = signal<string | null>(null);
  imageFile = signal<File | null>(null);
  analysisResult = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string>('');

  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);

  get history() {
    return this.historyService.getHistory('image-analysis');
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.imageFile.set(file);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview.set(e.target.result);
        this.analysisResult.set('');
        this.error.set('');
      };
      reader.readAsDataURL(file);
    }
  }

  updatePrompt(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.prompt.set(input.value);
  }

  useHistoryPrompt(prompt: string): void {
    this.prompt.set(prompt);
  }

  async analyzeImage(): Promise<void> {
    const file = this.imageFile();
    const currentPrompt = this.prompt();
    if (!file || !currentPrompt) {
      this.error.set('Please select an image and enter a prompt.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    this.analysisResult.set('');

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const base64Image = e.target.result.split(',')[1];
        const result = await this.geminiService.analyzeImage(currentPrompt, base64Image, file.type);
        this.analysisResult.set(result);
        this.historyService.addToHistory('image-analysis', currentPrompt);
      } catch (err) {
        this.error.set('Failed to analyze the image. Check the console for more details.');
        console.error(err);
      } finally {
        this.isLoading.set(false);
      }
    };
    reader.onerror = () => {
        this.error.set('Failed to read the image file.');
        this.isLoading.set(false);
    }
    reader.readAsDataURL(file);
  }
}
