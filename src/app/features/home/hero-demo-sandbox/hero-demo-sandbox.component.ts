import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

type DemoState = 'idle' | 'customer_typing' | 'customer_sent' | 'ai_processing' | 'ai_replied';
type PlatformTab = 'instagram' | 'whatsapp';

interface DemoScenario {
  customerName: string;
  customerInitial: string;
  avatarGradient: string;
  customerMessage: string;
  aiReply: string;
}

interface QuickChip {
  label: string;
  message: string;
}

const INSTAGRAM_SCENARIOS: DemoScenario[] = [
  {
    customerName: 'Priya S.',
    customerInitial: 'P',
    avatarGradient: 'from-pink-500 to-purple-600',
    customerMessage: 'When will you restock the blue variant? 💙',
    aiReply: 'Hi Priya! 🛍️ The blue variant is back this Friday. Want a DM the moment it\'s live? Just say yes!'
  },
  {
    customerName: 'Arjun M.',
    customerInitial: 'A',
    avatarGradient: 'from-orange-400 to-pink-500',
    customerMessage: 'Do you ship to Hyderabad?',
    aiReply: 'Hey Arjun! 👋 Yes, we deliver pan-India. Hyderabad orders get free shipping above ₹499 🎉'
  },
  {
    customerName: 'Riya K.',
    customerInitial: 'R',
    avatarGradient: 'from-violet-500 to-purple-700',
    customerMessage: 'Is the fabric good quality? Asking before I order.',
    aiReply: 'Absolutely Riya! Our cotton blend is OEKO-TEX certified and loved by 2,000+ customers ⭐ You can return it free if you\'re not happy!'
  }
];

const WHATSAPP_SCENARIOS: DemoScenario[] = [
  {
    customerName: 'Neha R.',
    customerInitial: 'N',
    avatarGradient: 'from-green-400 to-teal-500',
    customerMessage: 'Hi, I want to order the red kurta 🙏',
    aiReply: 'Hello Neha! 🙏 Great choice. The red kurta is ₹1,299 with free delivery. Here\'s your checkout: bit.ly/rm-red ✅ Order in the next 2 hrs for same-day dispatch!'
  },
  {
    customerName: 'Rahul D.',
    customerInitial: 'R',
    avatarGradient: 'from-blue-400 to-cyan-500',
    customerMessage: 'My order #4521 hasn\'t arrived yet, it\'s been 4 days',
    aiReply: 'Hi Rahul! Checked order #4521 🔍 — it\'s out for delivery today, arriving by 6 PM. Track here: bit.ly/track-4521. Sorry for the wait!'
  },
  {
    customerName: 'Sneha V.',
    customerInitial: 'S',
    avatarGradient: 'from-yellow-400 to-orange-500',
    customerMessage: 'Do you have this in size L? Almost out of stock I think',
    aiReply: 'Yes Sneha! Size L is available ✅ Only 3 left. Want me to reserve one? Confirm here and I\'ll send the payment link right away!'
  }
];

const QUICK_CHIPS: QuickChip[] = [
  { label: 'Delivery time?', message: 'How long does delivery take?' },
  { label: 'Return policy?', message: 'What is your return policy?' },
  { label: 'Restock date?', message: 'When will you restock?' },
  { label: 'Custom order?', message: 'Do you take custom orders?' }
];

function getAiReplyForInput(input: string): string {
  const lower = input.toLowerCase();
  if (/ship|deliver|courier|dispatch/.test(lower)) {
    return 'We ship pan-India! 🚚 Standard delivery takes 3–5 working days. Free shipping on orders above ₹499. Express options available at checkout.';
  }
  if (/price|cost|₹|how much|rate/.test(lower)) {
    return 'Our prices range from ₹499 to ₹2,499 depending on the product 💰 Check out our full catalog at shop.repmeup.in — we\'re running 20% off this week!';
  }
  if (/size|stock|restock|available|availability/.test(lower)) {
    return 'Great question! Most sizes are in stock right now ✅ Head to our catalog to check your size. Low-stock items are marked — order fast!';
  }
  if (/return|refund|exchange/.test(lower)) {
    return 'We offer hassle-free 7-day returns 🔄 Just reply "RETURN" with your order number and we\'ll arrange a free pickup within 24 hours!';
  }
  if (/custom|personalise|personalize/.test(lower)) {
    return 'Yes, we do custom orders! 🎨 Share the design you have in mind and we\'ll get back with a quote within 2 hours. We love one-of-a-kinds!';
  }
  return 'Thanks for your message! 😊 Our AI is on it — you\'ll have a full response within 12 seconds. We\'re here 24/7 for you!';
}

@Component({
  selector: 'app-hero-demo-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule, AiChatBubbleIconComponent],
  templateUrl: './hero-demo-sandbox.component.html',
  styleUrls: ['./hero-demo-sandbox.component.scss']
})
export class HeroDemoSandboxComponent implements OnInit, OnDestroy {

  activeTab: PlatformTab = 'instagram';
  state: DemoState = 'idle';

  currentScenarioIndex = 0;
  currentScenario: DemoScenario = INSTAGRAM_SCENARIOS[0];

  /** Full AI text for current scenario; typewriter writes into displayedAiText */
  private fullAiText = '';
  displayedAiText = '';
  private typewriterCharIndex = 0;

  /** User-supplied free-input message */
  userInput = '';
  /** Message showing in the chat bubble when user tries */
  userTriedMessage = '';
  /** Whether the try-it input is active (pauses auto-loop) */
  userIsTyping = false;

  readonly quickChips = QUICK_CHIPS;

  /** Whether the page tab is hidden (visibility API) */
  private pageHidden = false;

  /** All pending timer handles — cleared on destroy */
  private timers: ReturnType<typeof setTimeout>[] = [];
  private typewriterHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {}

  ngOnInit(): void {
    this.scheduleTimer(() => this.startNextScenario(), 800);
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.pageHidden = document.hidden;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  switchTab(tab: PlatformTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.clearAllTimers();
    this.currentScenarioIndex = 0;
    this.userInput = '';
    this.userTriedMessage = '';
    this.userIsTyping = false;
    this.state = 'idle';
    this.scheduleTimer(() => this.startNextScenario(), 400);
  }

  onQuickChip(chip: QuickChip): void {
    this.userInput = chip.message;
    this.submitUserInput();
  }

  submitUserInput(): void {
    const msg = this.userInput.trim();
    if (!msg) return;
    this.clearAllTimers();
    this.userIsTyping = false;
    this.userTriedMessage = msg;
    this.userInput = '';
    this.state = 'customer_sent';
    this.scheduleTimer(() => {
      this.state = 'ai_processing';
      this.scheduleTimer(() => {
        this.fullAiText = getAiReplyForInput(msg);
        this.startTypewriter(() => {
          // After showing user-triggered reply, resume auto-loop after 4s
          this.scheduleTimer(() => this.startNextScenario(), 4000);
        });
      }, 1200);
    }, 500);
  }

  onInputFocus(): void {
    this.userIsTyping = true;
    this.clearAllTimers();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.submitUserInput();
    }
  }

  get scenarios(): DemoScenario[] {
    return this.activeTab === 'instagram' ? INSTAGRAM_SCENARIOS : WHATSAPP_SCENARIOS;
  }

  get platformIcon(): string {
    return this.activeTab === 'instagram' ? 'fab fa-instagram' : 'fab fa-whatsapp';
  }

  get platformColor(): string {
    return this.activeTab === 'instagram' ? 'text-pink-400' : 'text-green-400';
  }

  get platformLabel(): string {
    return this.activeTab === 'instagram' ? 'Instagram DM' : 'WhatsApp';
  }

  get platformBadgeStyle(): string {
    return this.activeTab === 'instagram'
      ? 'background:rgba(236,72,153,0.12); color:#f472b6'
      : 'background:rgba(34,197,94,0.12); color:#4ade80';
  }

  get isProcessing(): boolean {
    return this.state === 'ai_processing';
  }

  get showCustomerMessage(): boolean {
    return this.state === 'customer_sent' || this.state === 'ai_processing' || this.state === 'ai_replied';
  }

  get showUserMessage(): boolean {
    return !!this.userTriedMessage && (this.state === 'customer_sent' || this.state === 'ai_processing' || this.state === 'ai_replied');
  }

  get showAiReply(): boolean {
    return this.state === 'ai_replied' && this.displayedAiText.length > 0;
  }

  get showTypingIndicator(): boolean {
    return this.state === 'customer_typing' || this.state === 'ai_processing';
  }

  get aiTypingIsCustomer(): boolean {
    return this.state === 'customer_typing';
  }

  get displayMessage(): string {
    return this.userTriedMessage || this.currentScenario.customerMessage;
  }

  get displayCustomerName(): string {
    return this.userTriedMessage ? 'You' : this.currentScenario.customerName;
  }

  get displayCustomerInitial(): string {
    return this.userTriedMessage ? 'Y' : this.currentScenario.customerInitial;
  }

  get displayAvatarGradient(): string {
    return this.userTriedMessage ? 'from-rep-lime to-lime-400' : this.currentScenario.avatarGradient;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private startNextScenario(): void {
    if (this.pageHidden || this.userIsTyping) return;
    this.userTriedMessage = '';
    this.displayedAiText = '';
    this.typewriterCharIndex = 0;
    const scens = this.scenarios;
    this.currentScenario = scens[this.currentScenarioIndex % scens.length];
    this.currentScenarioIndex = (this.currentScenarioIndex + 1) % scens.length;

    this.state = 'customer_typing';

    // Customer finishes typing
    this.scheduleTimer(() => {
      this.state = 'customer_sent';
      // Short pause then AI starts processing
      this.scheduleTimer(() => {
        this.state = 'ai_processing';
        // Simulate AI thinking, then start typewriter
        this.scheduleTimer(() => {
          this.fullAiText = this.currentScenario.aiReply;
          this.startTypewriter(() => {
            // Pause on completed reply, then go to next scenario
            this.scheduleTimer(() => this.startNextScenario(), 3500);
          });
        }, 1400);
      }, 600);
    }, 1600);
  }

  private startTypewriter(onComplete: () => void): void {
    this.state = 'ai_replied';
    this.displayedAiText = '';
    this.typewriterCharIndex = 0;

    if (this.typewriterHandle !== null) {
      clearInterval(this.typewriterHandle);
      this.typewriterHandle = null;
    }

    this.typewriterHandle = setInterval(() => {
      if (this.typewriterCharIndex < this.fullAiText.length) {
        // Advance by 2 chars per tick for snappier feel
        this.typewriterCharIndex = Math.min(this.typewriterCharIndex + 2, this.fullAiText.length);
        this.displayedAiText = this.fullAiText.slice(0, this.typewriterCharIndex);
      } else {
        clearInterval(this.typewriterHandle!);
        this.typewriterHandle = null;
        onComplete();
      }
    }, 28);
  }

  private scheduleTimer(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.timers = this.timers.filter(t => t !== handle);
      fn();
    }, ms);
    this.timers.push(handle);
  }

  private clearAllTimers(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    if (this.typewriterHandle !== null) {
      clearInterval(this.typewriterHandle);
      this.typewriterHandle = null;
    }
  }
}
