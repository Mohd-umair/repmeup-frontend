import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { HeroDemoSandboxComponent } from './hero-demo-sandbox/hero-demo-sandbox.component';

type UseCaseTab = 'd2c' | 'creator' | 'fnb' | 'fashion';

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
  imports: [CommonModule, RouterLink, HeroDemoSandboxComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  activeUseCaseTab: UseCaseTab = 'd2c';
  private observer?: IntersectionObserver;
  private readonly destroy$ = new Subject<void>();

  useCases: Record<UseCaseTab, UseCase> = {
    d2c: {
      title: 'D2C Brands',
      icon: 'fas fa-shopping-cart',
      transformation: 'Turn your Instagram into a 24/7 storefront',
      points: [
        'Catalog-aware AI recommends the right SKU based on size, skin type, occasion',
        'WhatsApp commerce: close orders without leaving the chat',
        'RTO reduction: auto-confirm COD orders before shipping'
      ],
      stat: '3.2×',
      statLabel: 'DM-to-sale conversion lift'
    },
    creator: {
      title: 'Creators',
      icon: 'fas fa-star',
      transformation: 'Stop losing brand deals to slow DM replies',
      points: [
        'Brand collab triage: AI auto-routes paid pitches vs. fan messages vs. spam',
        'Auto-replies in your voice: trained on your tone, slang, and emoji style',
        'Fan engagement at scale: respond to every DM, even at 100K followers'
      ],
      stat: '4.2×',
      statLabel: 'brand deals closed per month'
    },
    fnb: {
      title: 'F&B & Restaurants',
      icon: 'fas fa-utensils',
      transformation: 'From 3.9 to 4.7 stars on Google in 90 days',
      points: [
        'Auto-collect Google reviews on autopilot via WhatsApp',
        'Negative reviews caught privately before they hit Google',
        'AI-drafted review replies within minutes — in your brand voice'
      ],
      stat: '4.7★',
      statLabel: 'avg Google rating in 90 days'
    },
    fashion: {
      title: 'Fashion & Beauty',
      icon: 'fas fa-tshirt',
      transformation: 'Close more carts with WhatsApp commerce',
      points: [
        'Smart cart recovery: 4-touch sequence in your brand voice',
        '4-touch: 15min nudge → 2hr discount → 24hr final reminder',
        'One-tap checkout with Razorpay, Cashfree, and PayU integration'
      ],
      stat: '31%',
      statLabel: 'cart abandonment recovered'
    }
  };

  get useCaseTabKeys(): UseCaseTab[] {
    return Object.keys(this.useCases) as UseCaseTab[];
  }

  get activeCase(): UseCase {
    return this.useCases[this.activeUseCaseTab];
  }

  /** Leadership — home page team grid */
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
    /*
    {
      name: 'Mohammed Umair',
      role: 'Chief Technology Officer',
      initials: 'MU',
      avatarGradient: 'from-violet-500 to-indigo-600',
      imageSrc: 'assets/Images/umair.png'
    },
    */
    {
      name: 'Nazish Parveen',
      role: 'Chief Business Officer',
      initials: 'NP',
      avatarGradient: 'from-amber-500 to-orange-600',
      imageSrc: 'assets/Images/nazish.jpg'
    },
    /*
    {
      name: 'Syed Iqbal',
      role: 'SME',
      initials: 'SI',
      avatarGradient: 'from-emerald-500 to-teal-600',
      imageSrc: 'assets/Images/asif.jpeg'
    }
    */
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
