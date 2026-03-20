import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center space-y-3">
      <div class="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{{ text }}</p>
    </div>
  `
})
export class LoaderComponent {
  @Input() text: string = 'Processing...';
}
