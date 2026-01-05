import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { KnowledgeBaseService, IKnowledgeBase } from '../../core/services/knowledge-base.service';

/**
 * Knowledge Base Component - Single Responsibility Principle
 * Manages AI training knowledge base with multiple input methods
 */
@Component({
  selector: 'app-knowledge-base',
  templateUrl: './knowledge-base.component.html',
  styleUrls: ['./knowledge-base.component.scss']
})
export class KnowledgeBaseComponent implements OnInit {
  // UI State
  activeTab: 'list' | 'manual' | 'pdf' | 'url' = 'list';
  showAddModal = false;
  selectedEntry: IKnowledgeBase | null = null;
  loading = false;
  submitting = false;

  // Data
  knowledgeBase: IKnowledgeBase[] = [];
  categories: string[] = [];
  filteredKnowledgeBase: IKnowledgeBase[] = [];

  // Forms
  manualForm!: FormGroup;
  pdfForm!: FormGroup;
  urlForm!: FormGroup;
  selectedFile: File | null = null;

  // Filters
  searchTerm = '';
  filterCategory = '';
  filterSource = '';

  // Predefined options
  typeOptions = [
    { value: 'faq', label: 'FAQ', icon: 'fa-question-circle' },
    { value: 'product_info', label: 'Product Info', icon: 'fa-box' },
    { value: 'policy', label: 'Policy', icon: 'fa-file-contract' },
    { value: 'brand_voice', label: 'Brand Voice', icon: 'fa-bullhorn' },
    { value: 'procedure', label: 'Procedure', icon: 'fa-tasks' },
    { value: 'general', label: 'General', icon: 'fa-info-circle' }
  ];

  sourceOptions = [
    { value: 'manual', label: 'Manual Entry', icon: 'fa-keyboard' },
    { value: 'pdf', label: 'PDF Upload', icon: 'fa-file-pdf' },
    { value: 'url', label: 'Website URL', icon: 'fa-globe' }
  ];

  constructor(
    private fb: FormBuilder,
    private knowledgeBaseService: KnowledgeBaseService
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadKnowledgeBase();
    this.loadCategories();
  }

  /**
   * Initialize all forms
   */
  initForms(): void {
    // Manual entry form
    this.manualForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      content: ['', [Validators.required, Validators.minLength(10)]],
      type: ['general'],
      category: [''],
      tags: [''],
      priority: [5, [Validators.min(1), Validators.max(10)]],
      trainingContext: [''],
      trainingWeight: [5, [Validators.min(1), Validators.max(10)]],
      isTrainingData: [true],
      isActive: [true]
    });

    // PDF upload form
    this.pdfForm = this.fb.group({
      title: [''],
      category: [''],
      tags: [''],
      priority: [5, [Validators.min(1), Validators.max(10)]]
    });

    // URL scraping form
    this.urlForm = this.fb.group({
      url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      title: [''],
      category: [''],
      tags: [''],
      priority: [5, [Validators.min(1), Validators.max(10)]]
    });
  }

  /**
   * Load all knowledge base entries
   */
  loadKnowledgeBase(): void {
    this.loading = true;
    this.knowledgeBaseService.getAllKnowledgeBase().subscribe({
      next: (response) => {
        if (response.success) {
          this.knowledgeBase = response.data.knowledgeBase || [];
          this.applyFilters();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /**
   * Load categories
   */
  loadCategories(): void {
    this.knowledgeBaseService.getCategories().subscribe({
      next: (response) => {
        if (response.success) {
          this.categories = response.data || [];
        }
      }
    });
  }

  /**
   * Apply search and filters
   */
  applyFilters(): void {
    this.filteredKnowledgeBase = this.knowledgeBase.filter(item => {
      const matchesSearch = !this.searchTerm || 
        item.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.content.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesCategory = !this.filterCategory || item.category === this.filterCategory;
      const matchesSource = !this.filterSource || item.source === this.filterSource;

      return matchesSearch && matchesCategory && matchesSource;
    });
  }

  /**
   * Submit manual knowledge base
   */
  submitManual(): void {
    if (this.manualForm.invalid) return;

    this.submitting = true;
    const formData = { ...this.manualForm.value };
    
    // Convert tags string to array
    if (formData.tags) {
      formData.tags = formData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
    }

    this.knowledgeBaseService.createManual(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.manualForm.reset({ priority: 5, trainingWeight: 5, isTrainingData: true, isActive: true });
          this.loadKnowledgeBase();
          this.activeTab = 'list';
        }
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      // Auto-fill title with filename if empty
      if (!this.pdfForm.get('title')?.value) {
        this.pdfForm.patchValue({
          title: file.name.replace('.pdf', '')
        });
      }
    } else {
      alert('Please select a PDF file');
      event.target.value = '';
    }
  }

  /**
   * Submit PDF upload
   */
  submitPDF(): void {
    if (!this.selectedFile) {
      alert('Please select a PDF file');
      return;
    }

    this.submitting = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    
    // Add other form fields
    const formValues = this.pdfForm.value;
    if (formValues.title) formData.append('title', formValues.title);
    if (formValues.category) formData.append('category', formValues.category);
    if (formValues.tags) formData.append('tags', JSON.stringify(formValues.tags.split(',').map((t: string) => t.trim())));
    formData.append('priority', formValues.priority.toString());

    this.knowledgeBaseService.createFromPDF(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.pdfForm.reset({ priority: 5 });
          this.selectedFile = null;
          this.loadKnowledgeBase();
          this.activeTab = 'list';
        }
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  /**
   * Submit URL scraping
   */
  submitURL(): void {
    if (this.urlForm.invalid) return;

    this.submitting = true;
    const formData = { ...this.urlForm.value };
    
    // Convert tags string to array
    if (formData.tags) {
      formData.tags = formData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
    }

    this.knowledgeBaseService.createFromURL(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.urlForm.reset({ priority: 5 });
          this.loadKnowledgeBase();
          this.activeTab = 'list';
        }
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  /**
   * Delete knowledge base entry
   */
  deleteEntry(id: string): void {
    if (!confirm('Are you sure you want to delete this knowledge base entry?')) return;

    this.knowledgeBaseService.delete(id).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadKnowledgeBase();
        }
      }
    });
  }

  /**
   * Toggle entry active status
   */
  toggleActive(entry: IKnowledgeBase): void {
    this.knowledgeBaseService.update(entry._id, { isActive: !entry.isActive }).subscribe({
      next: (response) => {
        if (response.success) {
          entry.isActive = !entry.isActive;
        }
      }
    });
  }

  /**
   * Get source icon
   */
  getSourceIcon(source: string): string {
    const icons: { [key: string]: string } = {
      manual: 'fa-keyboard',
      pdf: 'fa-file-pdf',
      url: 'fa-globe',
      import: 'fa-file-import'
    };
    return icons[source] || 'fa-question';
  }

  /**
   * Get source color
   */
  getSourceColor(source: string): string {
    const colors: { [key: string]: string } = {
      manual: 'bg-blue-100 text-blue-800',
      pdf: 'bg-red-100 text-red-800',
      url: 'bg-green-100 text-green-800',
      import: 'bg-purple-100 text-purple-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Format date
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
}
