import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { IProduct, ICommentToDmSettings, ICommentFollowInviteSettings, ISalesFlowSettings } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private api: ApiService) {}

  getProducts(params?: { search?: string; isActive?: boolean; page?: number; limit?: number }): Observable<IApiResponse<{ products: IProduct[]; total: number }>> {
    return this.api.get('/products', params);
  }

  getProduct(id: string): Observable<IApiResponse<IProduct>> {
    return this.api.get(`/products/${id}`);
  }

  createProduct(data: Partial<IProduct>): Observable<IApiResponse<IProduct>> {
    return this.api.post('/products', data);
  }

  updateProduct(id: string, data: Partial<IProduct>): Observable<IApiResponse<IProduct>> {
    return this.api.put(`/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<IApiResponse<void>> {
    return this.api.delete(`/products/${id}`);
  }

  linkPost(productId: string, postId: string): Observable<IApiResponse<IProduct>> {
    return this.api.post(`/products/${productId}/posts`, { postId });
  }

  unlinkPost(productId: string, postId: string): Observable<IApiResponse<IProduct>> {
    // Send postId in the request body to avoid URL-encoding issues with full URLs stored as IDs
    return this.api.post(`/products/${productId}/posts/unlink`, { postId });
  }

  getProductsByPost(postId: string): Observable<IApiResponse<IProduct[]>> {
    return this.api.get(`/products/by-post/${postId}`);
  }

  getCommentToDmSettings(): Observable<IApiResponse<ICommentToDmSettings>> {
    return this.api.get('/products/settings/comment-to-dm');
  }

  updateCommentToDmSettings(data: Partial<ICommentToDmSettings>): Observable<IApiResponse<ICommentToDmSettings>> {
    return this.api.put('/products/settings/comment-to-dm', data);
  }

  getCommentFollowInviteSettings(): Observable<IApiResponse<ICommentFollowInviteSettings>> {
    return this.api.get('/products/settings/comment-follow-invite');
  }

  updateCommentFollowInviteSettings(
    data: Partial<ICommentFollowInviteSettings>
  ): Observable<IApiResponse<ICommentFollowInviteSettings>> {
    return this.api.put('/products/settings/comment-follow-invite', data);
  }

  getSalesFlowSettings(): Observable<IApiResponse<ISalesFlowSettings>> {
    return this.api.get('/products/settings/sales-flow');
  }

  updateSalesFlowSettings(data: Partial<ISalesFlowSettings>): Observable<IApiResponse<ISalesFlowSettings>> {
    return this.api.put('/products/settings/sales-flow', data);
  }

  backfillPostNumericIds(): Observable<IApiResponse<{ resolved: number; skipped: number; failed: number; details: { product: string; shortcode: string; numericId: string }[] }>> {
    return this.api.post('/products/backfill-post-ids', {});
  }

  resolvePostId(postId: string): Observable<IApiResponse<{ shortcode: string | null; numericId: string; alreadyNumeric?: boolean }>> {
    return this.api.get('/products/resolve-post', { postId });
  }

  importProducts(file: File): Observable<IApiResponse<IImportSummary>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm('/products/import', formData);
  }

  importFromWooCommerce(storeUrl: string, consumerKey: string, consumerSecret: string): Observable<IApiResponse<IImportSummary>> {
    return this.api.post('/products/import/woocommerce', { storeUrl, consumerKey, consumerSecret });
  }

  importFromShopify(storeDomain: string, accessToken: string): Observable<IApiResponse<IImportSummary>> {
    return this.api.post('/products/import/shopify', { storeDomain, accessToken });
  }

  importFromUrl(url: string, authHeader?: string): Observable<IApiResponse<IImportSummary>> {
    return this.api.post('/products/import/url', { url, authHeader: authHeader || undefined });
  }
}

export interface IImportSummary {
  upsertedCount: number;
  modifiedCount: number;
  matchedCount: number;
  totalProcessed: number;
}
