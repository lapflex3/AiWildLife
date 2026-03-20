
import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { MatIconModule } from '@angular/material/icon';

import { MonitoringComponent } from './app/components/monitoring/monitoring.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { SettingsComponent } from './app/components/settings/settings.component';

type Feature = 'monitoring' | 'dashboard' | 'settings';

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
    MatIconModule
  ],
})
export class AppComponent implements OnInit {
  activeFeature = signal<Feature>('monitoring');
  user = signal<User | null>(null);

  navItems: NavItem[] = [
    { id: 'monitoring', name: 'Live Monitor', icon: 'videocam' },
    { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
    { id: 'settings', name: 'Settings', icon: 'settings' },
  ];

  ngOnInit() {
    auth.onAuthStateChanged(user => {
      this.user.set(user);
    });
  }

  async login() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login failed:', err);
    }
  }

  async logout() {
    await auth.signOut();
  }

  selectFeature(feature: Feature): void {
    this.activeFeature.set(feature);
  }
}
