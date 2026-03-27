export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limits: {
        Row: {
          key: string
          count: number | null
          window_start: string | null
        }
        Insert: {
          key: string
          count?: number | null
          window_start?: string | null
        }
        Update: {
          key?: string
          count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      swipe_events: {
        Row: {
          id: string
          user_id: string
          tmdb_movie_id: number
          action: Database['public']['Enums']['swipe_action']
          movie_title: string | null
          movie_year: number | null
          movie_director: string | null
          movie_genre: string | null
          poster_url: string | null
          movie_synopsis: string | null
          recommendation_reason: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_movie_id: number
          action: Database['public']['Enums']['swipe_action']
          movie_title?: string | null
          movie_year?: number | null
          movie_director?: string | null
          movie_genre?: string | null
          poster_url?: string | null
          movie_synopsis?: string | null
          recommendation_reason?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_movie_id?: number
          action?: Database['public']['Enums']['swipe_action']
          movie_title?: string | null
          movie_year?: number | null
          movie_director?: string | null
          movie_genre?: string | null
          poster_url?: string | null
          movie_synopsis?: string | null
          recommendation_reason?: string | null
          source?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'swipe_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      swipe_states: {
        Row: {
          id: string
          user_id: string
          tmdb_movie_id: number
          latest_action: Database['public']['Enums']['swipe_action']
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_movie_id: number
          latest_action: Database['public']['Enums']['swipe_action']
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_movie_id?: number
          latest_action?: Database['public']['Enums']['swipe_action']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'swipe_states_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      watchlists: {
        Row: {
          id: string
          user_id: string
          tmdb_movie_id: number
          movie_title: string | null
          movie_year: number | null
          movie_director: string | null
          movie_genre: string | null
          movie_synopsis: string | null
          recommendation_reason: string | null
          source: string | null
          recommended_at: string | null
          poster_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_movie_id: number
          movie_title?: string | null
          movie_year?: number | null
          movie_director?: string | null
          movie_genre?: string | null
          movie_synopsis?: string | null
          recommendation_reason?: string | null
          source?: string | null
          recommended_at?: string | null
          poster_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_movie_id?: number
          movie_title?: string | null
          movie_year?: number | null
          movie_director?: string | null
          movie_genre?: string | null
          movie_synopsis?: string | null
          recommendation_reason?: string | null
          source?: string | null
          recommended_at?: string | null
          poster_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'watchlists_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
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
      record_swipe_event: {
        Args: {
          p_tmdb_movie_id: number
          p_action: Database['public']['Enums']['swipe_action']
          p_movie_title?: string
          p_movie_year?: number
          p_movie_director?: string
          p_movie_genre?: string
          p_poster_url?: string
          p_movie_synopsis?: string
          p_recommendation_reason?: string
          p_source?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      swipe_action: 'unwatched' | 'watched' | 'loved' | 'disliked'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
