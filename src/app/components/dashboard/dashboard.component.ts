import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectionService } from '../../services/detection.service';
import { QuotaService } from '../../services/quota.service';
import { GeminiService } from '../../../gemini.service';
import { MatIconModule } from '@angular/material/icon';
import { LoaderComponent } from '../shared/loader.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, LoaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  private detectionService = inject(DetectionService);
  private quotaService = inject(QuotaService);
  private geminiService = inject(GeminiService);

  detections$ = this.detectionService.detections$;
  alerts$ = this.detectionService.alerts$;
  quota$ = this.quotaService.quota$;

  dailySummary = signal<string | null>(null);
  isGeneratingSummary = signal<boolean>(false);

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  async generateSummary() {
    this.isGeneratingSummary.set(true);
    try {
      const detections = await firstValueFrom(this.detections$) || [];
      const alerts = await firstValueFrom(this.alerts$) || [];

      // Filter events from the last 24 hours to keep it relevant to "daily"
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentDetections = detections.filter(d => d.timestamp > twentyFourHoursAgo);
      const recentAlerts = alerts.filter(a => a.timestamp > twentyFourHoursAgo);

      const summary = await this.geminiService.analyzeDailyEvents(recentDetections, recentAlerts);
      this.dailySummary.set(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      this.dailySummary.set('Gagal menjana ringkasan pada masa ini.');
    } finally {
      this.isGeneratingSummary.set(false);
    }
  }
}
