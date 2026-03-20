import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { BehaviorSubject } from 'rxjs';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UsageQuota {
  userId: string;
  dailyLimit: number;
  currentUsage: number;
  lastReset: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuotaService {
  private quotaSubject = new BehaviorSubject<UsageQuota | null>(null);
  quota$ = this.quotaSubject.asObservable();

  constructor() {
    auth.onAuthStateChanged(user => {
      if (user) {
        this.initQuota(user.uid);
      } else {
        this.quotaSubject.next(null);
      }
    });
  }

  private async initQuota(userId: string) {
    const path = `quotas/${userId}`;
    try {
      const quotaRef = doc(db, path);
      onSnapshot(quotaRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UsageQuota;
          this.checkAndResetQuota(data);
        } else {
          // Create default quota
          const defaultQuota: UsageQuota = {
            userId,
            dailyLimit: 100, // Default 100 calls per day
            currentUsage: 0,
            lastReset: Date.now()
          };
          setDoc(quotaRef, defaultQuota);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private async checkAndResetQuota(quota: UsageQuota) {
    const now = new Date();
    const lastReset = new Date(quota.lastReset);
    
    // Reset if it's a new day
    if (now.toDateString() !== lastReset.toDateString()) {
      const path = `quotas/${quota.userId}`;
      try {
        const quotaRef = doc(db, path);
        await updateDoc(quotaRef, {
          currentUsage: 0,
          lastReset: Date.now()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      this.quotaSubject.next(quota);
    }
  }

  async incrementUsage(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    const quota = this.quotaSubject.value;
    if (!quota) return false;

    if (quota.currentUsage >= quota.dailyLimit) {
      return false;
    }

    const path = `quotas/${user.uid}`;
    try {
      const quotaRef = doc(db, path);
      await updateDoc(quotaRef, {
        currentUsage: quota.currentUsage + 1
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  }

  canUseAI(): boolean {
    const quota = this.quotaSubject.value;
    return !!quota && quota.currentUsage < quota.dailyLimit;
  }
}
