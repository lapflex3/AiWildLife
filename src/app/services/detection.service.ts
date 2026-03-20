import { Injectable, inject } from '@angular/core';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { BehaviorSubject } from 'rxjs';
import { OperationType, handleFirestoreError } from './quota.service';

export interface Detection {
  id: string;
  timestamp: number;
  type: 'human' | 'animal' | 'unknown';
  label?: string;
  confidence?: number;
  imageUrl?: string;
  uid: string;
}

export interface Alert {
  id: string;
  timestamp: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  uid: string;
}

@Injectable({
  providedIn: 'root'
})
export class DetectionService {
  private detectionsSubject = new BehaviorSubject<Detection[]>([]);
  detections$ = this.detectionsSubject.asObservable();

  private alertsSubject = new BehaviorSubject<Alert[]>([]);
  alerts$ = this.alertsSubject.asObservable();

  constructor() {
    auth.onAuthStateChanged(user => {
      if (user) {
        this.initDetections(user.uid);
        this.initAlerts(user.uid);
      } else {
        this.detectionsSubject.next([]);
        this.alertsSubject.next([]);
      }
    });
  }

  private initDetections(userId: string) {
    const path = 'detections';
    try {
      const detectionsRef = collection(db, path);
      const q = query(
        detectionsRef,
        where('uid', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      onSnapshot(q, (snapshot) => {
        const detections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Detection));
        this.detectionsSubject.next(detections);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private initAlerts(userId: string) {
    const path = 'alerts';
    try {
      const alertsRef = collection(db, path);
      const q = query(
        alertsRef,
        where('uid', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
        this.alertsSubject.next(alerts);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async addDetection(detection: Omit<Detection, 'id'>) {
    const path = 'detections';
    try {
      const detectionsRef = collection(db, path);
      await addDoc(detectionsRef, detection);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async addAlert(alert: Omit<Alert, 'id'>) {
    const path = 'alerts';
    try {
      const alertsRef = collection(db, path);
      await addDoc(alertsRef, alert);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
