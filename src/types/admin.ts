export interface Listing {
  id: string;
  title: string;
  type: string;
  source: 'business' | 'housing' | 'travel';
  price?: number | string;
  posterName: string;
  posterId: string;
  isDisabled?: boolean;
  verified?: boolean;
  createdAt?: any;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  city?: string;
  isAdmin?: boolean;
  createdAt?: any;
  heritage?: string | string[];
  accountType?: string;
  businessName?: string;
  businessType?: string;
  adminReviewRequired?: boolean;
  adminApproved?: boolean;
  phone?: string;
  tinNumber?: string;
  tinValidationStatus?: string;
  verificationDocUrls?: string[];
  photoIdUrl?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt?: any;
}

export interface ModerationReporter {
  uid: string;
  name: string;
  avatar: string;
  category: string;
  details: string;
  createdAt: string;
}

export interface ModerationItem {
  id: string;
  content: string;
  contentId?: string;
  collection?: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  images?: string[];
  type: string;
  category?: string;
  categoryLabel?: string;
  reason?: string;
  reportedBy?: string;
  reporterName?: string;
  reporterAvatar?: string;
  reportCount?: number;
  reporters?: ModerationReporter[];
  createdAt?: any;
}

export interface EventRecord {
  id: string;
  title: string;
  type: string;
  fullDate: string;
  posterName: string;
  posterId: string;
  promoted: boolean;
  isDisabled?: boolean;
  location?: string;
  ticket?: string;
  price?: string;
  createdAt?: any;
}
