import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectionService } from '../../services/detection.service';
import { QuotaService } from '../../services/quota.service';
import { MatIconModule } from '@angular/material/icon';
import { LoaderComponent } from '../shared/loader.component';

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

  detections$ = this.detectionService.detections$;
  alerts$ = this.detectionService.alerts$;
  quota$ = this.quotaService.quota$;

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}
