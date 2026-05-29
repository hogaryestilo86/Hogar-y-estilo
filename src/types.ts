/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductMedia {
  type: "image" | "video";
  url: string;
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  category: string;
  media: ProductMedia[];
  reviews: ProductReview[];
  features: string[];
  isCustom?: boolean;
  featured?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zipCode: string;
  paymentMethod: "credit" | "debit" | "transfer";
  installments?: number;
}

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  cbu: string;
  alias: string;
  cuit: string;
}

