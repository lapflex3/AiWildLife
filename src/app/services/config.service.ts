import { Injectable, inject } from '@angular/core';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { BehaviorSubject } from 'rxjs';
import { OperationType, handleFirestoreError } from './quota.service';

export interface CameraConfig {
  userId: string;
  lowPowerMode: boolean;
  samplingRate: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSubject = new BehaviorSubject<CameraConfig | null>(null);
  config$ = this.configSubject.asObservable();

  constructor() {
    auth.onAuthStateChanged(user => {
      if (user) {
        this.initConfig(user.uid);
      } else {
        this.configSubject.next(null);
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
            active: false
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

  getConfig(): CameraConfig | null {
    return this.configSubject.value;
  }
}
