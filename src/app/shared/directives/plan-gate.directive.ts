import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect
} from '@angular/core';
import { EntitlementsStore, FeatureKey } from '../../core/services/entitlements.store';

/**
 * Structural directive — renders content only when plan allows the feature.
 * Usage: *appPlanGate="FEATURE_KEY.CAMPAIGNS_ENABLED"
 */
@Directive({
  selector: '[appPlanGate]',
  standalone: true
})
export class PlanGateDirective {
  private readonly ent = inject(EntitlementsStore);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private featureKey: FeatureKey | null = null;

  @Input({ required: true }) set appPlanGate(key: FeatureKey) {
    this.featureKey = key;
    this.render();
  }

  constructor() {
    effect(() => {
      this.ent.snapshot();
      this.render();
    });
  }

  private render(): void {
    if (!this.featureKey) {
      this.viewContainer.clear();
      return;
    }
    const allowed = this.ent.can(this.featureKey);
    this.viewContainer.clear();
    if (allowed) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
