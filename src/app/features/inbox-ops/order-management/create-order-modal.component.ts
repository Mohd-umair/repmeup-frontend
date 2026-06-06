import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IProduct } from '../../../core/models/product.model';
import { IOpsOrderDetail, ICreateOrderLineItem } from '../../../core/models/inbox-ops.model';

interface ILineItemDraft {
  product: IProduct;
  qty: number;
}

@Component({
  selector: 'app-create-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-order-modal.component.html',
  styleUrls: ['./create-order-modal.component.scss']
})
export class CreateOrderModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<IOpsOrderDetail>();

  private destroy$ = new Subject<void>();
  private productSearch$ = new Subject<string>();

  // Form fields
  channel: 'whatsapp' | 'instagram' | 'voice' | 'manual' = 'manual';
  buyerName = '';
  buyerPhone = '';
  shippingAddress = '';
  notes = '';

  // Product search
  productQuery = '';
  productResults: IProduct[] = [];
  productSearchLoading = false;
  showProductDropdown = false;

  // Line items
  lineItems: ILineItemDraft[] = [];

  // Submission
  submitting = false;

  readonly channels = [
    { value: 'manual' as const,    label: 'Manual',    icon: 'fas fa-user-edit' },
    { value: 'whatsapp' as const,  label: 'WhatsApp',  icon: 'fab fa-whatsapp' },
    { value: 'instagram' as const, label: 'Instagram', icon: 'fab fa-instagram' },
    { value: 'voice' as const,     label: 'Voice',     icon: 'fas fa-phone-alt' }
  ];

  constructor(
    private ops: InboxOpsService,
    private catalog: CatalogService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.productSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => this.fetchProducts(q));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onProductQueryChange(q: string): void {
    this.productQuery = q;
    if (q.trim().length >= 1) {
      this.showProductDropdown = true;
      this.productSearch$.next(q.trim());
    } else {
      this.productResults = [];
      this.showProductDropdown = false;
    }
  }

  private fetchProducts(q: string): void {
    this.productSearchLoading = true;
    this.catalog
      .getProducts({ search: q, isActive: true, limit: 12 })
      .pipe(finalize(() => (this.productSearchLoading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.productResults = r.data?.products ?? [];
          this.showProductDropdown = true;
        },
        error: () => { this.productResults = []; }
      });
  }

  addProduct(product: IProduct): void {
    const existing = this.lineItems.find((li) => li.product._id === product._id);
    if (existing) {
      existing.qty++;
    } else {
      this.lineItems.push({ product, qty: 1 });
    }
    this.productQuery = '';
    this.productResults = [];
    this.showProductDropdown = false;
  }

  removeItem(index: number): void {
    this.lineItems.splice(index, 1);
  }

  incrementQty(item: ILineItemDraft): void {
    item.qty++;
  }

  decrementQty(item: ILineItemDraft): void {
    if (item.qty > 1) item.qty--;
  }

  get orderTotal(): number {
    return this.lineItems.reduce((sum, li) => {
      const price = li.product.discountPercent
        ? li.product.price * (1 - li.product.discountPercent / 100)
        : li.product.price;
      return sum + price * li.qty;
    }, 0);
  }

  get orderCurrency(): string {
    return this.lineItems[0]?.product.currency || 'INR';
  }

  formatPrice(product: IProduct): string {
    const price = product.discountPercent
      ? product.price * (1 - product.discountPercent / 100)
      : product.price;
    return `${product.currency} ${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  get isValid(): boolean {
    return this.lineItems.length > 0;
  }

  closeDropdown(): void {
    setTimeout(() => {
      this.showProductDropdown = false;
    }, 150);
  }

  submit(): void {
    if (!this.isValid || this.submitting) return;

    const items: ICreateOrderLineItem[] = this.lineItems.map((li) => ({
      productId: li.product._id,
      qty: li.qty
    }));

    this.submitting = true;
    this.ops
      .createOrder({
        channel: this.channel,
        lineItems: items,
        buyerName: this.buyerName.trim() || undefined,
        buyerPhone: this.buyerPhone.trim() || undefined,
        shippingAddress: this.shippingAddress.trim() || undefined,
        notes: this.notes.trim() || undefined
      })
      .pipe(finalize(() => (this.submitting = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.notify.success('Order created', `${order.displayRef} created successfully.`);
          this.created.emit(order);
          this.close.emit();
        },
        error: (err) => {
          this.notify.error('Failed to create order', err.error?.error || 'Please try again.');
        }
      });
  }
}
