export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rate_limits: {
        Row: {
          key: string
          count: number
          window_start: string
        }
        Insert: {
          key: string
          count?: number
          window_start?: string
        }
        Update: {
          key?: string
          count?: number
          window_start?: string
        }
      }
      swipe_history: {
        Row: {
          id: string
          session_id: string
          movie_id: string
          action: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          movie_id: string
          action: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          movie_id?: string
          action?: string
          created_at?: string
        }
      }
      watchlists: {
        Row: {
          id: string
          session_id: string
          user_id: string | null
          movie_id: string
          movie_title: string
          poster_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id?: string | null
          movie_id: string
          movie_title: string
          poster_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string | null
          movie_id?: string
          movie_title?: string
          poster_url?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          ip_action_key: string
          max_reqs: number
          window_interval: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
