/**
 * Minimal hand-written mirror of sql/002-010 for supabase-js's generic
 * typing. Row shapes are snake_case (as stored); repositories map these to
 * the camelCase domain types in types/ on the way out.
 *
 * `Relationships: []` and the empty `Views` map are required boilerplate to
 * satisfy supabase-js's GenericSchema constraint (Tables/Views/Functions),
 * not actual foreign-key metadata — none of the repositories use embedded
 * relationship queries.
 */
export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          instagram_id: string;
          username: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          instagram_id: string;
          username?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          customer_id: string;
          status: 'active' | 'closed';
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: 'active' | 'closed';
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          message: string;
          tokens: number | null;
          instagram_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          message: string;
          tokens?: number | null;
          instagram_message_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      knowledge: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          keywords: string[] | null;
          content: string;
          source_file: string | null;
          source_page: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          keywords?: string[] | null;
          content: string;
          source_file?: string | null;
          source_page?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['knowledge']['Insert']>;
        Relationships: [];
      };
      conversation_summaries: {
        Row: {
          id: string;
          conversation_id: string;
          summary: string;
          message_count_at_summary: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          summary: string;
          message_count_at_summary: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversation_summaries']['Insert']>;
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          rate_key: string;
          window_start: string;
          request_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          rate_key: string;
          window_start: string;
          request_count?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rate_limits']['Insert']>;
        Relationships: [];
      };
      processed_webhook_events: {
        Row: {
          id: string;
          instagram_message_id: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          instagram_message_id: string;
          processed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['processed_webhook_events']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_knowledge: {
        Args: { query: string; match_limit?: number };
        Returns: {
          id: string;
          title: string;
          category: string | null;
          content: string;
          source_file: string | null;
          source_page: number | null;
          rank: number;
        }[];
      };
      increment_rate_limit: {
        Args: { p_rate_key: string; p_window_start: string };
        Returns: Database['public']['Tables']['rate_limits']['Row'][];
      };
    };
  };
}
