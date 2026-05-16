import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService, IImportSummary } from '../../core/services/catalog.service';
import { MediaLibraryService } from '../../core/services/media-library.service';
import { NotificationService } from '../../core/services/notification.service';
import { FileUploadZoneComponent } from '../../shared/components/file-upload-zone/file-upload-zone.component';
import { AiChatBubbleIconComponent } from '../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { IProduct, ICommentToDmSettings, ISalesFlowSettings, ISalesFlowCtaButton, IProductDmConfig, IInstagramMediaItem } from '../../core/models/product.model';
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

  // ── Wizard state ───────────────────────────
  /** Current step: 1=Product Info, 2=Attach Posts, 3=DM Config */
  wizardStep: 1 | 2 | 3 = 1;

  // Step 2 — Instagram media picker
  instagramMedia: IInstagramMediaItem[] = [];
  loadingMedia = false;
  mediaLoadError = '';
  selectedMediaIds = new Set<string>();
  linkingSelectedPosts = false;

  // Step 3 — per-product DM config
  dmConfig: IProductDmConfig | null = null;
  dmConfigKeywordsInput = '';
  dmConfigHesitancyInput = '';
  loadingDmConfig = false;
  savingDmConfig = false;
  dmConfigError = '';

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

  // ── Sales flow settings ────────────────────
  salesFlowSettings: ISalesFlowSettings | null = null;
  loadingSalesFlow = false;
  savingSalesFlow = false;
  salesFlowLoadError = '';
  hesitancyKeywordsInput = '';

  // ── Post ID backfill ───────────────────────
  backfilling = false;
  backfillResult: { resolved: number; failed: number } | null = null;
  backfillError = '';

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
    this.loadSalesFlowSettings();
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
    this.wizardStep = 1;
    this.dmConfig = null;
    this.dmConfigKeywordsInput = '';
    this.dmConfigHesitancyInput = '';
    this.dmConfigError = '';
    this.instagramMedia = [];
    this.selectedMediaIds = new Set();
    this.mediaLoadError = '';
    this.buildProductForm();
    this.showProductModal = true;
  }

  openEditModal(product: IProduct): void {
    this.editingProduct = product;
    this.productError = '';
    this.sizesInput = product.sizes.join(', ');
    this.colorsInput = product.colors.join(', ');
    this.imagesInput = product.images.join('\n');
    this.wizardStep = 1;
    this.dmConfig = null;
    this.dmConfigKeywordsInput = '';
    this.dmConfigHesitancyInput = '';
    this.dmConfigError = '';
    this.instagramMedia = [];
    this.selectedMediaIds = new Set();
    this.mediaLoadError = '';
    this.buildProductForm(product);
    this.showProductModal = true;
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProduct = null;
    this.showProductImagesModal = false;
    this.productImageUploadQueue = [];
    this.wizardStep = 1;
    this.dmConfig = null;
    this.dmConfigError = '';
    this.instagramMedia = [];
    this.selectedMediaIds = new Set();
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

    const isNew = !this.editingProduct;
    const request$ = this.editingProduct
      ? this.catalogService.updateProduct(this.editingProduct._id, payload)
      : this.catalogService.createProduct(payload);

    request$
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingProduct = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          if (r.data) this.editingProduct = r.data;
          this.loadProducts();
          if (isNew && r.data) {
            // Advance to step 2 so the user can immediately link posts
            this.wizardStep = 2;
            this.linkingProduct = r.data;
            this.postIdInput = '';
            this.linkError = '';
            this.resolvedNumericId = null;
            this.resolveError = '';
            // Load Instagram media grid for the picker
            if (!this.instagramMedia.length && !this.loadingMedia) {
              this.loadInstagramMedia();
            }
          } else {
            this.closeProductModal();
          }
          this.cdr.markForCheck();
        },
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

    const { dmTemplate: _legacyDmTemplate, ...rest } = this.settings;
    const payload: Partial<ICommentToDmSettings> = {
      ...rest,
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

  // ── Sales flow settings ──────────────────────
  loadSalesFlowSettings(): void {
    this.loadingSalesFlow = true;
    this.salesFlowLoadError = '';
    this.catalogService.getSalesFlowSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingSalesFlow = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.salesFlowSettings = r.data ?? null;
          if (this.salesFlowSettings) {
            this.hesitancyKeywordsInput = (this.salesFlowSettings.hesitancyKeywords || []).join(', ');
            // Ensure ctaButtons is always a mutable array
            if (!Array.isArray(this.salesFlowSettings.ctaButtons)) {
              this.salesFlowSettings.ctaButtons = [];
            }
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.salesFlowLoadError = 'Could not load Sales Flow settings.';
          this.cdr.markForCheck();
        }
      });
  }

  addCtaButton(): void {
    if (!this.salesFlowSettings) return;
    if (!Array.isArray(this.salesFlowSettings.ctaButtons)) {
      this.salesFlowSettings.ctaButtons = [];
    }
    if (this.salesFlowSettings.ctaButtons.length >= 3) return;
    this.salesFlowSettings.ctaButtons = [
      ...this.salesFlowSettings.ctaButtons,
      { label: '', type: 'postback', payload: '' }
    ];
    this.cdr.markForCheck();
  }

  removeCtaButton(index: number): void {
    if (!this.salesFlowSettings?.ctaButtons) return;
    this.salesFlowSettings.ctaButtons = this.salesFlowSettings.ctaButtons.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  trackByIndex(index: number): number {
    return index;
  }

  saveSalesFlowSettings(): void {
    if (!this.salesFlowSettings) return;
    this.savingSalesFlow = true;
    const s = this.salesFlowSettings;
    const payload: Partial<ISalesFlowSettings> = {
      enabled: s.enabled,
      ctaTitle: s.ctaTitle,
      ctaSubtitle: s.ctaSubtitle,
      ctaImageUrl: s.ctaImageUrl,
      ctaButtons: (s.ctaButtons || []).map((b: ISalesFlowCtaButton) => {
        const type = b.type === 'web_url' ? 'web_url' : 'postback';
        return type === 'web_url'
          ? { label: b.label, type, url: b.url || '' }
          : { label: b.label, type, payload: b.payload || '' };
      }),
      hesitancyKeywords: this.hesitancyKeywordsInput.split(',').map(k => k.trim()).filter(Boolean),
      whatsappCaptureMessage: s.whatsappCaptureMessage,
      whatsappCaptureConfirmation: s.whatsappCaptureConfirmation
    };
    this.catalogService.updateSalesFlowSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingSalesFlow = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.salesFlowSettings = r.data ?? null;
          if (this.salesFlowSettings) {
            this.hesitancyKeywordsInput = (this.salesFlowSettings.hesitancyKeywords || []).join(', ');
            if (!Array.isArray(this.salesFlowSettings.ctaButtons)) {
              this.salesFlowSettings.ctaButtons = [];
            }
          }
          this.notify.success('Saved', 'Sales Flow settings updated.');
          this.cdr.markForCheck();
        },
        error: err => {
          const msg = err.error?.error || err.error?.message || 'Failed to save Sales Flow settings.';
          this.notify.error('Save failed', msg);
          this.cdr.markForCheck();
        }
      });
  }

  // ── Post ID backfill ──────────────────────────────────────────────────────
  backfillPostIds(): void {
    this.backfilling = true;
    this.backfillResult = null;
    this.backfillError = '';
    this.catalogService.backfillPostNumericIds()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.backfilling = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.backfillResult = r.data ?? null;
          this.notify.success('Done', `Backfill complete — ${r.data?.resolved ?? 0} post(s) fixed.`);
          this.cdr.markForCheck();
        },
        error: err => {
          this.backfillError = err.error?.error || err.error?.message || 'Backfill failed. Make sure Instagram is connected.';
          this.cdr.markForCheck();
        }
      });
  }

  // ── Wizard navigation ────────────────────────────────────────────────────
  goToWizardStep(step: 1 | 2 | 3): void {
    if (step === 2) {
      if (this.editingProduct && !this.linkingProduct) {
        this.linkingProduct = this.editingProduct;
        this.postIdInput = '';
        this.linkError = '';
        this.resolvedNumericId = null;
        this.resolveError = '';
      }
      // Load posts grid if not already loaded
      if (!this.instagramMedia.length && !this.loadingMedia) {
        this.loadInstagramMedia();
      }
    }
    if (step === 3 && this.editingProduct) {
      this.loadProductDmConfig(this.editingProduct._id);
    }
    this.wizardStep = step;
    this.cdr.markForCheck();
  }

  // ── Instagram media picker (step 2) ──────────────────────────────────────
  loadInstagramMedia(): void {
    this.loadingMedia = true;
    this.mediaLoadError = '';
    this.catalogService.getInstagramMedia(24)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingMedia = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.instagramMedia = r.data ?? [];
          this.cdr.markForCheck();
        },
        error: err => {
          this.mediaLoadError = err.error?.error || 'Could not load Instagram posts. Make sure Instagram is connected.';
          this.cdr.markForCheck();
        }
      });
  }

  isPostLinked(mediaId: string): boolean {
    if (!this.linkingProduct) return false;
    return this.linkingProduct.instagramPostIds.some(pid => pid === mediaId);
  }

  toggleMediaSelection(mediaId: string): void {
    if (this.selectedMediaIds.has(mediaId)) {
      this.selectedMediaIds.delete(mediaId);
    } else {
      this.selectedMediaIds.add(mediaId);
    }
    this.cdr.markForCheck();
  }

  isMediaSelected(mediaId: string): boolean {
    return this.selectedMediaIds.has(mediaId);
  }

  async linkSelectedPosts(): Promise<void> {
    if (!this.linkingProduct || !this.selectedMediaIds.size || this.linkingSelectedPosts) return;
    this.linkingSelectedPosts = true;
    this.linkError = '';
    this.cdr.markForCheck();

    const productId = this.linkingProduct._id;
    const ids = [...this.selectedMediaIds];

    for (const id of ids) {
      try {
        const r = await firstValueFrom(this.catalogService.linkPost(productId, id));
        if (r?.data) {
          this.linkingProduct = r.data;
          const idx = this.products.findIndex(p => p._id === r.data!._id);
          if (idx !== -1) this.products[idx] = r.data!;
        }
      } catch (e: any) {
        this.linkError = e?.error?.error || 'Failed to link one or more posts';
      }
    }

    this.selectedMediaIds = new Set();
    this.linkingSelectedPosts = false;
    this.cdr.markForCheck();
  }

  trackByMediaId(_: number, m: IInstagramMediaItem): string { return m.id; }

  // ── Per-product DM config ────────────────────────────────────────────────
  loadProductDmConfig(productId: string): void {
    this.loadingDmConfig = true;
    this.dmConfigError = '';
    this.catalogService.getProductDmConfig(productId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingDmConfig = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          const saved = r.data ?? {};
          const sf = this.salesFlowSettings;

          // Pre-fill empty fields with global defaults so the user sees the
          // inherited values and can edit or clear them as needed.
          this.dmConfig = {
            ctaTitle:    saved.ctaTitle    ?? (sf?.ctaTitle    || ''),
            ctaSubtitle: saved.ctaSubtitle ?? (sf?.ctaSubtitle || ''),
            ctaImageUrl: saved.ctaImageUrl ?? (sf?.ctaImageUrl || ''),
            // Only pre-fill buttons from global if none saved per-product
            ctaButtons: (saved.ctaButtons?.length
              ? saved.ctaButtons
              : (sf?.ctaButtons?.length ? sf.ctaButtons.map(b => ({ ...b })) : [])),
            triggerKeywords:             saved.triggerKeywords             ?? [],
            publicReplyTemplate:         saved.publicReplyTemplate         ?? '',
            hesitancyKeywords:           saved.hesitancyKeywords           ?? [],
            whatsappCaptureMessage:      saved.whatsappCaptureMessage      ?? (sf?.whatsappCaptureMessage      || ''),
            whatsappCaptureConfirmation: saved.whatsappCaptureConfirmation ?? (sf?.whatsappCaptureConfirmation || ''),
          };

          this.dmConfigKeywordsInput  = (this.dmConfig.triggerKeywords  || []).join(', ');
          this.dmConfigHesitancyInput = (this.dmConfig.hesitancyKeywords || []).join(', ');
          this.cdr.markForCheck();
        },
        error: () => {
          this.dmConfigError = 'Could not load DM configuration.';
          this.cdr.markForCheck();
        }
      });
  }

  saveProductDmConfig(): void {
    if (!this.editingProduct || !this.dmConfig) return;
    this.savingDmConfig = true;
    this.dmConfigError = '';

    const cfg = this.dmConfig;
    const payload: Partial<IProductDmConfig> = {
      ctaTitle:    cfg.ctaTitle    || undefined,
      ctaSubtitle: cfg.ctaSubtitle || undefined,
      ctaImageUrl: cfg.ctaImageUrl || undefined,
      ctaButtons: (cfg.ctaButtons || []).map((b: ISalesFlowCtaButton) => {
        const type = b.type === 'web_url' ? 'web_url' : 'postback';
        return type === 'web_url'
          ? { label: b.label, type, url: b.url || '' }
          : { label: b.label, type, payload: b.payload || '' };
      }),
      triggerKeywords:  this.dmConfigKeywordsInput.split(',').map(k => k.trim()).filter(Boolean),
      hesitancyKeywords: this.dmConfigHesitancyInput.split(',').map(k => k.trim()).filter(Boolean),
      whatsappCaptureMessage:      cfg.whatsappCaptureMessage      || undefined,
      whatsappCaptureConfirmation: cfg.whatsappCaptureConfirmation || undefined
    };

    this.catalogService.updateProductDmConfig(this.editingProduct._id, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingDmConfig = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.dmConfig = r.data ?? {};
          if (!Array.isArray(this.dmConfig!.ctaButtons)) this.dmConfig!.ctaButtons = [];
          this.dmConfigKeywordsInput  = (this.dmConfig!.triggerKeywords  || []).join(', ');
          this.dmConfigHesitancyInput = (this.dmConfig!.hesitancyKeywords || []).join(', ');
          this.notify.success('Saved', 'DM configuration updated for this product.');
          this.closeProductModal();
          this.cdr.markForCheck();
        },
        error: err => {
          this.dmConfigError = err.error?.error || 'Failed to save DM configuration.';
          this.cdr.markForCheck();
        }
      });
  }

  addDmButton(): void {
    if (!this.dmConfig) return;
    if (!Array.isArray(this.dmConfig.ctaButtons)) this.dmConfig.ctaButtons = [];
    if (this.dmConfig.ctaButtons.length >= 3) return;
    this.dmConfig.ctaButtons = [...this.dmConfig.ctaButtons, { label: '', type: 'postback', payload: '' }];
    this.cdr.markForCheck();
  }

  removeDmButton(index: number): void {
    if (!this.dmConfig?.ctaButtons) return;
    this.dmConfig.ctaButtons = this.dmConfig.ctaButtons.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  // ── Computed helpers ────────────────────────
  get productsWithPostsLinked(): number {
    return this.products.filter(p => p.instagramPostIds.length > 0).length;
  }

  /** Button labels for the Automation tab phone preview (global Sales Flow). */
  get ctaPreviewButtons(): ISalesFlowCtaButton[] {
    const raw = this.salesFlowSettings?.ctaButtons ?? [];
    return raw
      .filter(b => String(b?.label || '').trim())
      .slice(0, 3)
      .map(b => ({ ...b, label: String(b.label).trim().slice(0, 20) }));
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
