import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { QuotaService } from '../../services/quota.service';
import { NotificationService } from '../../services/notification.service';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LoaderComponent } from '../shared/loader.component';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { OperationType, handleFirestoreError } from '../../services/quota.service';
import { firstValueFrom } from 'rxjs';
import * as QRCode from 'qrcode';
import { NgxScannerQrcodeComponent, ScannerQRCodeResult } from 'ngx-scanner-qrcode';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, LoaderComponent, NgxScannerQrcodeComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  private configService = inject(ConfigService);
  private quotaService = inject(QuotaService);
  private notificationService = inject(NotificationService);
  private alertConfigService = inject(ConfigService); // Re-using for simplicity

  config$ = this.configService.config$;
  alertConfig$ = this.alertConfigService.alertConfig$;
  quota$ = this.quotaService.quota$;
  
  alertForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    whatsapp: new FormControl('', [Validators.required]),
    enabled: new FormControl(true)
  });

  connectionQR = signal<string | null>(null);
  isScanning = signal<boolean>(false);

  openCalibration = output<void>();

  constructor() {
    this.alertConfig$.subscribe(config => {
      if (config) {
        this.alertForm.patchValue({
          email: config.email,
          whatsapp: config.whatsapp,
          enabled: config.enabled
        });
      }
    });

    auth.onAuthStateChanged(user => {
      if (user) {
        this.generateConnectionQR(user.uid);
      }
    });
  }

  async generateConnectionQR(userId: string) {
    try {
      const data = JSON.stringify({
        type: 'SENTINEL_CONNECT',
        uid: userId,
        email: auth.currentUser?.email,
        displayName: auth.currentUser?.displayName
      });
      const qr = await QRCode.toDataURL(data);
      this.connectionQR.set(qr);
    } catch (err) {
      console.error('QR Generation failed:', err);
    }
  }

  onScan(event: ScannerQRCodeResult[]) {
    if (event && event.length > 0) {
      const data = event[0].value;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'DEVICE_REGISTER') {
          this.registerDevice(parsed);
          this.isScanning.set(false);
        }
      } catch (e) {
        console.error('Invalid QR data');
      }
    }
  }

  async registerDevice(data: any) {
    const user = auth.currentUser;
    if (!user) return;

    await this.configService.registerDevice({
      id: data.deviceId || Math.random().toString(36).substring(7),
      userId: user.uid,
      deviceName: data.deviceName || 'Unknown Device',
      registeredAt: Date.now(),
      token: data.token
    });
    console.log('Device registered successfully!');
  }

  async saveAlertConfig() {
    if (this.alertForm.invalid) return;
    const val = this.alertForm.value;
    await this.configService.updateAlertConfig({
      email: val.email!,
      whatsapp: val.whatsapp!,
      enabled: val.enabled!
    });
    console.log('Alert configuration saved!');
  }

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

  async toggleOfflineMode() {
    const config = await firstValueFrom(this.config$);
    if (config) {
      await this.configService.updateConfig({ offlineMode: !config.offlineMode });
    }
  }

  async updateSamplingRate(rate: number) {
    await this.configService.updateConfig({ samplingRate: rate });
  }

  async updateModelId(event: any) {
    const modelId = event.target.value;
    await this.configService.updateConfig({ modelId });
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
