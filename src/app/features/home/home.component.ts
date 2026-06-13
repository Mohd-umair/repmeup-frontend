import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { HeroDemoSandboxComponent } from './hero-demo-sandbox/hero-demo-sandbox.component';
import { LifecycleStage, LifecycleStageData } from './lifecycle-stage.models';
import { LifecycleStageVisualComponent } from './lifecycle-stage-visual/lifecycle-stage-visual.component';
import { LiveDemoComponent } from './live-demo/live-demo.component';
import { AiChatBubbleIconComponent } from '../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

type UseCaseTab = 'd2c' | 'creator' | 'fnb' | 'fashion';

interface UseCase {
  title: string;
  icon: string;
  transformation: string;
  points: string[];
  stat: string;
  statLabel: string;
}

export type IndustryTab = 'd2c' | 'edtech' | 'bfsi' | 'realestate' | 'travel' | 'professional';

export interface IndustryChannel {
  icon: string;  // Font Awesome class
  color: string; // Tailwind text color
}

export interface IndustryChat {
  from: 'customer' | 'bot';
  text: string;
  time?: string;
  tag?: string;  // optional label like "Order Confirmed"
}

export interface IndustryCard {
  id: IndustryTab;
  label: string;
  icon: string;
  accentFrom: string;
  accentTo: string;
  botName: string;
  stat: string;
  statLabel: string;
  /** One-line outcome for the spotlight panel (shown next to hero image). */
  summary: string;
  /** Unsplash (or CDN) — single human- / scene-focused photo for the industry */
  imageUrl: string;
  imageAlt: string;
  channels: IndustryChannel[];
  chat: IndustryChat[];
}

interface OnboardingStep {
  n: number;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, HeroDemoSandboxComponent, LifecycleStageVisualComponent, LiveDemoComponent, AiChatBubbleIconComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  activeUseCaseTab: UseCaseTab = 'd2c';
  activeLifecycleTab: LifecycleStage = 'acquire';
  activeIndustryTab: IndustryTab = 'd2c';

  readonly industryCards: IndustryCard[] = [
    {
      id: 'd2c',
      label: 'D2C Brands',
      icon: 'fas fa-bag-shopping',
      accentFrom: '#bcef4a',
      accentTo: '#84cc16',
      botName: 'RepMeUp AI',
      stat: '+47%',
      statLabel: 'DM-to-cart',
      summary:
        'Comment-to-cart flows, size and COD questions, and urgency that fits how shoppers browse Instagram and WhatsApp.',
      imageUrl:
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&h=750&fit=crop&crop=faces&f=auto&q=85',
      imageAlt: 'Woman with shopping bags in a city — retail and D2C',
      channels: [
        { icon: 'fab fa-instagram', color: 'text-pink-500' },
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fab fa-facebook', color: 'text-blue-500' },
      ],
      chat: [
        { from: 'customer', text: 'Hi! Is this available in size M? 👀', time: '10:32 AM' },
        { from: 'bot', text: 'Yes! Available in M, L & XL. 🛍️ Price is ₹1,299.\nWould you like the checkout link?', time: '10:32 AM' },
        { from: 'customer', text: 'Yes please! COD available?', time: '10:33 AM' },
        { from: 'bot', text: '✅ COD available! Here is your checkout link → rep.me/order/xyz\n🎉 Order confirmed!', time: '10:33 AM', tag: 'Order Confirmed' },
      ]
    },
    {
      id: 'edtech',
      label: 'Edtech & Courses',
      icon: 'fas fa-graduation-cap',
      accentFrom: '#818cf8',
      accentTo: '#6366f1',
      botName: 'Course Bot',
      stat: '3×',
      statLabel: 'Enrollment rate',
      summary:
        'Syllabus-aware answers, fee and discount handling, and enrollment nudges in the same tone as your brand.',
      imageUrl:
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=750&fit=crop&crop=faces&f=auto&q=85',
      imageAlt: 'People learning together with laptops — online courses and edtech',
      channels: [
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fab fa-instagram', color: 'text-pink-500' },
        { icon: 'fab fa-telegram', color: 'text-sky-500' },
      ],
      chat: [
        { from: 'customer', text: 'What\'s included in the Python course?', time: '2:14 PM' },
        { from: 'bot', text: '🎓 Python Pro includes:\n✔️ 40+ Lessons\n✔️ Projects\n✔️ Certificate\n✔️ Lifetime Access', time: '2:14 PM' },
        { from: 'customer', text: 'Price? Any discount?', time: '2:15 PM' },
        { from: 'bot', text: '💰 ₹2,999 (was ₹5,999). Offer ends tonight!\n👉 Enroll now: rep.me/python-pro', time: '2:15 PM', tag: 'Enrolled' },
      ]
    },
    {
      id: 'bfsi',
      label: 'BFSI',
      icon: 'fas fa-landmark',
      accentFrom: '#38bdf8',
      accentTo: '#0ea5e9',
      botName: 'Banking Bot',
      stat: '60%',
      statLabel: 'Lead qualification',
      summary:
        'Trust-first language, eligibility triage, and advisor handoff without losing context across WhatsApp and email.',
      imageUrl:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&h=750&fit=crop&f=auto&q=85',
      imageAlt: 'Financial advisor in a suit — banking and BFSI',
      channels: [
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fas fa-envelope', color: 'text-blue-400' },
        { icon: 'fas fa-mobile-screen', color: 'text-sky-500' },
      ],
      chat: [
        { from: 'customer', text: 'Hi! I\'d like to know my loan eligibility.', time: '11:05 AM' },
        { from: 'bot', text: 'Sure! Based on your details, you may be eligible for up to ₹25,00,000. 🏦\nWould you like to schedule a call?', time: '11:05 AM' },
        { from: 'customer', text: 'Yes, schedule a call for tomorrow.', time: '11:06 AM' },
        { from: 'bot', text: '📅 Call scheduled for tomorrow 10 AM.\nOur advisor will contact you shortly!', time: '11:06 AM', tag: 'Call Scheduled' },
      ]
    },
    {
      id: 'realestate',
      label: 'Real Estate',
      icon: 'fas fa-house',
      accentFrom: '#34d399',
      accentTo: '#10b981',
      botName: 'Property AI',
      stat: '2×',
      statLabel: 'Site visits booked',
      summary:
        'Inventory Q&A, brochure follow-ups, and site-visit booking where buyers already ask questions—on chat.',
      imageUrl:
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=750&fit=crop&f=auto&q=85',
      imageAlt: 'Modern home exterior — real estate and property',
      channels: [
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fas fa-phone', color: 'text-emerald-400' },
        { icon: 'fab fa-instagram', color: 'text-pink-500' },
      ],
      chat: [
        { from: 'customer', text: 'Is 3BHK available in your new phase?', time: '3:20 PM' },
        { from: 'bot', text: 'Yes! 3BHK is available. Starting from ₹80.99L.\nHere are our top floor plans 🏡', time: '3:20 PM' },
        { from: 'customer', text: 'Can we schedule a site visit?', time: '3:21 PM' },
        { from: 'bot', text: '✅ Site visit booked for Saturday 11 AM!\nAddress sent to your WhatsApp.', time: '3:21 PM', tag: 'Site Visit Booked' },
      ]
    },
    {
      id: 'travel',
      label: 'Travel',
      icon: 'fas fa-plane',
      accentFrom: '#f472b6',
      accentTo: '#ec4899',
      botName: 'Travel Bot',
      stat: '38%',
      statLabel: 'Booking conversion',
      summary:
        'Package-fit questions, dates, travellers count, and payment links—recovery for browse abandonment in-season.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=750&fit=crop&f=auto&q=85',
      imageAlt: 'Tropical beach and ocean — travel and holidays',
      channels: [
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fab fa-instagram', color: 'text-pink-500' },
        { icon: 'fas fa-globe', color: 'text-sky-400' },
      ],
      chat: [
        { from: 'customer', text: 'Best packages for Maldives?', time: '5:45 PM' },
        { from: 'bot', text: '✈️ Maldives Gateway — 5N/6D\n₹42,999/person\nIncludes: Flight + Villa + Meals 🌴', time: '5:45 PM' },
        { from: 'customer', text: 'Book for 2 adults, Dec 15', time: '5:46 PM' },
        { from: 'bot', text: '🎉 Booking confirmed for 2 adults, Dec 15!\nPayment link: rep.me/travel/maldives', time: '5:46 PM', tag: 'Booking Confirmed' },
      ]
    },
    {
      id: 'professional',
      label: 'Professional Services',
      icon: 'fas fa-briefcase',
      accentFrom: '#fb923c',
      accentTo: '#f97316',
      botName: 'Service Bot',
      stat: '45%',
      statLabel: 'Appointments booked',
      summary:
        'Calendar-ready booking, intake questions, and reminders on the channels professionals already rely on.',
      imageUrl:
        'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=750&fit=crop&f=auto&q=85',
      imageAlt: 'Two professionals shaking hands — consulting, legal, and client services',
      channels: [
        { icon: 'fab fa-whatsapp', color: 'text-green-500' },
        { icon: 'fab fa-instagram', color: 'text-pink-500' },
        { icon: 'fas fa-star', color: 'text-amber-400' },
      ],
      chat: [
        { from: 'customer', text: 'Do you have appointments tomorrow?', time: '9:10 AM' },
        { from: 'bot', text: 'Yes! We have slots available:\n🕙 10 AM · 1 PM · 4 PM\nWhich time works for you?', time: '9:10 AM' },
        { from: 'customer', text: '1 PM please', time: '9:11 AM' },
        { from: 'bot', text: '✅ Appointment confirmed for 1 PM tomorrow!\nReminder will be sent 1 hour before.', time: '9:11 AM', tag: 'Appointment Confirmed' },
      ]
    },
  ];

  /** Get Started — step titles & copy aligned with repmeup.html */
  readonly onboardingSteps: OnboardingStep[] = [
    { n: 1, title: 'Sign Up', description: 'Create your account in seconds.' },
    { n: 2, title: 'Connect Channels', description: 'Add your channels and import contacts.' },
    { n: 3, title: 'Set Up AI', description: 'Customize AI, workflows and quick replies.' },
    { n: 4, title: 'Start Growing', description: 'Go live and turn conversations into customers.' },
  ];

  get activeIndustry(): IndustryCard {
    return this.industryCards.find(c => c.id === this.activeIndustryTab) ?? this.industryCards[0];
  }

  setActiveIndustryTab(tab: IndustryTab): void {
    this.activeIndustryTab = tab;
  }
  private observer?: IntersectionObserver;
  private readonly destroy$ = new Subject<void>();

  lifecycle: Record<LifecycleStage, LifecycleStageData> = {
    acquire: {
      label: 'Acquire',
      icon: 'fas fa-bullseye',
      title: 'Acquire leads',
      summary: 'Capture high-intent leads from every conversation across all your channels.',
      features: [
        {
          title: 'Comment-to-DM automation',
          description: 'Auto-reply to comments with links, offers and lead capture.'
        },
        {
          title: 'Smart lead qualification',
          description: 'Reppy understands intent and prioritises high-value leads.'
        },
        {
          title: 'Lead data enrichment',
          description: 'Automatically capture customer details and preferences.'
        }
      ],
      highlightStat: '3.2×',
      highlightLabel: 'more qualified leads captured'
    },
    convert: {
      label: 'Convert',
      icon: 'fas fa-comments-dollar',
      title: 'Convert sales',
      summary:
        'Close conversations and recover more carts with WhatsApp flows, COD confirmations, and payment nudges.',
      features: [
        {
          title: 'WhatsApp checkout flows',
          description: 'Share cart links and complete purchases inside WhatsApp.'
        },
        {
          title: 'COD confirmation',
          description: 'Reduce RTO with automated order confirmation flows.'
        },
        {
          title: 'Abandoned cart recovery',
          description: 'Recover 31% more carts with timely, on-brand follow-ups.'
        }
      ],
      highlightStat: '31%',
      highlightLabel: 'cart abandonment recovered'
    },
    support: {
      label: 'Support',
      icon: 'fas fa-headset',
      title: 'Support customers',
      summary:
        'Unified inbox, AI replies, and human handoff — resolve faster with the right blend of automation and empathy.',
      features: [
        {
          title: 'Unified inbox',
          description: 'All channels in one place — no more tab switching.'
        },
        {
          title: 'Reppy + human handoff',
          description: 'Reppy handles routine queries and escalates complex ones.'
        },
        {
          title: 'Faster response',
          description: 'Resolve tickets before customers get frustrated.'
        }
      ],
      highlightStat: '65%',
      highlightLabel: 'faster ticket resolution'
    },
    retain: {
      label: 'Retain',
      icon: 'fas fa-star',
      title: 'Retain & delight',
      summary:
        'Build loyalty through reviews, CSAT, and feedback automation — resolve issues before they go public.',
      features: [
        {
          title: 'Review automation',
          description: 'Trigger review requests at the perfect moment post-delivery.'
        },
        {
          title: 'CSAT surveys',
          description: 'Measure satisfaction with instant WhatsApp feedback flows.'
        },
        {
          title: 'Loyalty triggers',
          description: 'Reward repeat buyers with personalised offers, automatically.'
        }
      ],
      highlightStat: '4.7★',
      highlightLabel: 'avg Google rating in 90 days'
    },
    repeat: {
      label: 'Repeat',
      icon: 'fas fa-rotate',
      title: 'Drive repeat sales',
      summary:
        'Win back customers with smart journeys, personalised offers, and loyalty automation that grows LTV.',
      features: [
        {
          title: 'Winback journeys',
          description: 'Re-engage dormant customers with personalised campaigns.'
        },
        {
          title: 'Upsell & cross-sell',
          description: 'Smart product recommendations based on past purchases.'
        },
        {
          title: 'Repeat revenue engine',
          description: 'Turn one-time buyers into regulars with automated triggers.'
        }
      ],
      highlightStat: '2.4×',
      highlightLabel: 'repeat purchase rate'
    }
  };

  get lifecycleTabKeys(): LifecycleStage[] {
    return Object.keys(this.lifecycle) as LifecycleStage[];
  }

  get activeLifecycleStage(): LifecycleStageData {
    return this.lifecycle[this.activeLifecycleTab];
  }

  setActiveLifecycleTab(tab: LifecycleStage): void {
    this.activeLifecycleTab = tab;
  }

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
        'Brand collab triage: Reppy auto-routes paid pitches vs. fan messages vs. spam',
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

  constructor(private router: Router) {}

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
    this.router.navigate(['/book-demo']);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
