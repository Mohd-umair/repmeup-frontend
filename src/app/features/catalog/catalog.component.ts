import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService, IImportSummary } from '../../core/services/catalog.service';
import { MediaLibraryService } from '../../core/services/media-library.service';
import { Media } from '../../core/models/media.model';
import { NotificationService } from '../../core/services/notification.service';
import { FileUploadZoneComponent } from '../../shared/components/file-upload-zone/file-upload-zone.component';
import { EntitlementsStore, FEATURE_KEY } from '../../core/services/entitlements.store';
import { UpgradePromptComponent } from '../../shared/components/upgrade-prompt/upgrade-prompt.component';
import {
  IProduct,
  ISalesFlowSettings,
  ISalesFlowCtaButton,
  IProductDmConfig,
  IInstagramMediaItem,
  IInstagramCarouselSlide,
  IWhatsAppCatalogSettings,
  IWhatsAppCsvImportResult,
  WhatsAppSyncStatus
} from '../../core/models/product.model';
import {
  ICommerceOrder,
  ICommerceOrderStats,
  CommerceOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CHANNEL_LABELS,
  CommerceChannel
} from '../../core/models/commerce-order.model';
import { environment } from '../../../environments/environment';
import { DEFAULT_CURRENCY } from '../../core/utils/currency-format';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

type ImportSource = 'excel' | 'woocommerce' | 'shopify' | 'url';

type ActiveTab = 'products' | 'whatsapp' | 'orders';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FileUploadZoneComponent, UpgradePromptComponent, AppCurrencyPipe],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
})
export class CatalogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly ent = inject(EntitlementsStore);
  readonly FEATURE_KEY = FEATURE_KEY;
  readonly planAllowed = computed(() => this.ent.can(FEATURE_KEY.COMMERCE_WA_CATALOG_ENABLED));

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
  /** Posts vs Stories filter in Attach Posts wizard step 2 */
  mediaFilter: 'posts' | 'stories' = 'posts';
  loadingMedia = false;
  mediaLoadError = '';
  selectedMediaIds = new Set<string>();
  linkingSelectedPosts = false;
  carouselPreviewMedia: IInstagramMediaItem | null = null;
  carouselSlides: IInstagramCarouselSlide[] = [];
  loadingCarouselSlides = false;
  carouselSlidesError = '';
  /** slideIndex → selected for linking with sort order */
  carouselLinkSlideIndex: number | null = null;

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

  // ── Sales flow defaults (prefill product DM wizard; edit under Automation → Growth) ──
  salesFlowSettings: ISalesFlowSettings | null = null;

  // ── Orders tab ─────────────────────────────
  orders: ICommerceOrder[] = [];
  loadingOrders = false;
  orderStats: ICommerceOrderStats | null = null;
  orderPage = 1;
  orderTotal = 0;
  orderLimit = 30;
  orderStatusFilter: CommerceOrderStatus | '' = '';
  orderChannelFilter: CommerceChannel | '' = '';
  orderSearch = '';
  updatingOrderId: string | null = null;

  readonly orderStatusLabels = ORDER_STATUS_LABELS;
  readonly orderStatusColors = ORDER_STATUS_COLORS;
  readonly channelLabels = CHANNEL_LABELS;

  readonly orderStatuses: Array<{ value: CommerceOrderStatus | ''; label: string }> = [
    { value: '', label: 'All Statuses' },
    { value: 'intent', label: 'Intent' },
    { value: 'product_sent', label: 'Product Sent' },
    { value: 'cart_started', label: 'Cart Started' },
    { value: 'payment_pending', label: 'Payment Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // ── WhatsApp Commerce Catalog ──────────────
  waCatalogSettings: IWhatsAppCatalogSettings | null = null;
  loadingWaSettings = false;
  savingWaSettings = false;
  waCatalogIdInput = '';
  waSettingsError = '';
  waSettingsErrorHint = '';
  waSettingsSaved = false;

  syncingAll = false;
  waSyncResult: { synced: number; failed: number; total: number } | null = null;
  waSyncingProductIds = new Set<string>();

  waCsvFile: File | null = null;
  importingWaCsv = false;
  waCsvImportResult: IWhatsAppCsvImportResult | null = null;
  waCsvImportError = '';

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
    this.loadSalesFlowSettings();
    this.loadWACatalogSettings();
  }

  // ── Orders tab ─────────────────────────────

  onOrdersTabActivated(): void {
    if (!this.orders.length && !this.loadingOrders) {
      this.loadOrders();
      this.loadOrderStats();
    }
  }

  loadOrders(): void {
    this.loadingOrders = true;
    const params: Record<string, unknown> = {
      page: this.orderPage,
      limit: this.orderLimit
    };
    if (this.orderStatusFilter) params['status'] = this.orderStatusFilter;
    if (this.orderChannelFilter) params['channel'] = this.orderChannelFilter;
    if (this.orderSearch) params['search'] = this.orderSearch;

    this.catalogService.getOrders(params as Parameters<typeof this.catalogService.getOrders>[0])
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingOrders = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.orders = r.data?.orders ?? [];
          this.orderTotal = r.data?.total ?? 0;
          this.cdr.markForCheck();
        }
      });
  }

  loadOrderStats(): void {
    this.catalogService.getOrderStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => { this.orderStats = r.data ?? null; this.cdr.markForCheck(); }
      });
  }

  onOrderFilterChange(): void {
    this.orderPage = 1;
    this.loadOrders();
  }

  updateOrderStatus(order: ICommerceOrder, status: CommerceOrderStatus): void {
    if (this.updatingOrderId) return;
    this.updatingOrderId = order._id;
    this.catalogService.updateOrderStatus(order._id, status)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.updatingOrderId = null; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          const idx = this.orders.findIndex(o => o._id === order._id);
          if (idx !== -1 && r.data) {
            this.orders = [...this.orders.slice(0, idx), r.data, ...this.orders.slice(idx + 1)];
          }
          this.notify.success('Updated', `Order marked as ${status.replace('_', ' ')}.`);
          this.loadOrderStats();
          this.cdr.markForCheck();
        },
        error: err => {
          this.notify.error('Update failed', err.error?.error || 'Could not update order status.');
          this.cdr.markForCheck();
        }
      });
  }

  getOrderChannelIcon(channel: string): string {
    const icons: Record<string, string> = {
      instagram: 'fab fa-instagram',
      whatsapp: 'fab fa-whatsapp',
      voice: 'fas fa-phone',
      manual: 'fas fa-pen'
    };
    return icons[channel] || 'fas fa-shopping-bag';
  }

  getOrderChannelClass(channel: string): Record<string, boolean> {
    return {
      'text-green-600 dark:text-green-400': channel === 'whatsapp',
      'text-pink-600 dark:text-pink-400': channel === 'instagram',
      'text-blue-600 dark:text-blue-400': channel === 'voice',
      'text-gray-600 dark:text-gray-400': channel === 'manual'
    };
  }

  getNextStatusOptions(current: CommerceOrderStatus): Array<{ value: CommerceOrderStatus; label: string }> {
    const transitions: Record<CommerceOrderStatus, CommerceOrderStatus[]> = {
      intent: ['product_sent', 'cancelled'],
      product_sent: ['cart_started', 'payment_pending', 'cancelled'],
      cart_started: ['payment_pending', 'cancelled'],
      payment_pending: ['paid', 'cancelled'],
      paid: ['shipped', 'cancelled'],
      shipped: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };
    return (transitions[current] || []).map(s => ({ value: s, label: this.orderStatusLabels[s] }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Products ──────────────────────────────
  loadProducts(): void {
    this.loadingProducts = true;
    this.catalogService.getProducts({ search: this.searchQuery || undefined, isActive: true })
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

  /** Keep wizard attach target in sync with the product the user opened. */
  private setLinkTarget(product: IProduct): void {
    this.linkingProduct = product;
    this.editingProduct = product;
  }

  /** After link/unlink API — sync wizard state and in-memory catalog list. */
  private applyProductLinkUpdate(updated: IProduct): void {
    this.linkingProduct = updated;
    if (this.editingProduct?._id === updated._id) {
      this.editingProduct = updated;
    }
    const idx = this.products.findIndex(p => p._id === updated._id);
    if (idx !== -1) {
      this.products[idx] = updated;
    }
  }

  /** Refresh product cards from server after link/unlink. */
  private refreshProductsAfterLink(): void {
    this.loadProducts();
  }

  openCreateModal(): void {
    this.editingProduct = null;
    this.linkingProduct = null;
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
    this.linkingProduct = null;
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

  openAttachPosts(product: IProduct): void {
    this.setLinkTarget(product);
    this.productError = '';
    this.sizesInput = product.sizes.join(', ');
    this.colorsInput = product.colors.join(', ');
    this.imagesInput = product.images.join('\n');
    this.dmConfig = null;
    this.dmConfigKeywordsInput = '';
    this.dmConfigHesitancyInput = '';
    this.dmConfigError = '';
    this.instagramMedia = [];
    this.selectedMediaIds = new Set();
    this.mediaLoadError = '';
    this.buildProductForm(product);
    this.showProductModal = true;
    this.goToWizardStep(2);
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.editingProduct = null;
    this.linkingProduct = null;
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

  /** Append a library or upload URL without duplicating entries. */
  private appendProductImageUrl(publicUrl: string): void {
    const raw = publicUrl.trim();
    if (!raw) return;
    const key = this.displayImageUrl(raw);
    const lines = this.productImageUrls;
    if (lines.some(u => this.displayImageUrl(u) === key)) return;
    lines.push(raw);
    this.imagesInput = lines.join('\n');
    this.cdr.markForCheck();
  }

  /** Pick existing media from the library — reuse URL, do not re-upload. */
  onProductLibraryImagesSelect(selected: Media | Media[]): void {
    const items = Array.isArray(selected) ? selected : [selected];
    let added = 0;
    for (const m of items) {
      if (!m.publicUrl) continue;
      const before = this.productImageUrls.length;
      this.appendProductImageUrl(m.publicUrl);
      if (this.productImageUrls.length > before) added++;
    }
    if (added) {
      this.notify.success(
        added === 1 ? 'Image added' : 'Images added',
        added === 1 ? 'Selected from your media library' : `${added} images selected from your library`
      );
    }
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
              this.appendProductImageUrl(res.data.publicUrl);
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
      currency: [product?.currency ?? DEFAULT_CURRENCY, Validators.required],
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

          const productName = r.data?.name || 'Product';
          if (isNew) {
            this.notify.success('Product created', `"${productName}" saved successfully.`);
          } else {
            this.notify.success('Product updated', `"${productName}" saved successfully.`);
          }

          const sync = r.whatsappSync;
          const syncError =
            sync?.error?.trim() ||
            r.data?.whatsapp?.syncError?.trim() ||
            '';

          if (sync?.attempted && !sync?.synced) {
            this.notifyWaSyncFailure(productName, syncError);
          } else if (sync?.skippedReason) {
            this.notify.warning(
              'WhatsApp catalog sync skipped',
              this.waSyncSkippedMessage(sync.skippedReason)
            );
          } else if (r.data?.whatsapp?.syncStatus === 'failed') {
            this.notifyWaSyncFailure(productName, syncError);
          }

          if (isNew && r.data) {
            // Advance to step 2 so the user can immediately link posts
            this.goToWizardStep(2);
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
      .subscribe({
        next: () => {
          this.notify.success('Product deleted', `"${product.name}" was removed from your catalog.`);
          this.loadProducts();
        },
        error: err => {
          this.notify.error('Delete failed', err.error?.error || 'Could not delete this product.');
          this.cdr.markForCheck();
        }
      });
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
    const csvContent = headers.join(',') + '\n' + 'PROD-001,Blue T-Shirt,A nice blue shirt,50,INR,0,100,"S,M,L","Blue",https://example.com/img.jpg,https://pay.link/123';
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
    this.setLinkTarget(product);
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
          if (r.data) {
            this.applyProductLinkUpdate(r.data);
            this.refreshProductsAfterLink();
          }
          this.postIdInput = '';
          this.resolvedNumericId = null;
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
          if (r.data) {
            this.applyProductLinkUpdate(r.data);
            this.refreshProductsAfterLink();
          }
          this.cdr.markForCheck();
        }
      });
  }

  loadSalesFlowSettings(): void {
    this.catalogService.getSalesFlowSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => {
          this.salesFlowSettings = r.data ?? null;
          if (this.salesFlowSettings && !Array.isArray(this.salesFlowSettings.ctaButtons)) {
            this.salesFlowSettings.ctaButtons = [];
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.salesFlowSettings = null;
          this.cdr.markForCheck();
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ── Wizard navigation ────────────────────────────────────────────────────
  goToWizardStep(step: 1 | 2 | 3): void {
    if (step === 2) {
      if (this.editingProduct) {
        this.linkingProduct = this.editingProduct;
        this.postIdInput = '';
        this.linkError = '';
        this.resolvedNumericId = null;
        this.resolveError = '';
      }
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
    if (!mediaId) return false;
    return this.products.some(p =>
      (p.instagramPostIds || []).some(pid => pid === mediaId)
    );
  }

  isStoryLinked(mediaId: string): boolean {
    if (!mediaId) return false;
    return this.products.some(p =>
      (p.instagramStoryIds || []).some(sid => sid === mediaId)
    );
  }

  /** True when the current attach target already has this post/story linked. */
  isPostLinkedForTarget(mediaId: string): boolean {
    if (!this.linkingProduct || !mediaId) return false;
    return this.linkingProduct.instagramPostIds.some(pid => pid === mediaId);
  }

  isStoryLinkedForTarget(mediaId: string): boolean {
    if (!this.linkingProduct || !mediaId) return false;
    return (this.linkingProduct.instagramStoryIds || []).some(sid => sid === mediaId);
  }

  isMediaLinked(media: IInstagramMediaItem): boolean {
    if (media.mediaType === 'STORIES') {
      return this.isStoryLinked(media.id) || this.isStoryLinked(media.shortcode || '');
    }
    return this.isPostLinked(media.id) || this.isPostLinked(media.shortcode || '');
  }

  /** Whether the current attach target already has this media linked. */
  isMediaLinkedForTarget(media: IInstagramMediaItem): boolean {
    if (media.mediaType === 'STORIES') {
      return this.isStoryLinkedForTarget(media.id) || this.isStoryLinkedForTarget(media.shortcode || '');
    }
    return this.isPostLinkedForTarget(media.id) || this.isPostLinkedForTarget(media.shortcode || '');
  }

  get filteredInstagramMedia(): IInstagramMediaItem[] {
    if (this.mediaFilter === 'stories') {
      return this.instagramMedia.filter(m => m.mediaType === 'STORIES');
    }
    return this.instagramMedia.filter(m => m.mediaType !== 'STORIES');
  }

  setMediaFilter(filter: 'posts' | 'stories'): void {
    this.mediaFilter = filter;
    this.selectedMediaIds = new Set();
    this.cdr.markForCheck();
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
    let linkedAny = false;

    for (const id of ids) {
      try {
        const media = this.instagramMedia.find(m => m.id === id);
        const isStory = media?.mediaType === 'STORIES';
        let r;
        if (isStory) {
          r = await firstValueFrom(this.catalogService.linkStory(productId, id));
        } else {
          const slideIndex = media?.mediaType === 'CAROUSEL_ALBUM' ? this.carouselLinkSlideIndex ?? undefined : undefined;
          const sortOrder = slideIndex != null ? slideIndex + 1 : undefined;
          r = await firstValueFrom(this.catalogService.linkPost(productId, id, {
            slideIndex,
            sortOrder
          }));
        }
        if (r?.data) {
          this.applyProductLinkUpdate(r.data);
          linkedAny = true;
        }
      } catch (e: any) {
        this.linkError = e?.error?.error || 'Failed to link one or more items';
      }
    }

    if (linkedAny) {
      this.refreshProductsAfterLink();
    }

    this.selectedMediaIds = new Set();
    this.carouselLinkSlideIndex = null;
    this.linkingSelectedPosts = false;
    this.cdr.markForCheck();
  }

  openCarouselPreview(media: IInstagramMediaItem, event?: Event): void {
    event?.stopPropagation();
    this.carouselPreviewMedia = media;
    this.carouselSlides = [];
    this.carouselSlidesError = '';
    this.carouselLinkSlideIndex = null;
    this.loadingCarouselSlides = true;
    this.cdr.markForCheck();

    this.catalogService.getInstagramMediaChildren(media.id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingCarouselSlides = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.carouselSlides = r.data?.slides ?? [];
          this.cdr.markForCheck();
        },
        error: err => {
          this.carouselSlidesError = err.error?.error || 'Could not load carousel slides.';
          this.cdr.markForCheck();
        }
      });
  }

  closeCarouselPreview(): void {
    this.carouselPreviewMedia = null;
    this.carouselSlides = [];
    this.carouselLinkSlideIndex = null;
    this.cdr.markForCheck();
  }

  selectCarouselSlideForLink(slideIndex: number): void {
    this.carouselLinkSlideIndex = slideIndex;
    if (this.carouselPreviewMedia && !this.selectedMediaIds.has(this.carouselPreviewMedia.id)) {
      this.selectedMediaIds.add(this.carouselPreviewMedia.id);
    }
    this.cdr.markForCheck();
  }

  async linkCarouselPostWithSlide(): Promise<void> {
    if (!this.linkingProduct || !this.carouselPreviewMedia) return;
    if (this.carouselLinkSlideIndex == null) {
      this.linkError = 'Select a carousel slide first.';
      this.cdr.markForCheck();
      return;
    }
    this.linkingSelectedPosts = true;
    this.linkError = '';
    const mediaId = this.carouselPreviewMedia.id;
    try {
      const r = await firstValueFrom(this.catalogService.linkPost(this.linkingProduct._id, mediaId, {
        slideIndex: this.carouselLinkSlideIndex,
        sortOrder: this.carouselLinkSlideIndex + 1
      }));
      if (r?.data) {
        this.applyProductLinkUpdate(r.data);
        this.refreshProductsAfterLink();
      }
      this.closeCarouselPreview();
    } catch (e: any) {
      this.linkError = e?.error?.error || 'Failed to link carousel post';
    }
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

  // ── WhatsApp Commerce Catalog ──────────────────────────────────────────────

  loadWACatalogSettings(): void {
    this.loadingWaSettings = true;
    this.catalogService.getWACatalogSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingWaSettings = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.waCatalogSettings = r.data ?? null;
          const canonical = r.data?.metaCatalogId || r.data?.catalogId || '';
          this.waCatalogIdInput = canonical;
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        }
      });
  }

  saveWACatalogSettings(): void {
    const catalogId = this.waCatalogIdInput.trim();
    if (!catalogId) {
      this.waSettingsError = 'Please enter a valid Catalog ID.';
      return;
    }
    this.waSettingsError = '';
    this.waSettingsErrorHint = '';
    this.savingWaSettings = true;
    this.catalogService.updateWACatalogSettings({ catalogId })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingWaSettings = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.waSettingsSaved = true;
          if (this.waCatalogSettings && r.data) {
            this.waCatalogSettings.catalogId = r.data.catalogId || catalogId;
            this.waCatalogSettings.metaCatalogId = r.data.metaCatalogId ?? r.data.catalogId;
            this.waCatalogSettings.catalogLinkStatus = r.data.catalogLinkStatus ?? 'saved';
            this.waCatalogSettings.catalogLinkVerified = r.data.catalogLinkVerified ?? false;
            this.waCatalogSettings.isCatalogVisible = r.data.isCatalogVisible ?? false;
            this.waCatalogSettings.isCartEnabled = r.data.isCartEnabled ?? false;
          }
          this.waCatalogIdInput = r.data?.catalogId || catalogId;
          this.waSettingsError = '';
          this.waSettingsErrorHint = '';
          this.notify.success('Saved', r.data?.metaSynced
            ? 'Catalog linked to your WhatsApp number successfully.'
            : 'Catalog ID saved. Meta link update failed — check your credentials.');
          setTimeout(() => { this.waSettingsSaved = false; this.cdr.markForCheck(); }, 3000);
          this.loadWACatalogSettings();
        },
        error: err => {
          this.waSettingsError = err.error?.error || 'Failed to save catalog settings.';
          this.waSettingsErrorHint = err.error?.hint || '';
          this.cdr.markForCheck();
        }
      });
  }

  syncAllProducts(): void {
    if (this.syncingAll) return;
    this.syncingAll = true;
    this.waSyncResult = null;
    this.catalogService.syncAllProducts()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.syncingAll = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.waSyncResult = r.data ?? null;
          const failed = r.data?.failed ?? 0;
          const synced = r.data?.synced ?? 0;
          if (failed > 0) {
            const sample = r.data?.errors?.[0];
            const detail = sample
              ? `${sample.productName || 'Product'}: ${sample.error}`
              : 'Open the product list below for error details on each row.';
            this.notify.warning(
              'Sync completed with errors',
              `${synced} synced, ${failed} failed. ${detail}`
            );
          } else {
            this.notify.success('Sync complete', `${synced} products synced to WhatsApp catalog.`);
          }
          this.loadProducts();
          this.loadWACatalogSettings();
        },
        error: err => {
          this.notify.error('Sync failed', err.error?.error || 'Could not sync products to WhatsApp.');
          this.cdr.markForCheck();
        }
      });
  }

  syncOneProduct(product: IProduct): void {
    if (this.waSyncingProductIds.has(product._id)) return;
    this.waSyncingProductIds.add(product._id);
    this.cdr.markForCheck();
    this.catalogService.syncProduct(product._id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.waSyncingProductIds.delete(product._id); this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          if (r.data) {
            this.patchProductInList(r.data);
          }
          const name = r.data?.name || product.name;
          if (r.data?.whatsapp?.syncStatus === 'failed') {
            this.notifyWaSyncFailure(name, r.data.whatsapp.syncError);
          } else {
            this.notify.success('Synced', `"${name}" synced to WhatsApp catalog.`);
          }
          this.cdr.markForCheck();
        },
        error: err => {
          const updated = err.error?.data as IProduct | undefined;
          if (updated) {
            this.patchProductInList(updated);
          }
          const msg =
            err.error?.error?.trim() ||
            updated?.whatsapp?.syncError?.trim() ||
            'Could not sync product to WhatsApp catalog.';
          this.notify.error('WhatsApp catalog sync failed', msg);
          this.cdr.markForCheck();
        }
      });
  }

  onWACsvFilesChange(files: File[]): void {
    this.waCsvFile = files && files.length > 0 ? files[0] : null;
    this.waCsvImportResult = null;
    this.waCsvImportError = '';
    this.cdr.markForCheck();
  }

  importWACatalogCsv(): void {
    if (!this.waCsvFile || this.importingWaCsv) return;
    this.importingWaCsv = true;
    this.waCsvImportError = '';
    this.waCsvImportResult = null;
    this.catalogService.importWACatalogCsv(this.waCsvFile)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.importingWaCsv = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.waCsvImportResult = r.data ?? null;
          this.waCsvFile = null;
          this.loadProducts();
          this.loadWACatalogSettings();
          this.notify.success('Import complete', `${(r.data?.created ?? 0) + (r.data?.updated ?? 0)} products imported.`);
        },
        error: err => {
          this.waCsvImportError = err.error?.error || 'CSV import failed.';
          this.cdr.markForCheck();
        }
      });
  }

  waSyncStatusLabel(status?: WhatsAppSyncStatus): string {
    switch (status) {
      case 'synced':     return 'Synced';
      case 'pending':    return 'Pending';
      case 'failed':     return 'Failed';
      default:           return 'Not Synced';
    }
  }

  /** Human-readable Meta / catalog sync error for a product row. */
  waSyncErrorText(product: IProduct): string {
    return product.whatsapp?.syncError?.trim() || '';
  }

  private waSyncSkippedMessage(reason?: string): string {
    switch (reason) {
      case 'no_whatsapp_connection':
        return 'Connect WhatsApp in Settings → Platforms before syncing products.';
      case 'no_catalog_id':
        return 'Save your Meta Commerce Catalog ID on the WhatsApp Catalog tab first.';
      default:
        return 'WhatsApp catalog sync was skipped.';
    }
  }

  private patchProductInList(updated?: IProduct | null): void {
    if (!updated?._id) return;
    const idx = this.products.findIndex(p => p._id === updated._id);
    if (idx === -1) return;
    this.products = [
      ...this.products.slice(0, idx),
      updated,
      ...this.products.slice(idx + 1)
    ];
  }

  private notifyWaSyncFailure(productName: string, error?: string): void {
    this.notify.warning(
      'WhatsApp catalog sync failed',
      error?.trim() ||
        `"${productName}" was saved locally but could not be synced to Meta. Check catalog permissions and try Sync again.`
    );
  }

  waSyncStatusClass(status?: WhatsAppSyncStatus): string {
    switch (status) {
      case 'synced':     return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'pending':    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'failed':     return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      default:           return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  }

  /** True when the catalog ID is saved and Meta has not rejected it. */
  isWaCatalogVerifiedLinked(): boolean {
    const s = this.waCatalogSettings;
    return Boolean(s?.catalogLinkVerified) ||
           s?.catalogLinkStatus === 'linked' ||
           s?.catalogLinkStatus === 'saved';
  }

  /** User edited the input but has not saved yet. */
  isWaCatalogInputDirty(): boolean {
    const input = this.waCatalogIdInput.trim();
    const canonical = String(this.waCatalogSettings?.metaCatalogId || this.waCatalogSettings?.catalogId || '').trim();
    return Boolean(input && canonical && input !== canonical);
  }

  waCatalogCanonicalId(): string {
    return String(this.waCatalogSettings?.metaCatalogId || this.waCatalogSettings?.catalogId || '').trim();
  }

  canSyncWaProducts(): boolean {
    return this.isWaCatalogVerifiedLinked() && !this.isWaCatalogInputDirty();
  }
}
