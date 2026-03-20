
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';
import { LoaderComponent } from '../shared/loader.component';

@Component({
  selector: 'app-video-analysis',
  templateUrl: './video-analysis.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoaderComponent],
})
export class VideoAnalysisComponent {
  prompt = signal<string>('Analyze the first frame of this video and describe the scene.');
  videoPreview = signal<string | null>(null);
  videoFile = signal<File | null>(null);
  analysisResult = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string>('');

  constructor(private geminiService: GeminiService) {}

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.videoFile.set(file);
      this.videoPreview.set(URL.createObjectURL(file));
      this.analysisResult.set('');
      this.error.set('');
    }
  }

  updatePrompt(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.prompt.set(input.value);
  }

  async analyzeVideo(): Promise<void> {
    const file = this.videoFile();
    const currentPrompt = this.prompt();
    if (!file || !currentPrompt) {
      this.error.set('Please select a video and enter a prompt.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    this.analysisResult.set('');

    this.extractFirstFrame(file)
      .then(async ({ base64, mimeType }) => {
        try {
          const result = await this.geminiService.analyzeImage(currentPrompt, base64, mimeType);
          this.analysisResult.set(result);
        } catch (err) {
          this.error.set('Failed to analyze the video frame. Check the console for more details.');
          console.error(err);
        } finally {
          this.isLoading.set(false);
        }
      })
      .catch(err => {
        this.error.set(err);
        this.isLoading.set(false);
      });
  }

  private extractFirstFrame(videoFile: File): Promise<{ base64: string, mimeType: string }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = 0;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Could not get canvas context');
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        URL.revokeObjectURL(video.src);
        resolve({
          base64: dataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject('Error loading video file for frame extraction.');
      };

      video.play().catch(e => {
        // Autoplay might be blocked, but we can still seek.
      });
    });
  }
}
