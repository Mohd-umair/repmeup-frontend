import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  contactForm: FormGroup;
  submitted = false;
  loading = false;
  success = false;
  error = false;

  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]],
      company: ['']
    });
  }

  onSubmit(): void {
    this.submitted = true;
    
    if (this.contactForm.valid) {
      this.loading = true;
      this.error = false;
      this.success = false;

      // TODO: Integrate with backend API
      // For now, simulate API call
      setTimeout(() => {
        console.log('Contact form submitted:', this.contactForm.value);
        this.loading = false;
        this.success = true;
        this.contactForm.reset();
        this.submitted = false;
        
        // Hide success message after 5 seconds
        setTimeout(() => {
          this.success = false;
        }, 5000);
      }, 1000);
    }
  }

  get f() {
    return this.contactForm.controls;
  }

  getFieldError(fieldName: string): string {
    const field = this.f[fieldName];
    if (field?.errors && this.submitted) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }
}
