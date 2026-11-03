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
      accounts: {
        Row: {
          account_number: string | null
          created_at: string | null
          currency: string
          custodian_id: string | null
          entity_id: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          notes: string | null
          opened_at: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          created_at?: string | null
          currency?: string
          custodian_id?: string | null
          entity_id: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          name: string
          notes?: string | null
          opened_at?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          created_at?: string | null
          currency?: string
          custodian_id?: string | null
          entity_id?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          notes?: string | null
          opened_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_flows: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          entity_id: string
          flow_date: string
          id: string
          kind: Database["public"]["Enums"]["flow_kind"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          entity_id: string
          flow_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["flow_kind"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          entity_id?: string
          flow_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["flow_kind"]
        }
        Relationships: []
      }
      capital_events: {
        Row: {
          amount: number
          commitment_id: string
          created_at: string | null
          due_date: string
          entity_id: string
          id: string
          kind: Database["public"]["Enums"]["capital_event_kind"]
          notice_ref: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["capital_event_status"]
        }
        Insert: {
          amount: number
          commitment_id: string
          created_at?: string | null
          due_date: string
          entity_id: string
          id?: string
          kind: Database["public"]["Enums"]["capital_event_kind"]
          notice_ref?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["capital_event_status"]
        }
        Update: {
          amount?: number
          commitment_id?: string
          created_at?: string | null
          due_date?: string
          entity_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["capital_event_kind"]
          notice_ref?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["capital_event_status"]
        }
        Relationships: []
      }
      commitments: {
        Row: {
          closed_at: string | null
          committed: number
          created_at: string | null
          currency: string
          entity_id: string
          id: string
          is_active: boolean
          manager: string | null
          name: string
          nav: number
          nav_as_of: string | null
          notice_days: number | null
          notes: string | null
          strategy: Database["public"]["Enums"]["private_strategy"]
          term_years: number | null
          updated_at: string | null
          vintage: number | null
        }
        Insert: {
          closed_at?: string | null
          committed: number
          created_at?: string | null
          currency?: string
          entity_id: string
          id?: string
          is_active?: boolean
          manager?: string | null
          name: string
          nav?: number
          nav_as_of?: string | null
          notice_days?: number | null
          notes?: string | null
          strategy?: Database["public"]["Enums"]["private_strategy"]
          term_years?: number | null
          updated_at?: string | null
          vintage?: number | null
        }
        Update: {
          closed_at?: string | null
          committed?: number
          created_at?: string | null
          currency?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          manager?: string | null
          name?: string
          nav?: number
          nav_as_of?: string | null
          notice_days?: number | null
          notes?: string | null
          strategy?: Database["public"]["Enums"]["private_strategy"]
          term_years?: number | null
          updated_at?: string | null
          vintage?: number | null
        }
        Relationships: []
      }
      custodians: {
        Row: {
          code: string | null
          country: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          account_id: string | null
          as_of: string
          asset_class: Database["public"]["Enums"]["asset_class"]
          cost_basis: number
          created_at: string | null
          currency: string
          entity_id: string
          id: string
          instrument_id: string | null
          is_offshore: boolean
          liquidity: Database["public"]["Enums"]["asset_liquidity"]
          name: string
          notes: string | null
          price_source: string | null
          quantity: number
          symbol: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          as_of?: string
          asset_class?: Database["public"]["Enums"]["asset_class"]
          cost_basis?: number
          created_at?: string | null
          currency?: string
          entity_id: string
          id?: string
          instrument_id?: string | null
          is_offshore?: boolean
          liquidity?: Database["public"]["Enums"]["asset_liquidity"]
          name: string
          notes?: string | null
          price_source?: string | null
          quantity?: number
          symbol?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          as_of?: string
          asset_class?: Database["public"]["Enums"]["asset_class"]
          cost_basis?: number
          created_at?: string | null
          currency?: string
          entity_id?: string
          id?: string
          instrument_id?: string | null
          is_offshore?: boolean
          liquidity?: Database["public"]["Enums"]["asset_liquidity"]
          name?: string
          notes?: string | null
          price_source?: string | null
          quantity?: number
          symbol?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          as_of: string
          cost_basis: number
          created_at: string | null
          entity_id: string
          id: string
          market_value: number
          net_flow: number
          source: string | null
        }
        Insert: {
          as_of: string
          cost_basis?: number
          created_at?: string | null
          entity_id: string
          id?: string
          market_value?: number
          net_flow?: number
          source?: string | null
        }
        Update: {
          as_of?: string
          cost_basis?: number
          created_at?: string | null
          entity_id?: string
          id?: string
          market_value?: number
          net_flow?: number
          source?: string | null
        }
        Relationships: []
      }
      tax_scenarios: {
        Row: {
          assumptions: Json
          created_at: string | null
          created_by: string | null
          entity_id: string | null
          id: string
          name: string
          results: Json
          state_code: string
          total_cost: number
          updated_at: string | null
        }
        Insert: {
          assumptions?: Json
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          id?: string
          name: string
          results?: Json
          state_code?: string
          total_cost?: number
          updated_at?: string | null
        }
        Update: {
          assumptions?: Json
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          id?: string
          name?: string
          results?: Json
          state_code?: string
          total_cost?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          area: string | null
          created_at: string | null
          entity_id: string | null
          health_score: number | null
          id: string
          location: string | null
          name: string
          registration_number: string | null
          status: Database["public"]["Enums"]["compliance_status"] | null
          type: Database["public"]["Enums"]["asset_type"] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          entity_id?: string | null
          health_score?: number | null
          id?: string
          location?: string | null
          name: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
          type?: Database["public"]["Enums"]["asset_type"] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          area?: string | null
          created_at?: string | null
          entity_id?: string | null
          health_score?: number | null
          id?: string
          location?: string | null
          name?: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
          type?: Database["public"]["Enums"]["asset_type"] | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      agro_fields: {
        Row: {
          area_ha: number
          asset_id: string | null
          cost_per_ha: number | null
          created_at: string
          crop: Database["public"]["Enums"]["agro_crop"]
          entity_id: string | null
          id: string
          name: string
          notes: string | null
          productivity_sc_ha: number | null
          season: string | null
          system: Database["public"]["Enums"]["agro_system"]
          updated_at: string
        }
        Insert: {
          area_ha: number
          asset_id?: string | null
          cost_per_ha?: number | null
          created_at?: string
          crop?: Database["public"]["Enums"]["agro_crop"]
          entity_id?: string | null
          id?: string
          name: string
          notes?: string | null
          productivity_sc_ha?: number | null
          season?: string | null
          system?: Database["public"]["Enums"]["agro_system"]
          updated_at?: string
        }
        Update: {
          area_ha?: number
          asset_id?: string | null
          cost_per_ha?: number | null
          created_at?: string
          crop?: Database["public"]["Enums"]["agro_crop"]
          entity_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          productivity_sc_ha?: number | null
          season?: string | null
          system?: Database["public"]["Enums"]["agro_system"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agro_fields_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agro_fields_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      agro_leases: {
        Row: {
          adjustment_index: string | null
          area_ha: number
          asset_id: string | null
          bags_per_ha: number | null
          counterparty: string | null
          created_at: string
          ends_on: string | null
          entity_id: string | null
          id: string
          notes: string | null
          payment: Database["public"]["Enums"]["lease_payment"]
          price_per_ha_year: number | null
          role: Database["public"]["Enums"]["lease_role"]
          share_percent: number | null
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          adjustment_index?: string | null
          area_ha: number
          asset_id?: string | null
          bags_per_ha?: number | null
          counterparty?: string | null
          created_at?: string
          ends_on?: string | null
          entity_id?: string | null
          id?: string
          notes?: string | null
          payment?: Database["public"]["Enums"]["lease_payment"]
          price_per_ha_year?: number | null
          role: Database["public"]["Enums"]["lease_role"]
          share_percent?: number | null
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_index?: string | null
          area_ha?: number
          asset_id?: string | null
          bags_per_ha?: number | null
          counterparty?: string | null
          created_at?: string
          ends_on?: string | null
          entity_id?: string | null
          id?: string
          notes?: string | null
          payment?: Database["public"]["Enums"]["lease_payment"]
          price_per_ha_year?: number | null
          role?: Database["public"]["Enums"]["lease_role"]
          share_percent?: number | null
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agro_leases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agro_leases_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      agro_barters: {
        Row: {
          area_ha: number | null
          asset_id: string | null
          bag_reference_price: number
          bags_due: number
          created_at: string
          delivery_on: string | null
          entity_id: string | null
          id: string
          input_value: number
          months_to_delivery: number | null
          notes: string | null
          season: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          asset_id?: string | null
          bag_reference_price: number
          bags_due: number
          created_at?: string
          delivery_on?: string | null
          entity_id?: string | null
          id?: string
          input_value: number
          months_to_delivery?: number | null
          notes?: string | null
          season?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          asset_id?: string | null
          bag_reference_price?: number
          bags_due?: number
          created_at?: string
          delivery_on?: string | null
          entity_id?: string | null
          id?: string
          input_value?: number
          months_to_delivery?: number | null
          notes?: string | null
          season?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agro_barters_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agro_barters_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      agro_environmental: {
        Row: {
          app_ha: number | null
          asset_id: string | null
          biome: Database["public"]["Enums"]["agro_biome"]
          car_number: string | null
          car_status: Database["public"]["Enums"]["car_status"] | null
          created_at: string
          entity_id: string | null
          id: string
          in_legal_amazon: boolean
          legal_reserve_declared_ha: number | null
          notes: string | null
          total_ha: number
          updated_at: string
        }
        Insert: {
          app_ha?: number | null
          asset_id?: string | null
          biome?: Database["public"]["Enums"]["agro_biome"]
          car_number?: string | null
          car_status?: Database["public"]["Enums"]["car_status"] | null
          created_at?: string
          entity_id?: string | null
          id?: string
          in_legal_amazon?: boolean
          legal_reserve_declared_ha?: number | null
          notes?: string | null
          total_ha: number
          updated_at?: string
        }
        Update: {
          app_ha?: number | null
          asset_id?: string | null
          biome?: Database["public"]["Enums"]["agro_biome"]
          car_number?: string | null
          car_status?: Database["public"]["Enums"]["car_status"] | null
          created_at?: string
          entity_id?: string | null
          id?: string
          in_legal_amazon?: boolean
          legal_reserve_declared_ha?: number | null
          notes?: string | null
          total_ha?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agro_environmental_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agro_environmental_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_anchors: {
        Row: {
          chain_hash: string
          created_at: string
          created_by: string | null
          entries: number
          head_hash: string | null
          head_sequence: number | null
          id: string
          key_fingerprint: string | null
          manifest: Json
          manifest_hash: string
          owner_user_id: string
          period_from: string | null
          period_to: string | null
          public_key: string | null
          signature: string | null
          signature_algorithm: string | null
          signature_format: string | null
        }
        Insert: {
          chain_hash: string
          created_at?: string
          created_by?: string | null
          entries: number
          head_hash?: string | null
          head_sequence?: number | null
          id?: string
          key_fingerprint?: string | null
          manifest: Json
          manifest_hash: string
          owner_user_id: string
          period_from?: string | null
          period_to?: string | null
          public_key?: string | null
          signature?: string | null
          signature_algorithm?: string | null
          signature_format?: string | null
        }
        Update: {
          chain_hash?: string
          created_at?: string
          created_by?: string | null
          entries?: number
          head_hash?: string | null
          head_sequence?: number | null
          id?: string
          key_fingerprint?: string | null
          manifest?: Json
          manifest_hash?: string
          owner_user_id?: string
          period_from?: string | null
          period_to?: string | null
          public_key?: string | null
          signature?: string | null
          signature_algorithm?: string | null
          signature_format?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          owner_user_id: string | null
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
          entry_hash: string | null
          prev_hash: string | null
          sequence: number | null
        }
        Insert: {
          owner_user_id?: string | null
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          entry_hash: string | null
          prev_hash: string | null
          sequence: number | null
        }
        Update: {
          owner_user_id?: string | null
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_analysis: Json | null
          asset_id: string | null
          created_at: string | null
          entity_id: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          ocr_processed: boolean | null
          status: Database["public"]["Enums"]["compliance_status"] | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          asset_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          ocr_processed?: boolean | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          asset_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          ocr_processed?: boolean | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          compliance_score: number | null
          created_at: string | null
          founded_at: string | null
          id: string
          name: string
          owner_user_id: string | null
          tax_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          compliance_score?: number | null
          created_at?: string | null
          founded_at?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          tax_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          compliance_score?: number | null
          created_at?: string | null
          founded_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          tax_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      entity_shares: {
        Row: {
          created_at: string | null
          entity_id: string | null
          id: string
          member_id: string | null
          share_percentage: number
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          member_id?: string | null
          share_percentage: number
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          member_id?: string | null
          share_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_shares_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_shares_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_action_plans: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          impact_analysis: string | null
          insight_id: string | null
          priority: string
          responsible_id: string | null
          status: string | null
          suggested_resolution: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          impact_analysis?: string | null
          insight_id?: string | null
          priority: string
          responsible_id?: string | null
          status?: string | null
          suggested_resolution?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          impact_analysis?: string | null
          insight_id?: string | null
          priority?: string
          responsible_id?: string | null
          status?: string | null
          suggested_resolution?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_action_plans_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "jarvis_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jarvis_action_plans_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_health_scores: {
        Row: {
          compliance_score: number | null
          documental_score: number | null
          entity_id: string | null
          global_score: number | null
          id: string
          patrimonial_score: number | null
          recorded_at: string
          risk_score: number | null
        }
        Insert: {
          compliance_score?: number | null
          documental_score?: number | null
          entity_id?: string | null
          global_score?: number | null
          id?: string
          patrimonial_score?: number | null
          recorded_at?: string
          risk_score?: number | null
        }
        Update: {
          compliance_score?: number | null
          documental_score?: number | null
          entity_id?: string | null
          global_score?: number | null
          id?: string
          patrimonial_score?: number | null
          recorded_at?: string
          risk_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_health_scores_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_proposals: {
        Row: {
          applied_at: string | null
          applied_record_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          effect: string | null
          error: string | null
          id: string
          kind: string
          owner_user_id: string
          payload: Json
          question: string | null
          rationale: string | null
          status: string
          title: string
          tool: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_record_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          effect?: string | null
          error?: string | null
          id?: string
          kind: string
          owner_user_id: string
          payload?: Json
          question?: string | null
          rationale?: string | null
          status?: string
          title: string
          tool?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_record_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          effect?: string | null
          error?: string | null
          id?: string
          kind?: string
          owner_user_id?: string
          payload?: Json
          question?: string | null
          rationale?: string | null
          status?: string
          title?: string
          tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_proposals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jarvis_proposals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_insights: {
        Row: {
          asset_id: string | null
          created_at: string
          description: string
          entity_id: string | null
          id: string
          is_resolved: boolean | null
          metadata: Json | null
          severity: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          description: string
          entity_id?: string | null
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          severity: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          description?: string
          entity_id?: string | null
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          severity?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_insights_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jarvis_insights_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          allocated: number
          created_at: string | null
          entity_id: string
          expected_return: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          notes: string | null
          priority: number
          target_amount: number
          target_date: string
          updated_at: string | null
        }
        Insert: {
          allocated?: number
          created_at?: string | null
          entity_id: string
          expected_return?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["goal_kind"]
          name: string
          notes?: string | null
          priority?: number
          target_amount: number
          target_date: string
          updated_at?: string | null
        }
        Update: {
          allocated?: number
          created_at?: string | null
          entity_id?: string
          expected_return?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          notes?: string | null
          priority?: number
          target_amount?: number
          target_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      liabilities: {
        Row: {
          amortization: Database["public"]["Enums"]["amortization_kind"]
          collateral: string | null
          created_at: string | null
          creditor: string | null
          currency: string
          due_date: string | null
          entity_id: string
          id: string
          is_offshore: boolean
          kind: Database["public"]["Enums"]["liability_kind"]
          name: string
          notes: string | null
          outstanding: number
          principal: number
          rate_annual: number
          start_date: string | null
          term_months: number | null
          updated_at: string | null
        }
        Insert: {
          amortization?: Database["public"]["Enums"]["amortization_kind"]
          collateral?: string | null
          created_at?: string | null
          creditor?: string | null
          currency?: string
          due_date?: string | null
          entity_id: string
          id?: string
          is_offshore?: boolean
          kind?: Database["public"]["Enums"]["liability_kind"]
          name: string
          notes?: string | null
          outstanding?: number
          principal?: number
          rate_annual?: number
          start_date?: string | null
          term_months?: number | null
          updated_at?: string | null
        }
        Update: {
          amortization?: Database["public"]["Enums"]["amortization_kind"]
          collateral?: string | null
          created_at?: string | null
          creditor?: string | null
          currency?: string
          due_date?: string | null
          entity_id?: string
          id?: string
          is_offshore?: boolean
          kind?: Database["public"]["Enums"]["liability_kind"]
          name?: string
          notes?: string | null
          outstanding?: number
          principal?: number
          rate_annual?: number
          start_date?: string | null
          term_months?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string | null
          entity_id: string | null
          errors: Json
          file_hash: string | null
          file_name: string
          format: string
          id: string
          period_end: string | null
          period_start: string | null
          rows_duplicated: number
          rows_failed: number
          rows_imported: number
          rows_total: number
          status: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          errors?: Json
          file_hash?: string | null
          file_name: string
          format: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          rows_duplicated?: number
          rows_failed?: number
          rows_imported?: number
          rows_total?: number
          status?: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          errors?: Json
          file_hash?: string | null
          file_name?: string
          format?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          rows_duplicated?: number
          rows_failed?: number
          rows_imported?: number
          rows_total?: number
          status?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          owner_user_id: string | null
          role: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          owner_user_id?: string | null
          role?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          owner_user_id?: string | null
          role?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_runs: {
        Row: {
          created_at: string | null
          entity_id: string | null
          errors: Json
          id: string
          positions_updated: number
          provider: string
          symbols_found: number
          symbols_requested: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          errors?: Json
          id?: string
          positions_updated?: number
          provider: string
          symbols_found?: number
          symbols_requested?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          errors?: Json
          id?: string
          positions_updated?: number
          provider?: string
          symbols_found?: number
          symbols_requested?: number
          user_id?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          as_of: string
          currency: string
          fetched_at: string
          id: string
          price: number
          source: string
          symbol: string
        }
        Insert: {
          as_of: string
          currency?: string
          fetched_at?: string
          id?: string
          price: number
          source: string
          symbol: string
        }
        Update: {
          as_of?: string
          currency?: string
          fetched_at?: string
          id?: string
          price?: number
          source?: string
          symbol?: string
        }
        Relationships: []
      }
      risks: {
        Row: {
          asset_id: string | null
          created_at: string | null
          description: string | null
          document_id: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          responsible_id: string | null
          severity: Database["public"]["Enums"]["risk_severity"] | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          responsible_id?: string | null
          severity?: Database["public"]["Enums"]["risk_severity"] | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          responsible_id?: string | null
          severity?: Database["public"]["Enums"]["risk_severity"] | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      office_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          invited_by: string | null
          office_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          office_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          office_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_access_log: {
        Row: {
          action: string
          created_at: string
          id: string
          office_id: string
          scope: string
          target_owner_id: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          office_id: string
          scope: string
          target_owner_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          office_id?: string
          scope?: string
          target_owner_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_access_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_clients: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          label: string
          office_id: string
          owner_user_id: string
          revoked_at: string | null
          scopes: string[]
          status: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          label: string
          office_id: string
          owner_user_id: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          label?: string
          office_id?: string
          owner_user_id?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string
          created_by: string
          document: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_grants: {
        Row: {
          id: string;
          entity_id: string;
          member_id: string | null;
          full_name: string;
          email: string;
          role: Database["public"]["Enums"]["portal_role"];
          sections: string[];
          visibility: Database["public"]["Enums"]["portal_visibility"];
          status: Database["public"]["Enums"]["portal_status"];
          can_export: boolean;
          can_see_liabilities: boolean;
          can_see_documents: boolean;
          require_mfa: boolean;
          expires_at: string | null;
          invited_at: string | null;
          last_access_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          member_id?: string | null;
          full_name: string;
          email: string;
          role?: Database["public"]["Enums"]["portal_role"];
          sections?: string[];
          visibility?: Database["public"]["Enums"]["portal_visibility"];
          status?: Database["public"]["Enums"]["portal_status"];
          can_export?: boolean;
          can_see_liabilities?: boolean;
          can_see_documents?: boolean;
          require_mfa?: boolean;
          expires_at?: string | null;
          invited_at?: string | null;
          last_access_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          member_id?: string | null;
          full_name?: string;
          email?: string;
          role?: Database["public"]["Enums"]["portal_role"];
          sections?: string[];
          visibility?: Database["public"]["Enums"]["portal_visibility"];
          status?: Database["public"]["Enums"]["portal_status"];
          can_export?: boolean;
          can_see_liabilities?: boolean;
          can_see_documents?: boolean;
          require_mfa?: boolean;
          expires_at?: string | null;
          invited_at?: string | null;
          last_access_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      security_policies: {
        Row: {
          id: boolean;
          mfa_required_admin: boolean;
          mfa_required_portal: boolean;
          mfa_grace_days: number;
          min_password_length: number;
          require_mixed_case: boolean;
          require_number: boolean;
          require_symbol: boolean;
          block_common_passwords: boolean;
          password_history: number;
          max_failed_attempts: number;
          session_timeout_minutes: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          mfa_required_admin?: boolean;
          mfa_required_portal?: boolean;
          mfa_grace_days?: number;
          min_password_length?: number;
          require_mixed_case?: boolean;
          require_number?: boolean;
          require_symbol?: boolean;
          block_common_passwords?: boolean;
          password_history?: number;
          max_failed_attempts?: number;
          session_timeout_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          mfa_required_admin?: boolean;
          mfa_required_portal?: boolean;
          mfa_grace_days?: number;
          min_password_length?: number;
          require_mixed_case?: boolean;
          require_number?: boolean;
          require_symbol?: boolean;
          block_common_passwords?: boolean;
          password_history?: number;
          max_failed_attempts?: number;
          session_timeout_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          category: string | null
          compliance_score: number | null
          contact_email: string | null
          contact_phone: string | null
          contract_expiry: string | null
          contract_value: number | null
          created_at: string
          entity_id: string | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          compliance_score?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          contract_expiry?: string | null
          contract_value?: number | null
          created_at?: string
          entity_id?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          compliance_score?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          contract_expiry?: string | null
          contract_value?: number | null
          created_at?: string
          entity_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      legal_provision_entries: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["provision_entry_kind"]
          note: string | null
          occurred_on: string
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["provision_entry_kind"]
          note?: string | null
          occurred_on?: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["provision_entry_kind"]
          note?: string | null
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_provision_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          asset_id: string | null
          case_number: string
          court: string | null
          created_at: string
          entity_id: string | null
          id: string
          next_hearing: string | null
          notes: string | null
          responsible_id: string | null
          risk_level: Database["public"]["Enums"]["risk_severity"]
          status: Database["public"]["Enums"]["legal_case_status"]
          title: string
          type: Database["public"]["Enums"]["legal_case_type"]
          updated_at: string
          value_at_stake: number | null
          expected_settlement: string | null
          lawyer_assessment: string | null
          phase: Database["public"]["Enums"]["legal_phase"] | null
          polarity: Database["public"]["Enums"]["legal_polarity"]
          probability: number | null
          provision_recognized: boolean | null
        }
        Insert: {
          asset_id?: string | null
          case_number: string
          court?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          next_hearing?: string | null
          notes?: string | null
          responsible_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["legal_case_status"]
          title: string
          type?: Database["public"]["Enums"]["legal_case_type"]
          updated_at?: string
          value_at_stake?: number | null
          expected_settlement?: string | null
          lawyer_assessment?: string | null
          phase?: Database["public"]["Enums"]["legal_phase"] | null
          polarity?: Database["public"]["Enums"]["legal_polarity"]
          probability?: number | null
        }
        Update: {
          asset_id?: string | null
          case_number?: string
          court?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          next_hearing?: string | null
          notes?: string | null
          responsible_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["legal_case_status"]
          title?: string
          type?: Database["public"]["Enums"]["legal_case_type"]
          updated_at?: string
          value_at_stake?: number | null
          expected_settlement?: string | null
          lawyer_assessment?: string | null
          phase?: Database["public"]["Enums"]["legal_phase"] | null
          polarity?: Database["public"]["Enums"]["legal_polarity"]
          probability?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          asset_id: string | null
          category: string | null
          created_at: string | null
          entity_id: string | null
          external_id: string | null
          id: string
          import_batch_id: string | null
          source: string | null
          title: string
          transaction_date: string | null
          type: string | null
        }
        Insert: {
          amount: number
          asset_id?: string | null
          category?: string | null
          created_at?: string | null
          entity_id?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          source?: string | null
          title: string
          transaction_date?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          asset_id?: string | null
          category?: string | null
          created_at?: string | null
          entity_id?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          source?: string | null
          title?: string
          transaction_date?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      system_events: {
        Row: {
          context: Json
          created_at: string
          fingerprint: string
          id: string
          kind: string
          message: string
          occurred_at: string
          severity: string
          source: string
        }
        Insert: {
          context?: Json
          created_at?: string
          fingerprint: string
          id?: string
          kind: string
          message: string
          occurred_at?: string
          severity: string
          source: string
        }
        Update: {
          context?: Json
          created_at?: string
          fingerprint?: string
          id?: string
          kind?: string
          message?: string
          occurred_at?: string
          severity?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      audit_logs_chain: {
        Row: {
          action: string
          created_at: string | null
          entry_hash: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          owner_user_id: string | null
          payload_text: string | null
          prev_hash: string | null
          record_id: string | null
          sequence: number | null
          table_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_entity: { Args: { _entity_id: string }; Returns: boolean }
      verify_audit_chain: {
        Args: { _limit?: number }
        Returns: {
          checked: number
          broken: number
          first_broken_sequence: number
          started_mid_chain: boolean
        }[]
      }
      audit_signing_keys_used: {
        Args: Record<PropertyKey, never>
        Returns: {
          key_fingerprint: string
          signature_algorithm: string
          anchors: number
          first_used: string
          last_used: string
        }[]
      }
      system_event_counts: {
        Args: { _hours?: number }
        Returns: {
          fingerprint: string
          kind: string
          severity: string
          source: string
          message: string
          occurrences: number
          first_seen: string
          last_seen: string
        }[]
      }
      system_events_recent: {
        Args: { _limit?: number }
        Returns: {
          id: string
          kind: string
          severity: string
          source: string
          message: string
          context: Json
          occurred_at: string
        }[]
      }
      purge_system_events: {
        Args: { _days?: number }
        Returns: number
      }
      claim_office_invites: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      office_can_read_tenant: {
        Args: { _owner: string }
        Returns: boolean
      }
      office_consolidation: {
        Args: Record<PropertyKey, never>
        Returns: {
          office_id: string
          office_name: string
          owner_user_id: string
          label: string
          client_status: string
          granted_at: string
          entities: number
          entities_value: number
          assets_value: number
          positions_value: number
          liabilities_value: number
          net_worth: number
          risks_open: number
          risks_critical: number
          documents_expiring: number
          documents_overdue: number
          legal_exposure: number
          agro_area_ha: number
          last_update: string
        }[]
      }
      office_client_scopes: {
        Args: { _owner: string }
        Returns: string[]
      }
      office_family_detail: {
        Args: { _owner: string }
        Returns: Json
      }
      office_my_access_log: {
        Args: { _limit?: number }
        Returns: {
          id: string
          office_name: string
          reader_email: string | null
          scope: string
          action: string
          created_at: string
        }[]
      }
      office_set_scopes: {
        Args: { _grant: string; _scopes: string[] }
        Returns: string[]
      }
      office_lookup: {
        Args: { _slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      office_role_of: {
        Args: { _user: string }
        Returns: string
      }
      provisions_pending_closure: {
        Args: Record<string, never>
        Returns: {
          case_id: string
          title: string
          entity_id: string
          book_balance: number
          status: Database["public"]["Enums"]["legal_case_status"]
        }[]
      }
      jarvis_pending_proposals: {
        Args: { _limit?: number }
        Returns: {
          id: string
          title: string
          kind: string
          effect: string | null
          created_at: string
        }[]
      }
      my_mfa_factors: {
        Args: Record<string, never>
        Returns: { id: string; friendly_name: string | null; status: string; created_at: string }[]
      }
      mfa_satisfied: { Args: { _scope?: string }; Returns: boolean }
      session_is_elevated: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      account_kind: "corretora" | "banco" | "fundo" | "previdencia" | "cripto" | "outro"
      app_role: "admin" | "user"
      asset_class: "caixa" | "renda_fixa" | "renda_variavel" | "fundos" | "imoveis" | "internacional" | "alternativos" | "cripto"
      asset_liquidity: "d0" | "d1" | "d30" | "longo_prazo" | "iliquido"
      flow_kind: "aporte" | "resgate" | "provento" | "taxa" | "imposto"
      asset_type: "urbano" | "rural" | "veiculo" | "outro"
      compliance_status: "regular" | "pendente" | "alerta" | "critico"
      legal_case_status: "em_andamento" | "suspenso" | "acordo" | "encerrado"
      legal_case_type: "civel" | "tributario" | "ambiental" | "trabalhista" | "societario" | "imobiliario"
      risk_severity: "low" | "medium" | "high" | "critical"
      portal_role: "titular" | "conjuge" | "herdeiro" | "socio" | "gestor" | "contador" | "auditor";
      portal_visibility: "completo" | "resumido" | "faixas";
      portal_status: "convite_pendente" | "ativo" | "suspenso" | "revogado";
      mfa_scope: "admin" | "portal" | "todos";
      legal_polarity: "passivo" | "ativo" | "neutro";
      legal_phase: "conhecimento" | "instrucao" | "sentenca" | "recurso" | "execucao" | "encerrado";
      provision_entry_kind: "constituicao" | "atualizacao" | "reversao" | "baixa";
      agro_crop: "soja" | "milho" | "milho_safrinha" | "algodao" | "cana" | "cafe" | "pastagem" | "floresta" | "saf" | "outro";
      agro_system: "lavoura" | "pastagem" | "saf" | "floresta" | "il" | "app";
      agro_biome: "amazonia" | "cerrado" | "mata_atlantica" | "pampa" | "pantanal" | "caatinga";
      car_status: "ativo" | "pendente" | "em_analise" | "irregular" | "sem_car";
      lease_role: "arrendador" | "arrendatario" | "parceiro_outorgante" | "parceiro_outorgado";
      lease_payment: "dinheiro" | "sacas" | "parceria";
      supplier_status: "homologado" | "em_analise" | "risco_critico" | "inativo"
      capital_event_kind: "call" | "distribution"
      capital_event_status: "previsto" | "pago" | "atrasado" | "cancelado"
      private_strategy: "private_equity" | "venture_capital" | "infraestrutura" | "real_estate" | "agro" | "credito_privado" | "outro"
      liability_kind: "financiamento_imobiliario" | "credito_rural" | "emprestimo" | "consignado" | "cartao" | "debenture" | "divida_societaria" | "outro"
      amortization_kind: "price" | "sac" | "bullet"
      goal_kind: "liquidez" | "sucessao" | "imovel" | "educacao" | "filantropia" | "reserva_oportunidade" | "meta_patrimonial" | "outro"
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
      account_kind: ["corretora", "banco", "fundo", "previdencia", "cripto", "outro"],
      app_role: ["admin", "user"],
      asset_class: ["caixa", "renda_fixa", "renda_variavel", "fundos", "imoveis", "internacional", "alternativos", "cripto"],
      asset_liquidity: ["d0", "d1", "d30", "longo_prazo", "iliquido"],
      flow_kind: ["aporte", "resgate", "provento", "taxa", "imposto"],
      asset_type: ["urbano", "rural", "veiculo", "outro"],
      compliance_status: ["regular", "pendente", "alerta", "critico"],
      legal_case_status: ["em_andamento", "suspenso", "acordo", "encerrado"],
      legal_case_type: ["civel", "tributario", "ambiental", "trabalhista", "societario", "imobiliario"],
      risk_severity: ["low", "medium", "high", "critical"],
      supplier_status: ["homologado", "em_analise", "risco_critico", "inativo"],
      capital_event_kind: ["call", "distribution"],
      capital_event_status: ["previsto", "pago", "atrasado", "cancelado"],
      private_strategy: ["private_equity", "venture_capital", "infraestrutura", "real_estate", "agro", "credito_privado", "outro"],
      mfa_scope: ["admin", "portal", "todos"],
      legal_polarity: ["passivo", "ativo", "neutro"],
      legal_phase: ["conhecimento", "instrucao", "sentenca", "recurso", "execucao", "encerrado"],
      provision_entry_kind: ["constituicao", "atualizacao", "reversao", "baixa"],
      agro_crop: ["soja", "milho", "milho_safrinha", "algodao", "cana", "cafe", "pastagem", "floresta", "saf", "outro"],
      agro_system: ["lavoura", "pastagem", "saf", "floresta", "il", "app"],
      agro_biome: ["amazonia", "cerrado", "mata_atlantica", "pampa", "pantanal", "caatinga"],
      car_status: ["ativo", "pendente", "em_analise", "irregular", "sem_car"],
      lease_role: ["arrendador", "arrendatario", "parceiro_outorgante", "parceiro_outorgado"],
      lease_payment: ["dinheiro", "sacas", "parceria"],
      liability_kind: ["financiamento_imobiliario", "credito_rural", "emprestimo", "consignado", "cartao", "debenture", "divida_societaria", "outro"],
      amortization_kind: ["price", "sac", "bullet"],
      goal_kind: ["liquidez", "sucessao", "imovel", "educacao", "filantropia", "reserva_oportunidade", "meta_patrimonial", "outro"],
    },
  },
} as const
