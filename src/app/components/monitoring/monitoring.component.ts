import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../../gemini.service';
import { QuotaService } from '../../services/quota.service';
import { ConfigService } from '../../services/config.service';
import { DetectionService } from '../../services/detection.service';
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
  public quotaService = inject(QuotaService);
  private configService = inject(ConfigService);
  private detectionService = inject(DetectionService);

  isMonitoring = signal<boolean>(false);
  isAnalyzing = signal<boolean>(false);
  error = signal<string | null>(null);
  lastDetection = signal<any>(null);
  
  private stream: MediaStream | null = null;
  private analysisInterval: any;

  ngAfterViewInit() {
    this.configService.config$.subscribe(config => {
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
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      this.videoElement.nativeElement.srcObject = this.stream;
      this.startAnalysis();
      this.error.set(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      this.error.set('Camera access denied or not available.');
      this.isMonitoring.set(false);
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
    if (this.isAnalyzing() || !this.quotaService.canUseAI() || !this.isMonitoring()) return;

    this.isAnalyzing.set(true);
    try {
      const frame = this.captureFrame();
      if (!frame) return;

      // Increment usage
      const canProceed = await this.quotaService.incrementUsage();
      if (!canProceed) {
        this.error.set('Daily AI usage limit reached.');
        this.isMonitoring.set(false);
        this.stopCamera();
        return;
      }

      const result = await this.geminiService.analyzeCameraFrame(frame);
      this.lastDetection.set(result);

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

          // Trigger alert for high confidence or dangerous animals
          if (result.confidence > 0.7 || result.type === 'animal') {
            await this.detectionService.addAlert({
              timestamp: Date.now(),
              message: result.message || `Detected ${result.label || result.type}`,
              severity: result.type === 'animal' ? 'high' : 'medium',
              uid: user.uid
            });
            
            // Text to speech alert
            this.geminiService.generateSpeech(result.message || `Warning: ${result.label || result.type} detected.`);
          }
        }
      }
    } catch (err) {
      console.error('Error during frame analysis:', err);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  private captureFrame(): string | null {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
