import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

/**
 * Loader Service
 * Uses a request counter so nested/parallel calls are handled correctly:
 *  - any call starts  → counter++
 *  - any call finishes → counter--
 *  - loader visible when counter > 0
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private activeRequests = new BehaviorSubject<number>(0);

  /** True while at least one HTTP request is in-flight */
  readonly loading$: Observable<boolean> = this.activeRequests.pipe(
    map(n => n > 0),
    distinctUntilChanged()
  );

  increment(): void {
    this.activeRequests.next(this.activeRequests.value + 1);
  }

  decrement(): void {
    const next = this.activeRequests.value - 1;
    this.activeRequests.next(next < 0 ? 0 : next);
  }

  /** Force-reset (e.g. on route change) */
  reset(): void {
    this.activeRequests.next(0);
  }
}
