export interface Media {
  _id: string;
  filename: string;
  originalName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio';
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  organization: string;
  usageCount: number;
  lastUsedAt?: Date;
  tags: string[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaUploadRequest {
  media: File;
  tags?: string[];
  description?: string;
}

export interface MediaLibraryParams {
  mediaType?: 'image' | 'video' | 'audio';
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
}

export interface MediaLibraryResponse {
  success: boolean;
  data: Media[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MediaStatsResponse {
  success: boolean;
  data: {
    byType: {
      image?: {
        count: number;
        totalSize: number;
      };
      video?: {
        count: number;
        totalSize: number;
      };
    };
    total: {
      count: number;
      size: number;
      sizeFormatted: string;
    };
  };
}
