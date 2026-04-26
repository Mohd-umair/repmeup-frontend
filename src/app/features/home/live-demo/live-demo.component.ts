import {
  Component,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  time: string;
}

interface DemoPrompt {
  label: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-live-demo',
  standalone: true,
  imports: [CommonModule, RouterLink, AiChatBubbleIconComponent],
  templateUrl: './live-demo.component.html',
  styleUrls: ['./live-demo.component.scss'],

})
export class LiveDemoComponent implements OnDestroy {
  @ViewChild('chatThread') private chatThread?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [
    {
      from: 'bot',
      text: 'Hi there! 👋 I\'m the RepMeUp AI. Ask me anything about your business.',
      time: this.now(),
    },
  ];

  isTyping = false;
  activePromptIndex: number | null = null;
  private typingTimer?: ReturnType<typeof setTimeout>;

  readonly prompts: DemoPrompt[] = [
    {
      label: 'What can RepMeUp do?',
      question: 'What features does RepMeUp offer?',
      answer:
        'RepMeUp covers your full conversation funnel 🚀\n• Unified inbox (IG, WhatsApp, Google)\n• AI replies in your brand voice\n• Lead capture + qualification\n• Cart recovery & COD flows\n• Review & CSAT automation\n\nWant to know more about any specific feature?',
    },
    {
      label: 'How does AI auto-reply work?',
      question: 'How does the AI auto-reply work?',
      answer:
        'You train it once, it replies forever ⚡\n\n1. Connect your channels\n2. Upload your catalog + FAQs\n3. Set your tone and guardrails\n\nThe AI reads every message, understands intent, and sends a brand-matched reply in seconds — or escalates to your team if needed.',
    },
    {
      label: 'Is there a free trial?',
      question: 'Is there a free trial available?',
      answer:
        'Yes! You get a 7-day free trial with full access — no credit card required.\n\nYou can connect your channels, invite your team, and see real results before you pay a rupee. 🎉',
    },
    {
      label: 'Can I integrate WhatsApp?',
      question: 'Can I integrate it with WhatsApp?',
      answer:
        'Absolutely ✅ RepMeUp works with:\n• WhatsApp Business API\n• Instagram DMs\n• Google Business Messages\n\nSetup takes under 15 minutes. No developers needed — just connect and go.',
    },
    {
      label: 'How fast are responses?',
      question: 'How fast does RepMeUp respond to customers?',
      answer:
        'Average first response: 12 seconds ⚡\n\nWhile your team sleeps, your customers get instant, on-brand replies. That\'s the difference between a lost lead and a closed sale.',
    },
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  tryPrompt(prompt: DemoPrompt, index: number): void {
    if (this.isTyping) return;

    this.activePromptIndex = index;
    this.messages = [
      ...this.messages,
      { from: 'user', text: prompt.question, time: this.now() },
    ];
    this.isTyping = true;
    this.cdr.markForCheck();
    this.queueScrollThreadToEnd();

    this.typingTimer = setTimeout(() => {
      this.isTyping = false;
      this.messages = [
        ...this.messages,
        { from: 'bot', text: prompt.answer, time: this.now() },
      ];
      this.cdr.markForCheck();
      this.queueScrollThreadToEnd();
    }, 1400);
  }

  clearChat(): void {
    clearTimeout(this.typingTimer);
    this.isTyping = false;
    this.activePromptIndex = null;
    this.messages = [
      {
        from: 'bot',
        text: 'Hi there! 👋 I\'m the RepMeUp AI. Ask me anything about your business.',
        time: this.now(),
      },
    ];
    this.cdr.markForCheck();
    this.queueScrollThreadToEnd();
  }

  private queueScrollThreadToEnd(): void {
    setTimeout(() => {
      const el = this.chatThread?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  trackByIndex(_: number, __: unknown): number {
    return _;
  }

  ngOnDestroy(): void {
    clearTimeout(this.typingTimer);
  }

  private now(): string {
    return new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
