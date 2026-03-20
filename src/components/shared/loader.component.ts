
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  template: `
    <div class="flex flex-col items-center justify-center p-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
      @if (text()) {
        <p class="mt-4 text-sm text-gray-400">{{ text() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoaderComponent {
  text = input<string>('');
}
