import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, Input, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PostEditorOutput {
  dataUrl: string;
  width: number;
  height: number;
}

interface LayerItem {
  id: string;
  type: 'background' | 'text' | 'logo' | 'cta' | 'overlay';
  label: string;
  fabricRef?: any;
  locked: boolean;
  visible: boolean;
}

const ASPECT_RATIOS: Record<string, { w: number; h: number; label: string }> = {
  '1:1':  { w: 1080, h: 1080, label: 'Square (1:1)' },
  '4:5':  { w: 1080, h: 1350, label: 'Portrait (4:5)' },
  '16:9': { w: 1080, h: 608,  label: 'Landscape (16:9)' },
  '9:16': { w: 1080, h: 1920, label: 'Story (9:16)' }
};

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Poppins', 'Oswald', 'Raleway', 'Playfair Display', 'Nunito',
  'Merriweather', 'Source Sans Pro', 'PT Sans', 'Rubik', 'Ubuntu',
  'Cabin', 'DM Sans', 'Quicksand', 'Work Sans', 'Karla'
];

@Component({
  selector: 'app-post-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-editor.component.html',
  styleUrls: ['./post-editor.component.scss']
})
export class PostEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('editorCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() backgroundImageUrl: string | null = null;
  @Input() logoUrl: string | null = null;
  @Input() headlineText = '';
  @Input() brandColors: string[] = [];
  @Input() aspectRatio: string = '1:1';

  @Output() editorDone = new EventEmitter<PostEditorOutput>();
  @Output() editorCancel = new EventEmitter<void>();

  canvas: any = null;
  private fabricModule: any = null;

  layers: LayerItem[] = [];
  selectedLayerId: string | null = null;

  aspectRatios = Object.entries(ASPECT_RATIOS).map(([k, v]) => ({ id: k, ...v }));
  canvasWidth = 1080;
  canvasHeight = 1080;
  displayScale = 0.5;

  fonts = GOOGLE_FONTS;
  textFont = 'Inter';
  textSize = 48;
  textWeight: string = 'bold';
  textColor = '#FFFFFF';
  textAlign: string = 'center';
  letterSpacing = 0;
  lineHeight = 1.3;
  textShadow = false;
  textOutline = false;
  textBgBox = false;

  ctaText = 'Shop Now';
  ctaFill = '#B8F567';
  ctaTextColor = '#000000';
  ctaShape: 'rounded' | 'pill' | 'circle' = 'pill';

  bgBrightness = 100;
  bgContrast = 100;
  bgSaturation = 100;
  bgBlur = 0;

  overlayColor = '#000000';
  overlayOpacity = 0;

  activePanel: 'layers' | 'text' | 'cta' | 'image' | 'overlay' | 'templates' = 'layers';

  get hasOverlayLayer(): boolean {
    return this.layers.some(l => l.type === 'overlay');
  }

  templates: any[] = [];
  templatesLoading = false;

  constructor(private http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    const ratio = ASPECT_RATIOS[this.aspectRatio] || ASPECT_RATIOS['1:1'];
    this.canvasWidth = ratio.w;
    this.canvasHeight = ratio.h;
  }

  async ngAfterViewInit(): Promise<void> {
    this.fabricModule = await import('fabric');
    await this.initCanvas();
  }

  ngOnDestroy(): void {
    this.canvas?.dispose();
  }

  private async initCanvas(): Promise<void> {
    const fabric = this.fabricModule;
    const el = this.canvasRef.nativeElement;

    this.canvas = new fabric.Canvas(el, {
      width: this.canvasWidth,
      height: this.canvasHeight,
      backgroundColor: '#1a1a2e',
      selection: true,
      preserveObjectStacking: true
    });

    this.canvas.on('selection:created', (e: any) => this.onObjectSelected(e));
    this.canvas.on('selection:updated', (e: any) => this.onObjectSelected(e));
    this.canvas.on('selection:cleared', () => { this.selectedLayerId = null; });

    if (this.backgroundImageUrl) {
      await this.addBackgroundImage(this.backgroundImageUrl);
    }

    if (this.headlineText) {
      this.addTextLayer(this.headlineText);
    }

    if (this.logoUrl) {
      await this.addLogoLayer(this.logoUrl);
    }

    this.updateDisplayScale();
  }

  private updateDisplayScale(): void {
    const maxWidth = Math.min(window.innerWidth * 0.55, 700);
    this.displayScale = maxWidth / this.canvasWidth;
  }

  private onObjectSelected(e: any): void {
    const obj = e.selected?.[0];
    if (obj?._layerId) {
      this.selectedLayerId = obj._layerId;
    }
  }

  // ─── Background ──────────────────────────────────
  async addBackgroundImage(url: string): Promise<void> {
    const fabric = this.fabricModule;
    // URL is expected to already be same-origin (proxied through backend).
    // Load without crossOrigin restriction — this is required for canvas export.
    return new Promise<void>((resolve) => {
      fabric.FabricImage.fromURL(url).then((img: any) => {
        if (!img || !img.width) {
          console.warn('[PostEditor] Background image failed to load', url);
          resolve();
          return;
        }
        // Cover-fit: scale to fill canvas
        const scaleX = this.canvasWidth / img.width;
        const scaleY = this.canvasHeight / img.height;
        const scale = Math.max(scaleX, scaleY);
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: this.canvasWidth / 2,
          top: this.canvasHeight / 2,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false
        });
        (img as any)._layerId = 'bg';
        this.canvas.insertAt(img, 0);
        this.layers = [
          { id: 'bg', type: 'background', label: 'Background Image', fabricRef: img, locked: true, visible: true },
          ...this.layers.filter(l => l.id !== 'bg')
        ];
        this.canvas.renderAll();
        resolve();
      }).catch((err: any) => {
        console.warn('[PostEditor] FabricImage.fromURL failed', url, err);
        resolve();
      });
    });
  }

  // ─── Text Layer ──────────────────────────────────
  addTextLayer(text?: string): void {
    const fabric = this.fabricModule;
    const id = 'text-' + Date.now();
    const textObj = new fabric.Textbox(text || 'Your headline here', {
      left: this.canvasWidth / 2,
      top: this.canvasHeight / 2,
      originX: 'center',
      originY: 'center',
      width: this.canvasWidth * 0.8,
      fontFamily: this.textFont,
      fontSize: this.textSize,
      fontWeight: this.textWeight,
      fill: this.textColor,
      textAlign: this.textAlign as string,
      lineHeight: this.lineHeight,
      charSpacing: this.letterSpacing * 10,
      editable: true,
      snapAngle: 15
    });
    (textObj as any)._layerId = id;
    this.canvas.add(textObj);
    this.canvas.setActiveObject(textObj);
    this.layers.push({ id, type: 'text', label: text ? text.slice(0, 20) + '...' : 'Text Layer', fabricRef: textObj, locked: false, visible: true });
    this.selectedLayerId = id;
    this.activePanel = 'text';
    this.canvas.renderAll();
  }

  // ─── Logo Layer ──────────────────────────────────
  async addLogoLayer(url: string): Promise<void> {
    const fabric = this.fabricModule;
    return new Promise<void>((resolve) => {
      fabric.FabricImage.fromURL(url).then((img: any) => {
        if (!img || !img.width) { resolve(); return; }
        const maxSize = this.canvasWidth * 0.18;
        const scale = maxSize / Math.max(img.width, img.height);
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: this.canvasWidth - 30,
          top: this.canvasHeight - 30,
          originX: 'right',
          originY: 'bottom',
          snapAngle: 15
        });
        const id = 'logo-' + Date.now();
        (img as any)._layerId = id;
        this.canvas.add(img);
        this.layers.push({ id, type: 'logo', label: 'Logo', fabricRef: img, locked: false, visible: true });
        this.canvas.renderAll();
        resolve();
      }).catch(() => resolve());
    });
  }

  // Upload a logo from file input — creates a local blob URL (same-origin, no CORS)
  async uploadLogoFromFile(file: File): Promise<void> {
    const objectUrl = URL.createObjectURL(file);
    // Remove any existing logo layers first
    const existing = this.layers.filter(l => l.type === 'logo');
    for (const l of existing) {
      if (l.fabricRef) this.canvas.remove(l.fabricRef);
    }
    this.layers = this.layers.filter(l => l.type !== 'logo');
    await this.addLogoLayer(objectUrl);
    URL.revokeObjectURL(objectUrl);
  }

  // Replace background from file input
  async replaceBackgroundFromFile(file: File): Promise<void> {
    const objectUrl = URL.createObjectURL(file);
    const existing = this.layers.find(l => l.id === 'bg');
    if (existing?.fabricRef) this.canvas.remove(existing.fabricRef);
    this.layers = this.layers.filter(l => l.id !== 'bg');
    await this.addBackgroundImage(objectUrl);
    URL.revokeObjectURL(objectUrl);
  }

  // ─── CTA Layer ───────────────────────────────────
  addCtaLayer(): void {
    const fabric = this.fabricModule;
    const id = 'cta-' + Date.now();

    const textObj = new fabric.Textbox(this.ctaText, {
      fontSize: 28,
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fill: this.ctaTextColor,
      textAlign: 'center',
      width: 220,
      editable: true
    });

    const padding = 16;
    const rx = this.ctaShape === 'pill' ? 28 : this.ctaShape === 'circle' ? 60 : 12;
    const bgRect = new fabric.Rect({
      width: 220 + padding * 2,
      height: 56,
      rx,
      ry: rx,
      fill: this.ctaFill,
      originX: 'center',
      originY: 'center'
    });

    textObj.set({ originX: 'center', originY: 'center' });

    const group = new fabric.Group([bgRect, textObj], {
      left: this.canvasWidth / 2,
      top: this.canvasHeight * 0.85,
      originX: 'center',
      originY: 'center',
      snapAngle: 15
    });
    (group as any)._layerId = id;
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.layers.push({ id, type: 'cta', label: 'CTA Button', fabricRef: group, locked: false, visible: true });
    this.selectedLayerId = id;
    this.activePanel = 'cta';
    this.canvas.renderAll();
  }

  // ─── Overlay Layer ───────────────────────────────
  addOverlayLayer(): void {
    const fabric = this.fabricModule;
    const id = 'overlay-' + Date.now();
    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      width: this.canvasWidth,
      height: this.canvasHeight,
      fill: this.overlayColor,
      opacity: this.overlayOpacity / 100,
      selectable: false,
      evented: false
    });
    (rect as any)._layerId = id;
    const bgIdx = this.canvas.getObjects().findIndex((o: any) => o._layerId === 'bg');
    this.canvas.insertAt(rect, bgIdx + 1);
    this.layers.splice(1, 0, { id, type: 'overlay', label: 'Color Overlay', fabricRef: rect, locked: true, visible: true });
    this.canvas.renderAll();
  }

  updateOverlay(): void {
    const layer = this.layers.find(l => l.type === 'overlay');
    if (!layer?.fabricRef) return;
    layer.fabricRef.set({
      fill: this.overlayColor,
      opacity: this.overlayOpacity / 100
    });
    this.canvas.renderAll();
  }

  // ─── Text Controls ───────────────────────────────
  applyTextProps(): void {
    const layer = this.layers.find(l => l.id === this.selectedLayerId && l.type === 'text');
    if (!layer?.fabricRef) return;
    layer.fabricRef.set({
      fontFamily: this.textFont,
      fontSize: this.textSize,
      fontWeight: this.textWeight,
      fill: this.textColor,
      textAlign: this.textAlign,
      lineHeight: this.lineHeight,
      charSpacing: this.letterSpacing * 10
    });
    if (this.textShadow) {
      layer.fabricRef.set('shadow', new this.fabricModule.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 2, offsetY: 2 }));
    } else {
      layer.fabricRef.set('shadow', null);
    }
    if (this.textOutline) {
      layer.fabricRef.set({ stroke: '#000', strokeWidth: 2 });
    } else {
      layer.fabricRef.set({ stroke: null, strokeWidth: 0 });
    }
    this.canvas.renderAll();
  }

  // ─── Image Controls ──────────────────────────────
  applyImageFilters(): void {
    const bgLayer = this.layers.find(l => l.id === 'bg');
    if (!bgLayer?.fabricRef) return;
    const fabric = this.fabricModule;
    const filters: any[] = [];
    if (this.bgBrightness !== 100) {
      filters.push(new fabric.filters.Brightness({ brightness: (this.bgBrightness - 100) / 100 }));
    }
    if (this.bgContrast !== 100) {
      filters.push(new fabric.filters.Contrast({ contrast: (this.bgContrast - 100) / 100 }));
    }
    if (this.bgSaturation !== 100) {
      filters.push(new fabric.filters.Saturation({ saturation: (this.bgSaturation - 100) / 100 }));
    }
    if (this.bgBlur > 0) {
      filters.push(new fabric.filters.Blur({ blur: this.bgBlur / 100 }));
    }
    bgLayer.fabricRef.filters = filters;
    bgLayer.fabricRef.applyFilters();
    this.canvas.renderAll();
  }

  // ─── Layer Management ────────────────────────────
  toggleLayerVisibility(layer: LayerItem): void {
    layer.visible = !layer.visible;
    if (layer.fabricRef) {
      layer.fabricRef.set('visible', layer.visible);
      this.canvas.renderAll();
    }
  }

  toggleLayerLock(layer: LayerItem): void {
    layer.locked = !layer.locked;
    if (layer.fabricRef) {
      layer.fabricRef.set({
        selectable: !layer.locked,
        evented: !layer.locked
      });
      this.canvas.renderAll();
    }
  }

  bringForward(): void {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.bringObjectForward(obj); this.canvas.renderAll(); }
  }

  sendBackward(): void {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.sendObjectBackwards(obj); this.canvas.renderAll(); }
  }

  deleteSelected(): void {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const layerId = (obj as any)._layerId;
    this.canvas.remove(obj);
    this.layers = this.layers.filter(l => l.id !== layerId);
    this.selectedLayerId = null;
    this.canvas.renderAll();
  }

  selectLayer(layer: LayerItem): void {
    if (layer.locked || !layer.fabricRef) return;
    this.canvas.setActiveObject(layer.fabricRef);
    this.selectedLayerId = layer.id;
    this.canvas.renderAll();
  }

  // ─── Aspect Ratio Change ─────────────────────────
  changeAspectRatio(ratioId: string): void {
    const ratio = ASPECT_RATIOS[ratioId];
    if (!ratio) return;
    this.aspectRatio = ratioId;
    this.canvasWidth = ratio.w;
    this.canvasHeight = ratio.h;
    this.canvas.setDimensions({ width: ratio.w, height: ratio.h });
    this.updateDisplayScale();
    this.canvas.renderAll();
  }

  // ─── File input handlers ─────────────────────────
  onLogoFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadLogoFromFile(file);
    // Reset input so the same file can be re-selected
    (event.target as HTMLInputElement).value = '';
  }

  onBgFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.replaceBackgroundFromFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ─── Templates ───────────────────────────────────
  loadTemplates(): void {
    this.templatesLoading = true;
    this.http.get<any>(`${environment.apiUrl}/post-templates`).subscribe({
      next: (res) => {
        this.templates = res.data || [];
        this.templatesLoading = false;
      },
      error: () => { this.templatesLoading = false; }
    });
  }

  applyTemplate(template: any): void {
    if (!template?.canvasState || !this.canvas) return;
    const state = template.canvasState;

    if (template.aspectRatio) {
      this.changeAspectRatio(template.aspectRatio);
    }

    if (state.backgroundColor) {
      this.canvas.backgroundColor = state.backgroundColor;
    }

    const bgObj = this.layers.find(l => l.id === 'bg');

    const nonBgLayers = this.layers.filter(l => l.id !== 'bg');
    for (const l of nonBgLayers) {
      if (l.fabricRef) this.canvas.remove(l.fabricRef);
    }
    this.layers = bgObj ? [bgObj] : [];

    if (state.objects?.length) {
      const fabric = this.fabricModule;
      for (const obj of state.objects) {
        if (obj.type === 'textbox') {
          const t = new fabric.Textbox(obj.text || '', {
            ...obj,
            snapAngle: 15,
            editable: true
          });
          const id = 'tmpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          (t as any)._layerId = id;
          this.canvas.add(t);
          this.layers.push({
            id,
            type: 'text',
            label: (obj.text || '').slice(0, 20) || 'Text',
            fabricRef: t,
            locked: false,
            visible: true
          });
        }
      }
    }
    this.canvas.renderAll();
  }

  // ─── Export ──────────────────────────────────────
  exportCanvas(): void {
    const multiplier = 2;
    const dataUrl = this.canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier
    });
    this.editorDone.emit({
      dataUrl,
      width: this.canvasWidth * multiplier,
      height: this.canvasHeight * multiplier
    });
  }

  cancel(): void {
    this.editorCancel.emit();
  }
}
