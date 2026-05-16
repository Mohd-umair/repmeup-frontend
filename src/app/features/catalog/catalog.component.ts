import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService, IImportSummary } from '../../core/services/catalog.service';
import { MediaLibraryService } from '../../core/services/media-library.service';
import { NotificationService } from '../../core/services/notification.service';
import { FileUploadZoneComponent } from '../../shared/components/file-upload-zone/file-upload-zone.component';
import { AiChatBubbleIconComponent } from '../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { IProduct, ICommentToDmSettings } from '../../core/models/product.model';
import { environment } from '../../../environments/environment';

type ImportSource = 'excel' | 'woocommerce' | 'shopify' | 'url';

type ActiveTab = 'products' | 'automation';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FileUploadZoneComponent, AiChatBubbleIconComponent],
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

  sizesInput = '';
  colorsInput = '';
  imagesInput = '';

  /** Media library upload queue (controlled by {@link FileUploadZoneComponent}) */
  productImageUploadQueue: File[] = [];
  showProductImagesModal = false;
  uploadingProductImages = false;

  // ── Post-link modal ────────────────────────
  showPostLinkModal = false;
  linkingProduct: IProduct | null = null;
  postIdInput = '';
  linkingPost = false;
  linkError = '';
  resolvedNumericId: string | null = null;
  resolvingPostId = false;
  resolveError = '';

  // ── Import modal ───────────────────────────
  showImportModal = false;
  importSource: ImportSource = 'excel';
  importing = false;
  importError = '';
  importResult: IImportSummary | null = null;

  // Excel/CSV
  importFile: File | null = null;

  // WooCommerce
  wooStoreUrl = '';
  wooConsumerKey = '';
  wooConsumerSecret = '';

  // Shopify
  shopifyDomain = '';
  shopifyToken = '';

  // Custom URL
  importApiUrl = '';
  importApiAuthHeader = '';

  // ── Automation settings ────────────────────
  settings: ICommentToDmSettings | null = null;
  loadingSettings = false;
  savingSettings = false;
  settingsError = '';
  settingsSaved = false;
  keywordsInput = '';

  constructor(
    private catalogService: CatalogService,
    private mediaLibraryService: MediaLibraryService,
    private notify: NotificationService,
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

  onSearch(): void { this.loadProducts(); }

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
    this.showProductImagesModal = false;
    this.productImageUploadQueue = [];
  }

  /** Parsed image URLs from {@link imagesInput} (one per line). */
  get productImageUrls(): string[] {
    return this.imagesInput.split('\n').map(s => s.trim()).filter(Boolean);
  }

  displayImageUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
  }

  openProductImagesModal(): void {
    this.productImageUploadQueue = [];
    this.showProductImagesModal = true;
  }

  closeProductImagesModal(): void {
    this.showProductImagesModal = false;
    this.productImageUploadQueue = [];
  }

  removeProductImageAt(index: number): void {
    const next = this.productImageUrls.filter((_, i) => i !== index);
    this.imagesInput = next.join('\n');
    this.cdr.markForCheck();
  }

  onProductImageFilesChange(files: File[]): void {
    if (!files.length || this.uploadingProductImages) return;
    const toUpload = [...files];
    this.productImageUploadQueue = [];
    this.uploadingProductImages = true;
    this.cdr.markForCheck();

    const tags = ['catalog', 'product'];
    let i = 0;
    const runNext = (): void => {
      if (i >= toUpload.length) {
        this.uploadingProductImages = false;
        this.cdr.markForCheck();
        return;
      }
      const file = toUpload[i++];
      this.mediaLibraryService
        .uploadMedia(file, tags, '')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: res => {
            if (res.success && res.data?.publicUrl) {
              const url = this.displayImageUrl(res.data.publicUrl);
              const lines = this.productImageUrls;
              lines.push(url);
              this.imagesInput = lines.join('\n');
              this.notify.success('Image added', res.data.originalName || 'Saved to your library');
            }
            runNext();
          },
          error: err => {
            this.notify.error(
              'Upload failed',
              err?.error?.message || err?.error?.error || 'Could not upload image'
            );
            runNext();
          }
        });
    };
    runNext();
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
        next: () => { this.closeProductModal(); this.loadProducts(); },
        error: err => { this.productError = err.error?.error || 'Failed to save product'; this.cdr.markForCheck(); }
      });
  }

  deleteProduct(product: IProduct): void {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.catalogService.deleteProduct(product._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.loadProducts() });
  }

  // ── Import modal ───────────────────────────
  openImportModal(): void {
    this.showImportModal = true;
    this.importSource = 'excel';
    this.importError = '';
    this.importResult = null;
    this.importFile = null;
    this.wooStoreUrl = '';
    this.wooConsumerKey = '';
    this.wooConsumerSecret = '';
    this.shopifyDomain = '';
    this.shopifyToken = '';
    this.importApiUrl = '';
    this.importApiAuthHeader = '';
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.importError = '';
    this.importResult = null;
    this.importFile = null;
  }

  selectImportSource(source: ImportSource): void {
    this.importSource = source;
    this.importError = '';
    this.importResult = null;
  }

  onImportFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.importFile = file;
      this.importError = '';
      this.importResult = null;
    }
  }

  downloadImportTemplate(): void {
    const headers = ['SKU', 'Name', 'Description', 'Price', 'Currency', 'Discount', 'Stock', 'Sizes', 'Colors', 'Images', 'Payment URL'];
    const csvContent = headers.join(',') + '\n' + 'PROD-001,Blue T-Shirt,A nice blue shirt,50,AED,0,100,"S,M,L","Blue",https://example.com/img.jpg,https://pay.link/123';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'repmeup_product_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  get canImport(): boolean {
    if (this.importing) return false;
    switch (this.importSource) {
      case 'excel': return !!this.importFile;
      case 'woocommerce': return !!(this.wooStoreUrl && this.wooConsumerKey && this.wooConsumerSecret);
      case 'shopify': return !!(this.shopifyDomain && this.shopifyToken);
      case 'url': return !!this.importApiUrl;
      default: return false;
    }
  }

  runImport(): void {
    this.importing = true;
    this.importError = '';
    this.importResult = null;

    let request$;
    switch (this.importSource) {
      case 'excel':
        if (!this.importFile) { this.importing = false; return; }
        request$ = this.catalogService.importProducts(this.importFile);
        break;
      case 'woocommerce':
        request$ = this.catalogService.importFromWooCommerce(this.wooStoreUrl, this.wooConsumerKey, this.wooConsumerSecret);
        break;
      case 'shopify':
        request$ = this.catalogService.importFromShopify(this.shopifyDomain, this.shopifyToken);
        break;
      case 'url':
        request$ = this.catalogService.importFromUrl(this.importApiUrl, this.importApiAuthHeader || undefined);
        break;
      default:
        this.importing = false;
        return;
    }

    request$
      .pipe(takeUntil(this.destroy$), finalize(() => { this.importing = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          if (r.success && r.data) {
            this.importResult = r.data;
            this.loadProducts();
          } else {
            this.importError = (r as any).error || 'Import failed';
          }
        },
        error: err => {
          this.importError = err.error?.error || 'Import failed';
          this.cdr.markForCheck();
        }
      });
  }

  // ── Post links ─────────────────────────────
  openPostLinkModal(product: IProduct): void {
    this.linkingProduct = product;
    this.postIdInput = '';
    this.linkError = '';
    this.resolvedNumericId = null;
    this.resolveError = '';
    this.showPostLinkModal = true;
  }

  closePostLinkModal(): void {
    this.showPostLinkModal = false;
    this.linkingProduct = null;
    this.resolvedNumericId = null;
    this.resolveError = '';
  }

  onPostIdInputChange(): void {
    this.resolvedNumericId = null;
    this.resolveError = '';
  }

  resolvePostId(): void {
    const raw = this.postIdInput.trim();
    if (!raw) return;
    this.resolvingPostId = true;
    this.resolveError = '';
    this.resolvedNumericId = null;

    this.catalogService.resolvePostId(raw)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.resolvingPostId = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          if (r.success && r.data?.numericId) {
            this.resolvedNumericId = r.data.numericId;
          } else {
            this.resolveError = r.error || 'Could not resolve — will be stored as shortcode';
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.resolveError = err.error?.error || 'Could not resolve post ID';
          this.cdr.markForCheck();
        }
      });
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
          this.resolvedNumericId = null;
          const idx = this.products.findIndex(p => p._id === r.data?._id);
          if (idx !== -1 && r.data) this.products[idx] = r.data;
          this.cdr.markForCheck();
        },
        error: err => { this.linkError = err.error?.error || 'Failed to link post'; this.cdr.markForCheck(); }
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
        error: err => { this.settingsError = err.error?.error || 'Failed to save settings'; this.cdr.markForCheck(); }
      });
  }

  // ── Computed helpers ────────────────────────
  get productsWithPostsLinked(): number {
    return this.products.filter(p => p.instagramPostIds.length > 0).length;
  }

  get effectivePrice(): number {
    const raw = this.productForm?.value;
    if (!raw) return 0;
    const price = Number(raw.price) || 0;
    const disc = Number(raw.discountPercent) || 0;
    return +(price * (1 - disc / 100)).toFixed(2);
  }

  getPostIgUrl(postId: string): string {
    // If stored value is already a full URL, return it directly
    if (postId.startsWith('http')) return postId;
    // Numeric media IDs can't be opened directly as a URL — link to search instead
    if (/^\d+$/.test(postId)) return `https://www.instagram.com/`;
    return `https://www.instagram.com/p/${postId}/`;
  }

  /** Display label — show shortcode or truncated numeric ID */
  getPostIgLabel(postId: string): string {
    if (postId.startsWith('http')) {
      // Extract shortcode from stored URL for cleaner display
      const m = postId.match(/\/p\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : postId;
    }
    return postId;
  }

  trackByProduct(_: number, p: IProduct): string { return p._id; }
  trackByPostId(_: number, id: string): string { return id; }
  trackByImageUrl(_: number, url: string): string { return url; }
}
