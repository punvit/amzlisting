// Shared application types (Phase 1)

export type Plan = "free" | "starter" | "pro" | "business";

export type ListingStatus = "pending" | "processing" | "complete" | "error";

export type ListingImageType =
  | "white_bg"
  | "lifestyle_1"
  | "lifestyle_2"
  | "lifestyle_3"
  | "lifestyle_4";

export interface Profile {
  id: string;
  plan: Plan;
  credits_remaining: number;
  created_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  product_name: string | null;
  original_image_url: string | null;
  status: ListingStatus;
  created_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  type: ListingImageType;
  image_url: string | null;
  created_at: string;
}

export interface ListingCopy {
  id: string;
  listing_id: string;
  title: string | null;
  bullet_1: string | null;
  bullet_2: string | null;
  bullet_3: string | null;
  bullet_4: string | null;
  bullet_5: string | null;
  description: string | null;
  search_terms: string | null;
  created_at: string;
}
