import { Component, OnInit } from '@angular/core';
import { FaqCategory } from './faq.model';
import { PublicFaqService } from '../../core/services/public-faq.service';

@Component({
  selector: 'app-faq',
  standalone: false,
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
})
export class FaqComponent implements OnInit {
  categories: FaqCategory[] = [];
  loading = true;
  loadError = false;
  searchQuery = '';

  constructor(private publicFaq: PublicFaqService) {}

  ngOnInit(): void {
    this.publicFaq.getFaqs().subscribe({
      next: ({ categories, loadFailed }) => {
        this.categories = categories;
        this.loadError = loadFailed;
        this.loading = false;
      },
    });
  }
  /** Composite key `categoryId:itemId` for accordion */
  expandedKey: string | null = null;

  get filteredCategories(): FaqCategory[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.categories;
    }
    return this.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (i) =>
            i.question.toLowerCase().includes(q) ||
            i.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }

  trackCat(_index: number, cat: FaqCategory): string {
    return cat.id;
  }

  trackItem(_index: number, item: { id: string }): string {
    return item.id;
  }

  toggle(catId: string, itemId: string): void {
    const key = `${catId}:${itemId}`;
    this.expandedKey = this.expandedKey === key ? null : key;
  }

  isOpen(catId: string, itemId: string): boolean {
    return this.expandedKey === `${catId}:${itemId}`;
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }
}
