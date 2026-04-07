import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { IProduct, ICommentToDmSettings } from '../models/product.model';

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
    return this.api.delete(`/products/${productId}/posts/${postId}`);
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
}
