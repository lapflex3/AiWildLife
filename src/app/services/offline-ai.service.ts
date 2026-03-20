import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

@Injectable({
  providedIn: 'root'
})
export class OfflineAiService {
  private model: cocoSsd.ObjectDetection | null = null;
  private isModelLoading = false;

  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    if (this.isModelLoading || this.model) return;
    this.isModelLoading = true;
    try {
      // Ensure TF backend is ready
      await tf.ready();
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2' // Lightweight for browser performance
      });
      console.log('Offline AI Model (COCO-SSD) loaded successfully.');
    } catch (error) {
      console.error('Error loading offline AI model:', error);
    } finally {
      this.isModelLoading = false;
    }
  }

  async analyzeFrame(canvas: HTMLCanvasElement): Promise<any> {
    if (!this.model) {
      await this.loadModel();
      if (!this.model) return { detected: false, error: 'Model not loaded' };
    }

    try {
      const predictions = await this.model.detect(canvas);
      
      // Filter for humans and animals
      const animalLabels = ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];
      const humanLabels = ['person'];

      const detections = predictions.filter(p => 
        (humanLabels.includes(p.class) || animalLabels.includes(p.class)) && p.score > 0.5
      );

      if (detections.length > 0) {
        const topDetection = detections[0];
        const isHuman = humanLabels.includes(topDetection.class);
        
        return {
          detected: true,
          type: isHuman ? 'human' : 'animal',
          label: topDetection.class,
          confidence: topDetection.score,
          severity: isHuman ? 'medium' : 'high', // Animals are high severity in farm context
          message: `Offline AI: Dikesan ${topDetection.class} dengan keyakinan ${(topDetection.score * 100).toFixed(1)}%`
        };
      }

      return { detected: false };
    } catch (error) {
      console.error('Offline AI analysis error:', error);
      return { detected: false, error: 'Analysis failed' };
    }
  }
}
