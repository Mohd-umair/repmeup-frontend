import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

type UseCaseTab = 'support' | 'social' | 'startup' | 'enterprise';

interface UseCase {
  title: string;
  icon: string;
  transformation: string;
  points: string[];
  stat: string;
  statLabel: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  activeUseCaseTab: UseCaseTab = 'support';
  private observer?: IntersectionObserver;
  private readonly destroy$ = new Subject<void>();

  useCases: Record<UseCaseTab, UseCase> = {
    support: {
      title: 'Support Teams',
      icon: 'fas fa-headset',
      transformation: 'From ticket overload to resolved in minutes',
      points: [
        'AI automatically routes and prioritises incoming issues',
        'One unified inbox across every channel',
        'Average response time cut by 70%'
      ],
      stat: '70%',
      statLabel: 'Faster Response'
    },
    social: {
      title: 'Social Media Managers',
      icon: 'fas fa-hashtag',
      transformation: 'From comment chaos to brand control',
      points: [
        'Reply to comments & DMs across all platforms in one place',
        'AI generates on-brand replies with a single click',
        'Never miss a mention or negative comment again'
      ],
      stat: '5x',
      statLabel: 'More Coverage'
    },
    startup: {
      title: 'Startups',
      icon: 'fas fa-rocket',
      transformation: 'From overwhelmed founder to scaling team',
      points: [
        'One person manages five platforms effortlessly',
        'AI handles 80% of routine replies automatically',
        'Focus on growth — not repetitive customer replies'
      ],
      stat: '80%',
      statLabel: 'Less Manual Work'
    },
    enterprise: {
      title: 'Enterprises',
      icon: 'fas fa-building',
      transformation: 'From scattered teams to unified brand control',
      points: [
        'Role-based team access and multi-step approval workflows',
        'Compliance-ready audit trails for every reply sent',
        'Custom AI trained precisely on your brand voice'
      ],
      stat: '99%',
      statLabel: 'Brand Consistency'
    }
  };

  get useCaseTabKeys(): UseCaseTab[] {
    return Object.keys(this.useCases) as UseCaseTab[];
  }

  get activeCase(): UseCase {
    return this.useCases[this.activeUseCaseTab];
  }

  /** Leadership — home page team grid (Syed Iqbal listed last) */
  readonly teamMembers: {
    name: string;
    role: string;
    initials: string;
    avatarGradient: string;
    /** Square headshot under `src/assets/Images/` */
    imageSrc: string;
  }[] = [
    {
      name: 'Namitha Malhotra',
      role: 'CEO & Director',
      initials: 'NM',
      avatarGradient: 'from-rose-500 to-pink-600',
      imageSrc: 'assets/Images/namitha.jpeg'
    },
    {
      name: 'Mohammed Umair',
      role: 'Chief Technology Officer',
      initials: 'MU',
      avatarGradient: 'from-violet-500 to-indigo-600',
      imageSrc: 'assets/Images/umair.png'
    },
    {
      name: 'Nazish Parveen',
      role: 'Chief Business Officer',
      initials: 'NP',
      avatarGradient: 'from-amber-500 to-orange-600',
      imageSrc: 'assets/Images/nazish.jpg'
    },
    {
      name: 'Syed Iqbal',
      role: 'SME',
      initials: 'SI',
      avatarGradient: 'from-emerald-500 to-teal-600',
      imageSrc: 'assets/Images/asif.jpeg'
    }
  ];

  /** When a headshot fails to load, show initials fallback */
  teamPhotoFailed: Record<string, boolean> = {};

  constructor(private router: Router) {}

  onTeamPhotoError(memberName: string): void {
    this.teamPhotoFailed[memberName] = true;
  }

  ngOnInit(): void {
    const applyUseCaseFromUrl = (): void => {
      const uc = this.router.parseUrl(this.router.url).queryParams['uc'] as UseCaseTab | undefined;
      if (uc && this.useCases[uc]) {
        this.activeUseCaseTab = uc;
      }
    };
    applyUseCaseFromUrl();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => applyUseCaseFromUrl());
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      this.observer?.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.observer?.disconnect();
  }

  setActiveUseCaseTab(tab: UseCaseTab): void {
    this.activeUseCaseTab = tab;
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  /** Floating CTA — contact page with demo intent (query can prefill form later). */
  bookDemo(): void {
    this.router.navigate(['/contact'], { queryParams: { intent: 'book-demo' } });
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
