
import { Component, ChangeDetectionStrategy, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';
import { LoaderComponent } from '../shared/loader.component';
import { HistoryService } from '../../history.service';

@Component({
  selector: 'app-video-generation',
  templateUrl: './video-generation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoaderComponent],
})
export class VideoGenerationComponent implements OnDestroy {
  prompt = signal<string>('A cinematic shot of a wolf howling at a full moon in a snowy forest.');
  aspectRatio = signal<string>('16:9');
  generatedVideoUrl = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  loadingMessage = signal<string>('');
  error = signal<string>('');
  
  private geminiService = inject(GeminiService);
  private historyService = inject(HistoryService);

  get history() {
    return this.historyService.getHistory('video-generation');
  }

  private pollingInterval: any;
  private loadingMessages = [
    "Warming up the digital film crew...",
    "Rendering the first few frames...",
    "Compositing the special effects...",
    "Adding sound design and foley...",
    "Finalizing the color grade...",
    "This is taking a bit longer than usual, but we're getting there!"
  ];

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

  async generateVideo(): Promise<void> {
    const currentPrompt = this.prompt();
    if (!currentPrompt) {
      this.error.set('Please enter a prompt to generate a video.');
      return;
    }
    this.isLoading.set(true);
    this.error.set('');
    this.generatedVideoUrl.set(null);
    
    try {
      let operation = await this.geminiService.generateVideo(currentPrompt, this.aspectRatio());
      this.historyService.addToHistory('video-generation', currentPrompt);
      this.pollOperationStatus(operation);
    } catch (err: any) {
      this.error.set(err.message || 'An unknown error occurred starting the video generation.');
      this.isLoading.set(false);
    }
  }

  private pollOperationStatus(operation: any): void {
    let messageIndex = 0;
    this.loadingMessage.set(this.loadingMessages[messageIndex]);
    
    // Update loading message periodically
    const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % this.loadingMessages.length;
        this.loadingMessage.set(this.loadingMessages[messageIndex]);
    }, 8000);

    this.pollingInterval = setInterval(async () => {
      try {
        const updatedOperation = await this.geminiService.getVideosOperation(operation);
        operation = updatedOperation;

        if (operation.done) {
          this.stopPolling(messageInterval);
          if (operation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = operation.response.generatedVideos[0].video.uri;
            this.generatedVideoUrl.set(`${downloadLink}&key=${process.env.API_KEY}`);
          } else {
            this.error.set('Video generation finished, but no video was returned. It may have been filtered.');
          }
          this.isLoading.set(false);
        }
      } catch (err) {
        this.stopPolling(messageInterval);
        this.error.set('An error occurred while checking video status.');
        this.isLoading.set(false);
      }
    }, 10000); // Poll every 10 seconds
  }

  private stopPolling(messageInterval: any): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (messageInterval) {
        clearInterval(messageInterval);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling(null);
  }
}
