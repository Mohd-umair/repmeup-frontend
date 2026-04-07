import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService } from '../../core/services/catalog.service';
import { IProduct, ICommentToDmSettings } from '../../core/models/product.model';

type ActiveTab = 'products' | 'automation';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
})
export class CatalogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: ActiveTab = 'products';

  // ── Products ──────────────────────────────
  products: IProduct[] = [];
  loadingProducts = false;
  searchQuery = '';
  totalProducts = 0;

  // ── Product modal ──────────────────────────
  showProductModal = false;
  editingProduct: IProduct | null = null;
  productForm!: FormGroup;
  savingProduct = false;
  productError = '';

  // Size / color raw inputs (comma-separated)
  sizesInput = '';
  colorsInput = '';
  imagesInput = '';

  // ── Post-link modal ────────────────────────
  showPostLinkModal = false;
  linkingProduct: IProduct | null = null;
  postIdInput = '';
  linkingPost = false;
  linkError = '';

  // ── Automation settings ────────────────────
  settings: ICommentToDmSettings | null = null;
  loadingSettings = false;
  savingSettings = false;
  settingsError = '';
  settingsSaved = false;

  // Raw keyword input
  keywordsInput = '';

  constructor(
    private catalogService: CatalogService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.buildProductForm();
    this.loadProducts();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Products ──────────────────────────────
  loadProducts(): void {
    this.loadingProducts = true;
    this.catalogService.getProducts({ search: this.searchQuery || undefined })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingProducts = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.products = r.data?.products ?? [];
          this.totalProducts = r.data?.total ?? 0;
          this.cdr.markForCheck();
        }
      });
  }

  onSearch(): void {
    this.loadProducts();
  }

  openCreateModal(): void {
    this.editingProduct = null;
    this.productError = '';
    this.sizesInput = '';
    this.colorsInput = '';
    this.imagesInput = '';
    this.buildProductForm();
    this.showProductModal = true;
  }

  openEditModal(product: IProduct): void {
    this.editingProduct = product;
    this.productError = '';
    this.sizesInput = product.sizes.join(', ');
    this.colorsInput = product.colors.join(', ');
    this.imagesInput = product.images.join('\n');
    this.buildProductForm(product);
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProduct = null;
  }

  private buildProductForm(product?: IProduct): void {
    this.productForm = this.fb.group({
      name: [product?.name ?? '', Validators.required],
      description: [product?.description ?? ''],
      price: [product?.price ?? '', [Validators.required, Validators.min(0)]],
      currency: [product?.currency ?? 'AED', Validators.required],
      discountPercent: [product?.discountPercent ?? 0, [Validators.min(0), Validators.max(100)]],
      paymentUrl: [product?.paymentUrl ?? ''],
      stock: [product?.stock ?? '']
    });
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;
    this.savingProduct = true;
    this.productError = '';

    const raw = this.productForm.value;
    const payload: Partial<IProduct> = {
      ...raw,
      price: Number(raw.price),
      discountPercent: Number(raw.discountPercent || 0),
      stock: raw.stock !== '' && raw.stock != null ? Number(raw.stock) : null,
      sizes: this.sizesInput.split(',').map(s => s.trim()).filter(Boolean),
      colors: this.colorsInput.split(',').map(s => s.trim()).filter(Boolean),
      images: this.imagesInput.split('\n').map(s => s.trim()).filter(Boolean)
    };

    const request$ = this.editingProduct
      ? this.catalogService.updateProduct(this.editingProduct._id, payload)
      : this.catalogService.createProduct(payload);

    request$
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingProduct = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.closeProductModal();
          this.loadProducts();
        },
        error: err => {
          this.productError = err.error?.error || 'Failed to save product';
          this.cdr.markForCheck();
        }
      });
  }

  deleteProduct(product: IProduct): void {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.catalogService.deleteProduct(product._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.loadProducts() });
  }

  // ── Post links ─────────────────────────────
  openPostLinkModal(product: IProduct): void {
    this.linkingProduct = product;
    this.postIdInput = '';
    this.linkError = '';
    this.showPostLinkModal = true;
  }

  closePostLinkModal(): void {
    this.showPostLinkModal = false;
    this.linkingProduct = null;
  }

  addPostLink(): void {
    if (!this.postIdInput.trim() || !this.linkingProduct) return;
    this.linkingPost = true;
    this.linkError = '';

    this.catalogService.linkPost(this.linkingProduct._id, this.postIdInput.trim())
      .pipe(takeUntil(this.destroy$), finalize(() => { this.linkingPost = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.linkingProduct = r.data ?? null;
          this.postIdInput = '';
          // Update product in list
          const idx = this.products.findIndex(p => p._id === r.data?._id);
          if (idx !== -1 && r.data) this.products[idx] = r.data;
          this.cdr.markForCheck();
        },
        error: err => {
          this.linkError = err.error?.error || 'Failed to link post';
          this.cdr.markForCheck();
        }
      });
  }

  removePostLink(postId: string): void {
    if (!this.linkingProduct) return;
    this.catalogService.unlinkPost(this.linkingProduct._id, postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => {
          this.linkingProduct = r.data ?? null;
          const idx = this.products.findIndex(p => p._id === r.data?._id);
          if (idx !== -1 && r.data) this.products[idx] = r.data;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Automation settings ────────────────────
  loadSettings(): void {
    this.loadingSettings = true;
    this.catalogService.getCommentToDmSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingSettings = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.settings = r.data ?? null;
          if (this.settings) this.keywordsInput = this.settings.triggerKeywords.join(', ');
          this.cdr.markForCheck();
        }
      });
  }

  saveSettings(): void {
    if (!this.settings) return;
    this.savingSettings = true;
    this.settingsSaved = false;
    this.settingsError = '';

    const payload: Partial<ICommentToDmSettings> = {
      ...this.settings,
      triggerKeywords: this.keywordsInput.split(',').map(k => k.trim()).filter(Boolean)
    };

    this.catalogService.updateCommentToDmSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingSettings = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.settings = r.data ?? null;
          this.settingsSaved = true;
          setTimeout(() => { this.settingsSaved = false; this.cdr.markForCheck(); }, 3000);
          this.cdr.markForCheck();
        },
        error: err => {
          this.settingsError = err.error?.error || 'Failed to save settings';
          this.cdr.markForCheck();
        }
      });
  }

  // ── Helpers ────────────────────────────────
  get effectivePrice(): number {
    const raw = this.productForm?.value;
    if (!raw) return 0;
    const price = Number(raw.price) || 0;
    const disc = Number(raw.discountPercent) || 0;
    return +(price * (1 - disc / 100)).toFixed(2);
  }

  getPostIgUrl(postId: string): string {
    return `https://www.instagram.com/p/${postId}/`;
  }

  trackByProduct(_: number, p: IProduct): string { return p._id; }
  trackByPostId(_: number, id: string): string { return id; }
}
