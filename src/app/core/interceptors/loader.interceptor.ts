import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../services/loader.service';

/**
 * Loader Interceptor
 * Wraps every outgoing HTTP request and updates LoaderService counter.
 * Works correctly with parallel and nested requests because it uses a counter,
 * not a simple boolean.
 *
 * Requests to skip (polling, background syncs, unread-count pings) can be
 * opted out by adding the header  X-Skip-Loader: true  at call site.
 */
@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor(private loaderService: LoaderService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Allow individual calls to opt out (e.g. background polling)
    if (request.headers.has('X-Skip-Loader')) {
      const stripped = request.clone({ headers: request.headers.delete('X-Skip-Loader') });
      return next.handle(stripped);
    }

    this.loaderService.increment();

    return next.handle(request).pipe(
      finalize(() => this.loaderService.decrement())
    );
  }
}
