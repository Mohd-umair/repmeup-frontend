# Frontend Memory Leaks Audit

This document summarizes the memory leak audit performed on the Angular frontend and the fixes applied.

## What Was Fixed (Critical Leaks)

### 1. **Analytics Component** (`features/analytics/analytics.component.ts`)
- **Issue:** `setInterval()` was used for auto-refresh and **never cleared** in `ngOnDestroy`. The interval kept running after leaving the page.
- **Fix:** Replaced with RxJS `interval()`. The subscription is stored in `refreshSubscription` and unsubscribed in `ngOnDestroy`.

### 2. **Header Component** (`shared/components/header/header.component.ts`)
- **Issue:** `authService.currentUser$.subscribe(...)` was not added to the `subscriptions` array, so it was never unsubscribed.
- **Fix:** Subscriptions array already existed; the `currentUser$` subscription is now pushed to it and cleaned up in `ngOnDestroy`.

### 3. **Sidebar Component** (`shared/components/sidebar/sidebar.component.ts`)
- **Issue:** `menuService.loadMenus().subscribe(...)` was not unsubscribed. If the user navigated away before the request completed, the callback could run on a destroyed component.
- **Fix:** The subscription is now pushed to `subscriptions` and unsubscribed in `ngOnDestroy`.

### 4. **Settings Component** (`features/settings/settings.component.ts`)
- **Issue:** Long-lived subscriptions were never unsubscribed: `currentUser$`, `subscriptionLimits$`, and `route.queryParams`.
- **Fix:** Added a `subscriptions` array, pushed all three subscriptions in `ngOnDestroy`, and called `subscriptions.forEach(sub => sub.unsubscribe())` in `ngOnDestroy` (along with existing `stopPolling()`).

### 5. **Inbox Container Component** (`features/inbox/inbox-container/inbox-container.component.ts`)
- **Issue:** `inboxService.interactions$.subscribe(...)` and `inboxService.selectedInteraction$.subscribe(...)` were never unsubscribed.
- **Fix:** Added a `subscriptions` array and pushed both subscriptions. In `ngOnDestroy`, all subscriptions are unsubscribed in addition to the existing `autoSyncSubscription` cleanup.

### 6. **Inbox List Component** (`features/inbox/inbox-list/inbox-list.component.ts`)
- **Issue:** The debounced search pipeline `searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(...)` was never unsubscribed. Only `searchSubject.complete()` was called in `ngOnDestroy`.
- **Fix:** The pipe subscription is stored in `searchSubscription` and unsubscribed in `ngOnDestroy` before completing the subject.

---

## Components That Are Already Safe

- **Notification Component:** Clears all timeouts in `ngOnDestroy` and unsubscribes from the notification stream.
- **Inbox Detail Component:** Uses a `subscriptions` array and unsubscribes in `ngOnDestroy`.
- **Home Component:** Stores `userSubscription` and unsubscribes in `ngOnDestroy`.
- **Platform Connection Service:** Implements `ngOnDestroy` and stops polling.
- **Inbox Detail – markNotificationsAsRead:** Subscribes then immediately unsubscribes (one-off); could be refactored to `take(1)` but not a leak.

---

## Lower-Priority / One-Off HTTP Subscriptions

Many components use one-off HTTP calls like `this.http.get(...).subscribe({ ... })` without unsubscribing. HTTP observables **complete after one emission**, so they do not leak in the same way as long-lived streams. However, if the component is destroyed before the request completes, the `next`/`error` callback may run on a destroyed component (potential "run after destroy" bugs). For consistency and safety, consider:

- Using `takeUntil(destroy$)` with a subject that completes in `ngOnDestroy`, or
- Storing the subscription and unsubscribing in `ngOnDestroy`

Affected areas (non-exhaustive): **publish**, **knowledge-base**, **plans**, **calendar**, **published-posts**, **agents**, **meta-page-selector**, **media-upload-guide**, **google-callback**, **inbox-container** (methods like `loadInteractions`, `getInteraction`, etc.).

---

## Best Practices Going Forward

1. **Long-lived observables** (e.g. `BehaviorSubject`, `route.params`, `interval`): Always unsubscribe in `ngOnDestroy` (e.g. via a `subscriptions` array or `takeUntil(destroy$)`).
2. **Timers:** Prefer RxJS `interval()`/`timer()` over `setInterval`/`setTimeout` when you need to cancel on destroy; otherwise store the handle and clear it in `ngOnDestroy`.
3. **One-off HTTP calls:** Prefer `takeUntil(destroy$)` or storing the subscription and unsubscribing in `ngOnDestroy` to avoid running logic after the component is destroyed.
