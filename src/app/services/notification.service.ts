import { Injectable, inject } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private configService = inject(ConfigService);

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.configService.updateConfig({ notificationsEnabled: true });
      }
    }
  }

  async sendAlert(message: string, severity: string, imageUrl?: string) {
    const config = this.configService.getConfig();
    if (!config) return;

    // 1. Browser Notification
    if (config.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('AI WILDLIFE SENTINEL ALERT', {
        body: `[${severity.toUpperCase()}] ${message}`,
        icon: '/favicon.ico',
        image: imageUrl ? `data:image/jpeg;base64,${imageUrl}` : undefined,
        tag: 'wildlife-alert'
      } as any);
    }

    // 2. Webhook Integration
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: 'CRITICAL_DETECTION',
            severity,
            message,
            timestamp: new Date().toISOString(),
            imageUrl: imageUrl ? `data:image/jpeg;base64,${imageUrl}` : null
          })
        });
      } catch (err) {
        console.error('Failed to send webhook alert:', err);
      }
    }
  }
}
