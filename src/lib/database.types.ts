// Generated from the live schema (supabase/schema.sql + migrations/001…025).
// Re-generate after a migration with:
//   npx supabase gen types typescript --linked --schema public > src/lib/database.types.ts
// (then put this header back).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          size_guide_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          size_guide_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          size_guide_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_size_guide_id_fkey"
            columns: ["size_guide_id"]
            isOneToOne: false
            referencedRelation: "size_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_attempts: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          applies_to: string
          category_ids: string[]
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          exclude_sale_items: boolean
          id: string
          is_active: boolean
          kind: string
          min_subtotal: number
          per_customer_limit: number | null
          product_ids: string[]
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          value: number
        }
        Insert: {
          applies_to?: string
          category_ids?: string[]
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          exclude_sale_items?: boolean
          id?: string
          is_active?: boolean
          kind: string
          min_subtotal?: number
          per_customer_limit?: number | null
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          value?: number
        }
        Update: {
          applies_to?: string
          category_ids?: string[]
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          exclude_sale_items?: boolean
          id?: string
          is_active?: boolean
          kind?: string
          min_subtotal?: number
          per_customer_limit?: number | null
          product_ids?: string[]
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          amount: number
          created_at: string
          discount_id: string
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          discount_id: string
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          discount_id?: string
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          detail: string | null
          id: number
          note: string | null
          order_id: string | null
          product_id: string
          reason: string
          stock_after: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          detail?: string | null
          id?: never
          note?: string | null
          order_id?: string | null
          product_id: string
          reason: string
          stock_after: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          detail?: string | null
          id?: never
          note?: string | null
          order_id?: string | null
          product_id?: string
          reason?: string
          stock_after?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      low_stock_alert_state: {
        Row: {
          alerted_at: string
          product_id: string
          variant_id: string | null
        }
        Insert: {
          alerted_at?: string
          product_id: string
          variant_id?: string | null
        }
        Update: {
          alerted_at?: string
          product_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alert_state_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alert_state_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json | null
          id: number
          kind: string
          message: string | null
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: never
          kind: string
          message?: string | null
          order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: never
          kind?: string
          message?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_costs: {
        Row: {
          order_item_id: string
          unit_cost: number
        }
        Insert: {
          order_item_id: string
          unit_cost: number
        }
        Update: {
          order_item_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_costs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          order_id: string
          product_id: string
          product_image: string | null
          product_name: string
          quantity: number
          refunded_quantity: number
          restocked_quantity: number
          selected_color: string | null
          selected_size: string | null
          sku: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          order_id: string
          product_id: string
          product_image?: string | null
          product_name: string
          quantity: number
          refunded_quantity?: number
          restocked_quantity?: number
          selected_color?: string | null
          selected_size?: string | null
          sku?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string
          product_id?: string
          product_image?: string | null
          product_name?: string
          quantity?: number
          refunded_quantity?: number
          restocked_quantity?: number
          selected_color?: string | null
          selected_size?: string | null
          sku?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount: number
          applied_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lines: Json
          order_id: string
          reason: string | null
          shipping_amount: number
          source: string
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          order_id: string
          reason?: string | null
          shipping_amount?: number
          source?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          order_id?: string
          reason?: string | null
          shipping_amount?: number
          source?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivered_at: string | null
          discount_amount: number
          discount_code: string | null
          discount_id: string | null
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          needs_review: boolean
          notes: string | null
          refund_amount: number | null
          refund_id: string | null
          refund_requested_by: string | null
          refunded_at: string | null
          review_reason: string | null
          shipping_address: Json
          shipping_cost: number
          shipping_discount: number
          shipping_method_id: string | null
          shipping_method_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          tracking_id: string | null
          tracking_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_id?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          needs_review?: boolean
          notes?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refund_requested_by?: string | null
          refunded_at?: string | null
          review_reason?: string | null
          shipping_address: Json
          shipping_cost?: number
          shipping_discount?: number
          shipping_method_id?: string | null
          shipping_method_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal: number
          tax_amount?: number
          total: number
          tracking_id?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_id?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          needs_review?: boolean
          notes?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refund_requested_by?: string | null
          refunded_at?: string | null
          review_reason?: string | null
          shipping_address?: Json
          shipping_cost?: number
          shipping_discount?: number
          shipping_method_id?: string | null
          shipping_method_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          tracking_id?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_refund_requested_by_fkey"
            columns: ["refund_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          event_type: string
          order_id: string | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          order_id?: string | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          order_id?: string | null
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_stripe_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          product_id: string
          sort_order: number
          swatch: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          product_id: string
          sort_order?: number
          swatch?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
          sort_order?: number
          swatch?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          color_id: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: string | null
          color_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: string | null
          color_id?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_costs: {
        Row: {
          cost_price: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cost_price: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cost_price?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color_id: string | null
          created_at: string
          id: string
          is_active: boolean
          price: number | null
          product_id: string
          size: string | null
          sku: string | null
          sort_order: number
          stock_qty: number
          updated_at: string
        }
        Insert: {
          color_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number | null
          product_id: string
          size?: string | null
          sku?: string | null
          sort_order?: number
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          color_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number | null
          product_id?: string
          size?: string | null
          sku?: string | null
          sort_order?: number
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          color_label: string
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string | null
          has_colors: boolean
          has_sizes: boolean
          id: string
          is_active: boolean
          is_featured: boolean
          low_stock_threshold: number
          metadata: Json | null
          name: string
          price: number
          price_max: number | null
          price_min: number | null
          size_guide_id: string | null
          size_label: string
          sku: string | null
          slug: string
          stock_quantity: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          category_id: string
          color_label?: string
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          has_colors?: boolean
          has_sizes?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          low_stock_threshold?: number
          metadata?: Json | null
          name: string
          price: number
          price_max?: number | null
          price_min?: number | null
          size_guide_id?: string | null
          size_label?: string
          sku?: string | null
          slug: string
          stock_quantity?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          category_id?: string
          color_label?: string
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          has_colors?: boolean
          has_sizes?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          low_stock_threshold?: number
          metadata?: Json | null
          name?: string
          price?: number
          price_max?: number | null
          price_min?: number | null
          size_guide_id?: string | null
          size_label?: string
          sku?: string | null
          slug?: string
          stock_quantity?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_size_guide_id_fkey"
            columns: ["size_guide_id"]
            isOneToOne: false
            referencedRelation: "size_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          countries: string[] | null
          created_at: string
          description: string | null
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          countries?: string[] | null
          created_at?: string
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          countries?: string[] | null
          created_at?: string
          description?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      size_guides: {
        Row: {
          columns: Json
          created_at: string
          id: string
          name: string
          notes: string | null
          rows: Json
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          rows?: Json
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          rows?: Json
          updated_at?: string
        }
        Relationships: []
      }
      stock_notification_attempts: {
        Row: {
          created_at: string
          requester_hash: string
        }
        Insert: {
          created_at?: string
          requester_hash: string
        }
        Update: {
          created_at?: string
          requester_hash?: string
        }
        Relationships: []
      }
      stock_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          locale: string
          notified_at: string | null
          product_id: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          locale?: string
          notified_at?: string | null
          product_id: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          locale?: string
          notified_at?: string | null
          product_id?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_notifications_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          alert_emails: string[]
          back_in_stock_enabled: boolean
          id: boolean
          low_stock_alerts: boolean
          updated_at: string
        }
        Insert: {
          alert_emails?: string[]
          back_in_stock_enabled?: boolean
          id?: boolean
          low_stock_alerts?: boolean
          updated_at?: string
        }
        Update: {
          alert_emails?: string[]
          back_in_stock_enabled?: boolean
          id?: boolean
          low_stock_alerts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_order_refund: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      admin_analytics: { Args: never; Returns: Json }
      admin_catalog_costs: { Args: never; Returns: Json }
      admin_discount_usage: {
        Args: never
        Returns: {
          discount_id: string
          discount_total: number
          last_used_at: string
          paid_uses: number
          revenue: number
          uses: number
        }[]
      }
      admin_duplicate_product: {
        Args: { p_name?: string; p_product_id: string }
        Returns: string
      }
      admin_exchange_order_item: {
        Args: {
          p_note?: string
          p_order_item_id: string
          p_quantity: number
          p_restock?: boolean
          p_variant_id: string
        }
        Returns: Json
      }
      admin_get_store_settings: { Args: never; Returns: Json }
      admin_import_products: {
        Args: { p_options?: Json; p_products: Json }
        Returns: Json
      }
      admin_issue_invoices: { Args: { p_order_ids: string[] }; Returns: Json }
      admin_low_stock: {
        Args: { p_limit?: number }
        Returns: {
          image_url: string
          product_id: string
          product_name: string
          sku: string
          slug: string
          stock: number
          threshold: number
          variant_id: string
          variant_label: string
          waiting: number
        }[]
      }
      admin_resolve_review: {
        Args: { p_note?: string; p_order_id: string }
        Returns: undefined
      }
      admin_save_product_variants: {
        Args: { p_config: Json; p_product_id: string }
        Returns: Json
      }
      admin_set_product_inventory: {
        Args: {
          p_expected_stock?: number
          p_has_sizes: boolean
          p_product_id: string
          p_size_label?: string
          p_stock_quantity?: number
          p_variants?: Json
        }
        Returns: Json
      }
      admin_set_product_stock: {
        Args: {
          p_expected?: number
          p_note?: string
          p_product_id: string
          p_stock: number
        }
        Returns: number
      }
      admin_set_variant_stock: {
        Args: { p_changes: Json; p_note?: string }
        Returns: {
          color_id: string | null
          created_at: string
          id: string
          is_active: boolean
          price: number | null
          product_id: string
          size: string | null
          sku: string | null
          sort_order: number
          stock_qty: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_stock_requests: {
        Args: never
        Returns: {
          notified_30d: number
          oldest: string
          product_id: string
          product_name: string
          slug: string
          stock: number
          variant_id: string
          variant_label: string
          waiting: number
        }[]
      }
      admin_update_store_settings: { Args: { p_settings: Json }; Returns: Json }
      begin_order_refund: {
        Args: {
          p_actor?: string
          p_amount: number
          p_lines?: Json
          p_order_id: string
          p_reason?: string
          p_request_id: string
          p_shipping?: number
          p_source?: string
        }
        Returns: Json
      }
      claim_stock_notifications: {
        Args: { p_limit?: number }
        Returns: {
          email: string
          id: string
          image_url: string
          locale: string
          price: number
          product_id: string
          product_name: string
          slug: string
          variant_label: string
        }[]
      }
      complete_order_refund: {
        Args: {
          p_request_id: string
          p_status: string
          p_stripe_refund_id: string
        }
        Returns: Json
      }
      discount_unavailable_reason: {
        Args: {
          d: Database["public"]["Tables"]["discount_codes"]["Row"]
          p_user_id: string
        }
        Returns: string
      }
      discount_uses: {
        Args: { p_discount_id: string; p_user_id?: string }
        Returns: number
      }
      expire_stale_pending_orders: { Args: never; Returns: number }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_purchased: { Args: { p_product_id: string }; Returns: boolean }
      invoke_store_worker: { Args: { p_task: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      low_stock_digest_candidates: { Args: never; Returns: Json }
      low_stock_items: {
        Args: never
        Returns: {
          color_id: string
          product_id: string
          product_name: string
          sku: string
          slug: string
          stock: number
          threshold: number
          variant_id: string
          variant_label: string
        }[]
      }
      mark_low_stock_alerted: { Args: { p_items: Json }; Returns: undefined }
      normalize_label: { Args: { p_value: string }; Returns: string }
      order_refunded_total: { Args: { p_order_id: string }; Returns: number }
      preview_discount_code: { Args: { p_code: string }; Returns: Json }
      purge_stock_requests: { Args: never; Returns: undefined }
      refresh_product_rollups: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      refresh_variant_rollups: {
        Args: { p_color_id: string; p_product_id: string }
        Returns: undefined
      }
      release_stock_notifications: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      request_stock_notification: {
        Args: {
          p_email?: string
          p_locale?: string
          p_product_id: string
          p_variant_id?: string
        }
        Returns: string
      }
      reserve_discount: {
        Args: {
          p_amount: number
          p_discount_id: string
          p_order_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      set_stock_context: {
        Args: { p_note?: string; p_order_id?: string; p_reason: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          user_email: string
        }
        Returns: Json
      }
      sized_product_stock: { Args: { p_product_id: string }; Returns: number }
      stock_default_reason: { Args: never; Returns: string }
      sync_order_refunds: {
        Args: {
          p_amount_charged: number
          p_amount_refunded: number
          p_payment_intent: string
          p_refunds: Json
        }
        Returns: string
      }
    }
    Enums: {
      order_status:
        | "pending"
        | "processing"
        | "requires_action"
        | "paid"
        | "failed"
        | "cancelled"
        | "shipped"
        | "delivered"
        | "refunded"
      user_role: "customer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "pending",
        "processing",
        "requires_action",
        "paid",
        "failed",
        "cancelled",
        "shipped",
        "delivered",
        "refunded",
      ],
      user_role: ["customer", "admin"],
    },
  },
} as const
