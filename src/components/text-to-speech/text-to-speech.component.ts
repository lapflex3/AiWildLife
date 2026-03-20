
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../gemini.service';

@Component({
  selector: 'app-text-to-speech',
  templateUrl: './text-to-speech.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class TextToSpeechComponent {
  textToSpeak = signal<string>('Hello, world! This is a demonstration of the browser\'s text-to-speech capabilities.');
  isSpeaking = signal<boolean>(false);

  constructor(private geminiService: GeminiService) {
    // Check speaking status
    setInterval(() => {
        this.isSpeaking.set(window.speechSynthesis.speaking);
    }, 500);
  }

  updateText(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.textToSpeak.set(input.value);
  }

  speak(): void {
    if (!this.textToSpeak()) {
      return;
    }
    this.geminiService.generateSpeech(this.textToSpeak());
  }

  cancel(): void {
    window.speechSynthesis.cancel();
    this.isSpeaking.set(false);
  }
}
