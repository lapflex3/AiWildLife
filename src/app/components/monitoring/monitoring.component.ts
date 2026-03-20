import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../../gemini.service';
import { OfflineAiService } from '../../services/offline-ai.service';
import { QuotaService } from '../../services/quota.service';
import { ConfigService, CameraConfig } from '../../services/config.service';
import { DetectionService } from '../../services/detection.service';
import { NotificationService } from '../../services/notification.service';
import { auth } from '../../../firebase';
import { LoaderComponent } from '../shared/loader.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [CommonModule, LoaderComponent, MatIconModule],
  templateUrl: './monitoring.component.html',
  styleUrl: './monitoring.component.css'
})
export class MonitoringComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  private geminiService = inject(GeminiService);
  private offlineAiService = inject(OfflineAiService);
  public quotaService = inject(QuotaService);
  private configService = inject(ConfigService);
  private detectionService = inject(DetectionService);
  private notificationService = inject(NotificationService);

  isMonitoring = signal<boolean>(false);
  isAnalyzing = signal<boolean>(false);
  aiStatus = signal<'Idle' | 'Analyzing Frame' | 'Processing...'>('Idle');
  error = signal<string | null>(null);
  lastDetection = signal<any>(null);
  config = signal<CameraConfig | null>(null);
  
  private stream: MediaStream | null = null;
  private analysisInterval: any;

  ngAfterViewInit() {
    this.configService.config$.subscribe(config => {
      this.config.set(config);
      if (config) {
        this.isMonitoring.set(config.active);
        if (config.active) {
          this.startCamera();
        } else {
          this.stopCamera();
        }
      }
    });
  }

  async toggleMonitoring() {
    const config = this.configService.getConfig();
    if (!config) return;

    const newState = !config.active;
    await this.configService.updateConfig({ active: newState });
  }

  async startCamera() {
    try {
      this.error.set(null);
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      this.videoElement.nativeElement.srcObject = this.stream;
      this.startAnalysis();
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      let message = 'Camera access denied or not available.';
      
      if (err.name === 'NotAllowedError') {
        message = 'Camera permission was denied. Please allow access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera device found. Please ensure your camera is connected.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        message = 'Camera does not support the requested resolution.';
      }
      
      this.error.set(message);
      this.isMonitoring.set(false);
    }
  }

  async retry() {
    this.error.set(null);
    const config = this.configService.getConfig();
    if (config?.active) {
      await this.startCamera();
    } else {
      await this.toggleMonitoring();
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.stopAnalysis();
  }

  startAnalysis() {
    this.stopAnalysis();
    const config = this.configService.getConfig();
    if (!config) return;

    const interval = config.samplingRate * 1000;
    this.analysisInterval = setInterval(() => {
      this.analyzeFrame();
    }, interval);
  }

  stopAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
  }

  async analyzeFrame() {
    if (this.isAnalyzing() || !this.quotaService.canUseAI() || !this.isMonitoring()) {
      this.aiStatus.set('Idle');
      return;
    }

    this.isAnalyzing.set(true);
    this.aiStatus.set('Processing...');
    try {
      const frame = this.captureFrame();
      if (!frame) {
        this.aiStatus.set('Idle');
        return;
      }

      // Increment usage
      const canProceed = await this.quotaService.incrementUsage();
      if (!canProceed) {
        this.error.set('Daily AI usage limit reached.');
        this.isMonitoring.set(false);
        this.stopCamera();
        this.aiStatus.set('Idle');
        return;
      }

      this.aiStatus.set('Analyzing Frame');
      const currentTime = new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
      const currentConfig = this.config();
      const currentModelId = currentConfig?.modelId || 'gemini-3-flash-preview';
      
      let result: any;
      if (currentConfig?.offlineMode) {
        // Use local TensorFlow.js model
        result = await this.offlineAiService.analyzeFrame(this.canvasElement.nativeElement);
      } else {
        // Use Cloud Gemini API
        result = await this.geminiService.analyzeCameraFrame(frame, currentTime, currentModelId);
      }
      
      this.lastDetection.set(result);
      this.error.set(null); // Clear any previous analysis errors

      if (result.detected) {
        const user = auth.currentUser;
        if (user) {
          // Save detection
          await this.detectionService.addDetection({
            timestamp: Date.now(),
            type: result.type,
            label: result.label,
            confidence: result.confidence,
            imageUrl: frame, // Store frame for review
            uid: user.uid
          });

            // Trigger alert for high confidence, dangerous animals, or high severity behavior
            if (result.confidence > 0.7 || result.type === 'animal' || result.severity === 'high') {
              const severity = result.severity || (result.type === 'animal' ? 'high' : 'medium');
              const message = result.message || `Detected ${result.label || result.type}`;
              
              await this.detectionService.addAlert({
                timestamp: Date.now(),
                message,
                severity,
                uid: user.uid
              });
              
              // Real-time notifications (Browser & Webhook)
              this.notificationService.sendAlert(message, severity, frame);
              
              // Text to speech alert
              this.geminiService.generateSpeech(message);
            }
        }
      }
    } catch (err: any) {
      console.error('Error during frame analysis:', err);
      if (err.message?.includes('Quota exceeded')) {
        this.error.set('AI quota exceeded. Monitoring paused.');
        this.isMonitoring.set(false);
        this.stopCamera();
      } else {
        this.error.set('AI analysis failed. Checking connection...');
      }
    } finally {
      this.isAnalyzing.set(false);
      this.aiStatus.set('Idle');
    }
  }

  private captureFrame(): string | null {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const config = this.configService.getConfig();
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (config?.calibration) {
          const { roiX, roiY, roiWidth, roiHeight } = config.calibration;
          const sx = (roiX / 100) * video.videoWidth;
          const sy = (roiY / 100) * video.videoHeight;
          const sw = (roiWidth / 100) * video.videoWidth;
          const sh = (roiHeight / 100) * video.videoHeight;
          
          canvas.width = sw;
          canvas.height = sh;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        // Compress image to save quota and bandwidth
        return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      }
    }
    return null;
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
