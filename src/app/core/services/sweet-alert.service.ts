import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  constructor() { }

  /**
   * Show a success message
   */
  success(title: string, message?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: message,
      confirmButtonColor: '#c0ff00',
      confirmButtonText: 'OK',
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn'
      }
    });
  }

  /**
   * Show an error message
   */
  error(title: string, message?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: message,
      confirmButtonColor: '#c0ff00',
      confirmButtonText: 'OK',
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn'
      }
    });
  }

  /**
   * Show a warning message
   */
  warning(title: string, message?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: message,
      confirmButtonColor: '#c0ff00',
      confirmButtonText: 'OK',
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn'
      }
    });
  }

  /**
   * Show an info message
   */
  info(title: string, message?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'info',
      title: title,
      text: message,
      confirmButtonColor: '#c0ff00',
      confirmButtonText: 'OK',
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn'
      }
    });
  }

  /**
   * Show a confirmation dialog
   */
  confirm(
    title: string,
    message?: string,
    confirmButtonText: string = 'Yes',
    cancelButtonText: string = 'Cancel'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#c0ff00',
      cancelButtonColor: '#6b7280',
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn'
      }
    });
  }

  /**
   * Show a delete confirmation dialog
   */
  confirmDelete(
    title: string = 'Are you sure?',
    message: string = "You won't be able to revert this!"
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-delete-btn',
        cancelButton: 'swal-cancel-btn'
      }
    });
  }

  /**
   * Show a confirmation dialog with arbitrary HTML body content.
   * Use sparingly — only for rich summaries (e.g. publish confirmation).
   */
  confirmHtml(
    title: string,
    html: string,
    confirmButtonText: string = 'Confirm',
    cancelButtonText: string = 'Cancel'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      html,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#c0ff00',
      cancelButtonColor: '#6b7280',
      confirmButtonText,
      cancelButtonText,
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn',
        htmlContainer: 'swal-html-container'
      }
    });
  }

  /**
   * Show a toast notification (small popup at the top)
   */
  toast(
    icon: SweetAlertIcon,
    title: string,
    position: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end' = 'top-end',
    timer: number = 3000
  ): void {
    const Toast = Swal.mixin({
      toast: true,
      position: position,
      showConfirmButton: false,
      timer: timer,
      timerProgressBar: true,
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-toast-dark'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });

    Toast.fire({
      icon: icon,
      title: title
    });
  }

  /**
   * Show a loading spinner
   */
  showLoading(title: string = 'Loading...', message?: string): void {
    Swal.fire({
      title: title,
      text: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#1a1a1a',
      color: '#ffffff',
      customClass: {
        popup: 'swal-dark-theme'
      },
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Close the current SweetAlert
   */
  close(): void {
    Swal.close();
  }

  /**
   * Show a custom HTML content dialog
   */
  custom(options: any): Promise<SweetAlertResult> {
    const defaultOptions = {
      background: '#1a1a1a',
      color: '#ffffff',
      confirmButtonColor: '#c0ff00',
      customClass: {
        popup: 'swal-dark-theme',
        confirmButton: 'swal-confirm-btn'
      }
    };

    return Swal.fire({ ...defaultOptions, ...options });
  }
}
