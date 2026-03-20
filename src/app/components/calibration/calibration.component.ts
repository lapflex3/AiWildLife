import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService, CameraConfig } from '../../services/config.service';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-calibration',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './calibration.component.html',
  styleUrl: './calibration.component.css'
})
export class CalibrationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  private configService = inject(ConfigService);
  
  isCalibrating = signal(false);
  roi = signal<{ x: number, y: number, w: number, h: number } | null>(null);
  
  private stream: MediaStream | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;

  async ngAfterViewInit() {
    this.ctx = this.canvasElement.nativeElement.getContext('2d');
    const config = await firstValueFrom(this.configService.config$);
    if (config?.calibration) {
      this.roi.set({
        x: config.calibration.roiX,
        y: config.calibration.roiY,
        w: config.calibration.roiWidth,
        h: config.calibration.roiHeight
      });
    }
    this.startCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.videoElement.nativeElement.srcObject = this.stream;
      this.isCalibrating.set(true);
      this.drawLoop();
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  }

  drawLoop() {
    if (!this.isCalibrating()) return;
    this.draw();
    requestAnimationFrame(() => this.drawLoop());
  }

  draw() {
    if (!this.ctx) return;
    const canvas = this.canvasElement.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentRoi = this.roi();
    if (currentRoi) {
      const x = (currentRoi.x / 100) * canvas.width;
      const y = (currentRoi.y / 100) * canvas.height;
      const w = (currentRoi.w / 100) * canvas.width;
      const h = (currentRoi.h / 100) * canvas.height;

      this.ctx.strokeStyle = '#10b981'; // emerald-500
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // Fill outside ROI with semi-transparent black
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, canvas.width, y); // Top
      this.ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h)); // Bottom
      this.ctx.fillRect(0, y, x, h); // Left
      this.ctx.fillRect(x + w, y, canvas.width - (x + w), h); // Right
    }
  }

  onMouseDown(event: MouseEvent) {
    this.isDrawing = true;
    const rect = this.canvasElement.nativeElement.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing) return;
    const rect = this.canvasElement.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const x = Math.min(this.startX, currentX);
    const y = Math.min(this.startY, currentY);
    const w = Math.abs(currentX - this.startX);
    const h = Math.abs(currentY - this.startY);

    // Convert to percentages
    this.roi.set({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      w: (w / rect.width) * 100,
      h: (h / rect.height) * 100
    });
  }

  onMouseUp() {
    this.isDrawing = false;
  }

  async saveCalibration() {
    const currentRoi = this.roi();
    if (currentRoi) {
      await this.configService.updateConfig({
        calibration: {
          roiX: currentRoi.x,
          roiY: currentRoi.y,
          roiWidth: currentRoi.w,
          roiHeight: currentRoi.h
        }
      });
    }
  }

  resetCalibration() {
    this.roi.set(null);
  }

  ngOnDestroy() {
    this.isCalibrating.set(false);
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}
