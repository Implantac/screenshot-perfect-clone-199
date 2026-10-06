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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
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
      transactions: {
        Row: {
          amount: number
          asset_id: string | null
          category: string | null
          created_at: string | null
          entity_id: string | null
          id: string
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
          id?: string
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
          id?: string
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
    }
    Views: {
      [_ in never]: never
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
    }
    Enums: {
      app_role: "admin" | "user"
      asset_type: "urbano" | "rural" | "veiculo" | "outro"
      compliance_status: "regular" | "pendente" | "alerta" | "critico"
      risk_severity: "low" | "medium" | "high" | "critical"
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
      app_role: ["admin", "user"],
      asset_type: ["urbano", "rural", "veiculo", "outro"],
      compliance_status: ["regular", "pendente", "alerta", "critico"],
      risk_severity: ["low", "medium", "high", "critical"],
    },
  },
} as const
