import { Injectable, inject } from '@angular/core';
import { doc, setDoc, onSnapshot, updateDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { BehaviorSubject } from 'rxjs';
import { OperationType, handleFirestoreError } from './quota.service';

export interface CameraConfig {
  userId: string;
  lowPowerMode: boolean;
  samplingRate: number;
  active: boolean;
  modelId: string;
  offlineMode: boolean;
  notificationsEnabled?: boolean;
  webhookUrl?: string;
  calibration?: {
    roiX: number;
    roiY: number;
    roiWidth: number;
    roiHeight: number;
  };
}

export interface AlertConfig {
  userId: string;
  email: string;
  whatsapp: string;
  enabled: boolean;
}

export interface RegisteredDevice {
  id: string;
  userId: string;
  deviceName: string;
  registeredAt: number;
  token?: string;
}

export interface RecognizedFace {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  description?: string;
  registeredAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSubject = new BehaviorSubject<CameraConfig | null>(null);
  private alertConfigSubject = new BehaviorSubject<AlertConfig | null>(null);
  private devicesSubject = new BehaviorSubject<RegisteredDevice[]>([]);
  private facesSubject = new BehaviorSubject<RecognizedFace[]>([]);

  config$ = this.configSubject.asObservable();
  alertConfig$ = this.alertConfigSubject.asObservable();
  devices$ = this.devicesSubject.asObservable();
  faces$ = this.facesSubject.asObservable();

  constructor() {
    auth.onAuthStateChanged(user => {
      if (user) {
        this.initConfig(user.uid);
        this.initAlertConfig(user.uid);
        this.initDevices(user.uid);
        this.initFaces(user.uid);
      } else {
        this.configSubject.next(null);
        this.alertConfigSubject.next(null);
        this.devicesSubject.next([]);
        this.facesSubject.next([]);
      }
    });
  }

  private async initConfig(userId: string) {
    const path = `configs/${userId}`;
    try {
      const configRef = doc(db, path);
      onSnapshot(configRef, (snapshot) => {
        if (snapshot.exists()) {
          this.configSubject.next(snapshot.data() as CameraConfig);
        } else {
          // Create default config
          const defaultConfig: CameraConfig = {
            userId,
            lowPowerMode: true,
            samplingRate: 10, // Check every 10 seconds by default
            active: false,
            modelId: 'gemini-3-flash-preview',
            offlineMode: false
          };
          setDoc(configRef, defaultConfig);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private async initAlertConfig(userId: string) {
    const path = `alertConfigs/${userId}`;
    try {
      const configRef = doc(db, path);
      onSnapshot(configRef, (snapshot) => {
        if (snapshot.exists()) {
          this.alertConfigSubject.next(snapshot.data() as AlertConfig);
        } else {
          const defaultConfig: AlertConfig = {
            userId,
            email: 'nikrazif@nasadef.com.my',
            whatsapp: '+601168728510',
            enabled: true
          };
          setDoc(configRef, defaultConfig);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private async initDevices(userId: string) {
    // For simplicity, we'll just use a collection query if needed, 
    // but here we'll just mock it or use a simple list if it was a subcollection.
    // Given the rules, it's a top-level collection.
    // We'll skip the full listener for now to keep it simple, 
    // but we'll provide a way to add devices.
  }

  async updateConfig(partialConfig: Partial<CameraConfig>) {
    const user = auth.currentUser;
    if (!user) return;

    const path = `configs/${user.uid}`;
    try {
      const configRef = doc(db, path);
      await updateDoc(configRef, partialConfig);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async updateAlertConfig(partialConfig: Partial<AlertConfig>) {
    const user = auth.currentUser;
    if (!user) return;

    const path = `alertConfigs/${user.uid}`;
    try {
      const configRef = doc(db, path);
      await updateDoc(configRef, partialConfig);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async registerDevice(device: RegisteredDevice) {
    const path = `devices/${device.id}`;
    try {
      await setDoc(doc(db, path), device);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private initFaces(userId: string) {
    const path = 'recognized_faces';
    try {
      const q = query(collection(db, path), where('userId', '==', userId));
      onSnapshot(q, (snapshot) => {
        const faces = snapshot.docs.map(doc => doc.data() as RecognizedFace);
        this.facesSubject.next(faces);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async addFace(face: RecognizedFace) {
    const path = `recognized_faces/${face.id}`;
    try {
      await setDoc(doc(db, path), face);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async deleteFace(faceId: string) {
    const path = `recognized_faces/${faceId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  getConfig(): CameraConfig | null {
    return this.configSubject.value;
  }

  getAlertConfig(): AlertConfig | null {
    return this.alertConfigSubject.value;
  }
}
