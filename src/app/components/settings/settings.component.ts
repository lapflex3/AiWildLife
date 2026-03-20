import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { QuotaService } from '../../services/quota.service';
import { NotificationService } from '../../services/notification.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LoaderComponent } from '../shared/loader.component';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { OperationType, handleFirestoreError } from '../../services/quota.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, LoaderComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  private configService = inject(ConfigService);
  private quotaService = inject(QuotaService);
  private notificationService = inject(NotificationService);

  config$ = this.configService.config$;
  quota$ = this.quotaService.quota$;

  openCalibration = output<void>();

  async toggleNotifications() {
    const config = await firstValueFrom(this.config$);
    if (!config?.notificationsEnabled) {
      await this.notificationService.requestPermission();
    } else {
      await this.configService.updateConfig({ notificationsEnabled: false });
    }
  }

  async updateWebhookUrl(event: any) {
    const url = event.target.value;
    await this.configService.updateConfig({ webhookUrl: url });
  }

  async toggleLowPowerMode() {
    const config = await firstValueFrom(this.config$);
    if (config) {
      await this.configService.updateConfig({ lowPowerMode: !config.lowPowerMode });
    }
  }

  async updateSamplingRate(rate: number) {
    await this.configService.updateConfig({ samplingRate: rate });
  }

  async updateDailyLimit(limit: number) {
    const user = auth.currentUser;
    if (!user) return;

    const path = `quotas/${user.uid}`;
    try {
      const quotaRef = doc(db, path);
      await updateDoc(quotaRef, { dailyLimit: limit });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}
