export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  currency?: string;
  photo?: string | null;
  stock?: number;
  category_slug?: string | null;
  rating?: number;
  variants?: any;
}

export interface OrderItemData {
  product_name: string;
  product_sku: string;
  product_photo?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant?: any;
}

export interface OrderStatusData {
  order_number: string;
  buyer_name: string;
  order_status: "ORDER_PLACED" | "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | string;
  payment_status: string;
  shipping_method?: string;
  shipping_eta?: string;
  tracking_number?: string;
  carrier_name?: string;
  total: number;
  currency?: string;
  created_at: string;
  items?: OrderItemData[];
  progress_percentage?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductCardData[];
  orderStatus?: OrderStatusData;
  quickSuggestions?: string[];
  timestamp: string;
}
