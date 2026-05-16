import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Voice IVR shell — hosts the tabbed sub-routes (dashboard, agents, calls, settings).
 */
@Component({
  selector: 'app-voice-ivr',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './voice-ivr.component.html',
  styleUrls: ['./voice-ivr.component.scss']
})
export class VoiceIvrComponent {
  readonly tabs = [
    { route: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
    { route: 'agents', label: 'Voice Agents', icon: 'fas fa-robot' },
    { route: 'calls', label: 'Call Logs', icon: 'fas fa-phone-volume' },
    { route: 'settings', label: 'Settings', icon: 'fas fa-cog' }
  ];
}
