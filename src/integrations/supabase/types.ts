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
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          workshop_id: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          workshop_id: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_itens: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string | null
          created_at: string
          fornecedor: string | null
          id: string
          imagem_url: string | null
          nome: string
          observacoes: string | null
          preco_custo: number
          preco_venda: number
          qtd_minima: number
          quantidade: number
          unidade: string | null
          updated_at: string
          workshop_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          fornecedor?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          observacoes?: string | null
          preco_custo?: number
          preco_venda?: number
          qtd_minima?: number
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          workshop_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          fornecedor?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          observacoes?: string | null
          preco_custo?: number
          preco_venda?: number
          qtd_minima?: number
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          id: string
          item_id: string
          motivo: string | null
          os_id: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id: string | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          motivo?: string | null
          os_id?: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id?: string | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          motivo?: string | null
          os_id?: string | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          caixa_id: string | null
          categoria: string | null
          cliente_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          os_id: string | null
          status: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at: string
          valor: number
          workshop_id: string
        }
        Insert: {
          caixa_id?: string | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          valor: number
          workshop_id: string
        }
        Update: {
          caixa_id?: string | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          os_id?: string | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo?: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          valor?: number
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "pdv_caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          cliente_id: string
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          data_entrega: string | null
          desconto: number
          descricao: string | null
          diagnostico: string | null
          elevador: number | null
          id: string
          km_entrada: number | null
          mecanico_id: string | null
          numero: number
          observacoes: string | null
          status: Database["public"]["Enums"]["os_status"]
          updated_at: string
          valor_total: number
          veiculo_id: string
          workshop_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          data_entrega?: string | null
          desconto?: number
          descricao?: string | null
          diagnostico?: string | null
          elevador?: number | null
          id?: string
          km_entrada?: number | null
          mecanico_id?: string | null
          numero: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          updated_at?: string
          valor_total?: number
          veiculo_id: string
          workshop_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          data_entrega?: string | null
          desconto?: number
          descricao?: string | null
          diagnostico?: string | null
          elevador?: number | null
          id?: string
          km_entrada?: number | null
          mecanico_id?: string | null
          numero?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          updated_at?: string
          valor_total?: number
          veiculo_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      os_itens: {
        Row: {
          created_at: string
          descricao: string
          estoque_item_id: string | null
          id: string
          os_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["os_item_tipo"]
          valor_unit: number
          workshop_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          estoque_item_id?: string | null
          id?: string
          os_id: string
          quantidade?: number
          tipo: Database["public"]["Enums"]["os_item_tipo"]
          valor_unit?: number
          workshop_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          estoque_item_id?: string | null
          id?: string
          os_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["os_item_tipo"]
          valor_unit?: number
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_itens_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_itens_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_caixas: {
        Row: {
          data_abertura: string
          data_fechamento: string | null
          id: string
          observacoes: string | null
          operador_nome: string
          saldo_abertura: number
          saldo_fechamento: number | null
          status: string
          workshop_id: string
        }
        Insert: {
          data_abertura?: string
          data_fechamento?: string | null
          id?: string
          observacoes?: string | null
          operador_nome: string
          saldo_abertura?: number
          saldo_fechamento?: number | null
          status?: string
          workshop_id: string
        }
        Update: {
          data_abertura?: string
          data_fechamento?: string | null
          id?: string
          observacoes?: string | null
          operador_nome?: string
          saldo_abertura?: number
          saldo_fechamento?: number | null
          status?: string
          workshop_id?: string
        }
        Relationships: []
      }
      print_layouts: {
        Row: {
          created_at: string
          custom_footer: string | null
          custom_header: string | null
          font_size: string
          id: string
          is_default: boolean
          name: string
          paper_width: string
          show_customer: boolean
          show_items: boolean
          show_logo: boolean
          show_signatures: boolean
          show_totals: boolean
          show_vehicle: boolean
          spacing: string
          type: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          custom_footer?: string | null
          custom_header?: string | null
          font_size?: string
          id?: string
          is_default?: boolean
          name: string
          paper_width?: string
          show_customer?: boolean
          show_items?: boolean
          show_logo?: boolean
          show_signatures?: boolean
          show_totals?: boolean
          show_vehicle?: boolean
          spacing?: string
          type?: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          custom_footer?: string | null
          custom_header?: string | null
          font_size?: string
          id?: string
          is_default?: boolean
          name?: string
          paper_width?: string
          show_customer?: boolean
          show_items?: boolean
          show_logo?: boolean
          show_signatures?: boolean
          show_totals?: boolean
          show_vehicle?: boolean
          spacing?: string
          type?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_layouts_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saas_config: {
        Row: {
          asaas_api_key: string | null
          asaas_webhook_secret: string | null
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_webhook_secret?: string | null
          created_at?: string
          id: number
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          asaas_webhook_secret?: string | null
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_contratos: {
        Row: {
          assinatura_imagem: string | null
          assinatura_ip: string | null
          conteudo_html: string
          created_at: string
          data_assinatura: string | null
          id: string
          status: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          assinatura_imagem?: string | null
          assinatura_ip?: string | null
          conteudo_html: string
          created_at?: string
          data_assinatura?: string | null
          id?: string
          status: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          assinatura_imagem?: string | null
          assinatura_ip?: string | null
          conteudo_html?: string
          created_at?: string
          data_assinatura?: string | null
          id?: string
          status?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_contratos_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      troca_oleo: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          filtro_ar: string | null
          filtro_combustivel: string | null
          filtro_oleo: string | null
          id: string
          km_atual: number | null
          km_proxima: number | null
          observacoes: string | null
          oleo_marca: string | null
          oleo_tipo: string | null
          os_id: string | null
          proxima_data: string | null
          status: Database["public"]["Enums"]["troca_oleo_status"]
          updated_at: string
          veiculo_id: string
          workshop_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data?: string
          filtro_ar?: string | null
          filtro_combustivel?: string | null
          filtro_oleo?: string | null
          id?: string
          km_atual?: number | null
          km_proxima?: number | null
          observacoes?: string | null
          oleo_marca?: string | null
          oleo_tipo?: string | null
          os_id?: string | null
          proxima_data?: string | null
          status?: Database["public"]["Enums"]["troca_oleo_status"]
          updated_at?: string
          veiculo_id: string
          workshop_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          filtro_ar?: string | null
          filtro_combustivel?: string | null
          filtro_oleo?: string | null
          id?: string
          km_atual?: number | null
          km_proxima?: number | null
          observacoes?: string | null
          oleo_marca?: string | null
          oleo_tipo?: string | null
          os_id?: string | null
          proxima_data?: string | null
          status?: Database["public"]["Enums"]["troca_oleo_status"]
          updated_at?: string
          veiculo_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "troca_oleo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "troca_oleo_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "troca_oleo_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "troca_oleo_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
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
      veiculos: {
        Row: {
          ano: number | null
          cliente_id: string
          combustivel: string | null
          cor: string | null
          created_at: string
          id: string
          km_atual: number | null
          marca: string | null
          modelo: string | null
          observacoes: string | null
          placa: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          ano?: number | null
          cliente_id: string
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          placa: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          ano?: number | null
          cliente_id?: string
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          placa?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          ativo: boolean
          created_at: string
          instance_url: string | null
          template_cobranca: string | null
          template_lembrete_oleo: string | null
          template_os_concluida: string | null
          template_os_entregue: string | null
          token: string | null
          updated_at: string
          workshop_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          instance_url?: string | null
          template_cobranca?: string | null
          template_lembrete_oleo?: string | null
          template_os_concluida?: string | null
          template_os_entregue?: string | null
          token?: string | null
          updated_at?: string
          workshop_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          instance_url?: string | null
          template_cobranca?: string | null
          template_lembrete_oleo?: string | null
          template_os_concluida?: string | null
          template_os_entregue?: string | null
          token?: string | null
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: true
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          created_at: string
          enviado_em: string | null
          erro: string | null
          evento: string | null
          id: string
          mensagem: string
          ref_id: string | null
          ref_tipo: string | null
          status: Database["public"]["Enums"]["whatsapp_msg_status"]
          telefone: string
          tentativas: number
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          mensagem: string
          ref_id?: string | null
          ref_tipo?: string | null
          status?: Database["public"]["Enums"]["whatsapp_msg_status"]
          telefone: string
          tentativas?: number
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          mensagem?: string
          ref_id?: string | null
          ref_tipo?: string | null
          status?: Database["public"]["Enums"]["whatsapp_msg_status"]
          telefone?: string
          tentativas?: number
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workshop_role"]
          user_id: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workshop_role"]
          user_id: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workshop_role"]
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_members_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["workshop_plan"]
          quantidade_elevadores: number
          slug: string
          support_enabled: boolean
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["workshop_plan"]
          quantidade_elevadores?: number
          slug: string
          support_enabled?: boolean
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["workshop_plan"]
          quantidade_elevadores?: number
          slug?: string
          support_enabled?: boolean
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_default_workshop: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workshop_role: {
        Args: {
          _role: Database["public"]["Enums"]["workshop_role"]
          _user_id: string
          _workshop_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workshop_member: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      estoque_mov_tipo: "entrada" | "saida" | "ajuste"
      financeiro_status: "pendente" | "pago" | "atrasado"
      financeiro_tipo: "receita" | "despesa"
      os_item_tipo: "servico" | "peca"
      os_status:
        | "aberta"
        | "em_andamento"
        | "aguardando_peca"
        | "concluida"
        | "cancelada"
        | "entregue"
      troca_oleo_status: "pendente" | "notificado" | "realizado"
      whatsapp_msg_status: "pendente" | "enviado" | "falhou"
      workshop_plan: "trial" | "basico" | "profissional" | "premium"
      workshop_role: "owner" | "admin" | "mecanico" | "atendente"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["super_admin", "admin", "user"],
      estoque_mov_tipo: ["entrada", "saida", "ajuste"],
      financeiro_status: ["pendente", "pago", "atrasado"],
      financeiro_tipo: ["receita", "despesa"],
      os_item_tipo: ["servico", "peca"],
      os_status: [
        "aberta",
        "em_andamento",
        "aguardando_peca",
        "concluida",
        "cancelada",
        "entregue",
      ],
      troca_oleo_status: ["pendente", "notificado", "realizado"],
      whatsapp_msg_status: ["pendente", "enviado", "falhou"],
      workshop_plan: ["trial", "basico", "profissional", "premium"],
      workshop_role: ["owner", "admin", "mecanico", "atendente"],
    },
  },
} as const
