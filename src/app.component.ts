
import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { MatIconModule } from '@angular/material/icon';

import { MonitoringComponent } from './app/components/monitoring/monitoring.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { SettingsComponent } from './app/components/settings/settings.component';
import { CalibrationComponent } from './app/components/calibration/calibration.component';
import { GeminiService } from './gemini.service';

type Feature = 'monitoring' | 'dashboard' | 'settings' | 'calibration';

interface NavItem {
  id: Feature;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MonitoringComponent,
    DashboardComponent,
    SettingsComponent,
    CalibrationComponent,
    MatIconModule
  ],
})
export class AppComponent implements OnInit {
  private geminiService = inject(GeminiService);
  activeFeature = signal<Feature>('monitoring');
  user = signal<User | null>(null);
  isLoggingIn = signal<boolean>(false);
  loginError = signal<string | null>(null);

  navItems: NavItem[] = [
    { id: 'monitoring', name: 'Live Monitor', icon: 'videocam' },
    { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
    { id: 'settings', name: 'Settings', icon: 'settings' },
  ];

  ngOnInit() {
    this.geminiService.testConnection();
    auth.onAuthStateChanged(user => {
      this.user.set(user);
      if (user) {
        this.isLoggingIn.set(false);
        this.loginError.set(null);
      }
    });
  }

  async login() {
    if (this.isLoggingIn()) return;
    
    this.isLoggingIn.set(true);
    this.loginError.set(null);
    
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login failed:', err);
      this.isLoggingIn.set(false);
      
      if (err.code === 'auth/popup-blocked') {
        this.loginError.set('Popup blocked. Please allow popups for this site and try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        this.loginError.set('Login request was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        this.loginError.set('Login window was closed before completion.');
      } else {
        this.loginError.set('Login failed. Please check your connection and try again.');
      }
    }
  }

  async logout() {
    await auth.signOut();
  }

  selectFeature(feature: Feature): void {
    this.activeFeature.set(feature);
  }
}
