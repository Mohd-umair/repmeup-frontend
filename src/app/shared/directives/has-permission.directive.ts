import {
  Directive, Input, TemplateRef, ViewContainerRef,
  OnInit, OnDestroy
} from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Structural directive that shows/hides elements based on permissions.
 *
 * Usage:
 *   <button *appHasPermission="'inbox.reply'">Reply</button>
 *   <div *appHasPermission="['posts.create', 'posts.update']">...</div>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  @Input('appHasPermission') permission: string | string[] = '';

  private shown = false;
  private sub?: Subscription;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    this.sub = this.permissionService.permissions$.subscribe(() => this.updateView());
  }

  private updateView(): void {
    const codes = Array.isArray(this.permission) ? this.permission : [this.permission];
    const allowed = this.permissionService.hasAnyPermission(codes);

    if (allowed && !this.shown) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.shown = true;
    } else if (!allowed && this.shown) {
      this.viewContainer.clear();
      this.shown = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
