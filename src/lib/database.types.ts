// Generated from supabase/schema.sql + migrations/001…013.
// Re-generate against a live project with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: Database['public']['Enums']['user_role'];
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database['public']['Enums']['user_role'];
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database['public']['Enums']['user_role'];
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          compare_at_price: number | null;
          cost_price: number | null;
          sku: string | null;
          stock_quantity: number;
          low_stock_threshold: number;
          weight_grams: number | null;
          is_active: boolean;
          is_featured: boolean;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          sku?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          weight_grams?: number | null;
          is_active?: boolean;
          is_featured?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price?: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          sku?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          weight_grams?: number | null;
          is_active?: boolean;
          is_featured?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          size: string;
          sku: string | null;
          stock_qty: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          size: string;
          sku?: string | null;
          stock_qty?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          size?: string;
          sku?: string | null;
          stock_qty?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      product_reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          body: string | null;
          author_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          body?: string | null;
          author_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string;
          rating?: number;
          body?: string | null;
          author_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_reviews_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      shipping_methods: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          estimated_days_min: number | null;
          estimated_days_max: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price?: number;
          estimated_days_min?: number | null;
          estimated_days_max?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          estimated_days_min?: number | null;
          estimated_days_max?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          phone: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          line1: string;
          line2?: string | null;
          city: string;
          state: string;
          postal_code: string;
          country?: string;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          line1?: string;
          line2?: string | null;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          status: Database['public']['Enums']['order_status'];
          subtotal: number;
          shipping_cost: number;
          tax_amount: number;
          discount_amount: number;
          total: number;
          shipping_address: Json;
          shipping_method_id: string | null;
          shipping_method_name: string | null;
          stripe_payment_intent_id: string | null;
          stripe_session_id: string | null;
          tracking_id: string | null;
          tracking_updated_at: string | null;
          refund_id: string | null;
          refund_amount: number | null;
          refunded_at: string | null;
          delivered_at: string | null;
          needs_review: boolean;
          review_reason: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: Database['public']['Enums']['order_status'];
          subtotal: number;
          shipping_cost?: number;
          tax_amount?: number;
          discount_amount?: number;
          total: number;
          shipping_address: Json;
          shipping_method_id?: string | null;
          shipping_method_name?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          tracking_id?: string | null;
          tracking_updated_at?: string | null;
          refund_id?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          delivered_at?: string | null;
          needs_review?: boolean;
          review_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['order_status'];
          subtotal?: number;
          shipping_cost?: number;
          tax_amount?: number;
          discount_amount?: number;
          total?: number;
          shipping_address?: Json;
          shipping_method_id?: string | null;
          shipping_method_name?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          tracking_id?: string | null;
          tracking_updated_at?: string | null;
          refund_id?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          delivered_at?: string | null;
          needs_review?: boolean;
          review_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_shipping_method_id_fkey';
            columns: ['shipping_method_id'];
            isOneToOne: false;
            referencedRelation: 'shipping_methods';
            referencedColumns: ['id'];
          }
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_image: string | null;
          unit_price: number;
          quantity: number;
          total_price: number;
          selected_size: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_image?: string | null;
          unit_price: number;
          quantity: number;
          total_price: number;
          selected_size?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          product_image?: string | null;
          unit_price?: number;
          quantity?: number;
          total_price?: number;
          selected_size?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      processed_stripe_events: {
        Row: {
          event_id: string;
          event_type: string;
          processed_at: string;
          order_id: string | null;
        };
        Insert: {
          event_id: string;
          event_type: string;
          processed_at?: string;
          order_id?: string | null;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          processed_at?: string;
          order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'processed_stripe_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_my_role: {
        Args: Record<string, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      has_purchased: {
        Args: { p_product_id: string };
        Returns: boolean;
      };
      admin_analytics: {
        Args: Record<string, never>;
        Returns: Json;
      };
      expire_stale_pending_orders: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      order_status:
        | 'pending'
        | 'processing'
        | 'requires_action'
        | 'paid'
        | 'failed'
        | 'cancelled'
        | 'shipped'
        | 'delivered'
        | 'refunded';
      user_role: 'customer' | 'admin';
    };
  };
};
