-- Tipos enumerados
CREATE TYPE public.asset_type AS ENUM ('urbano', 'rural', 'veiculo', 'outro');
CREATE TYPE public.compliance_status AS ENUM ('regular', 'pendente', 'alerta', 'critico');
CREATE TYPE public.risk_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Tabela de Holdings / Entidades
CREATE TABLE public.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tax_id TEXT UNIQUE, -- CNPJ
    type TEXT, -- Familiar, Investimento, Operacional
    founded_at DATE,
    compliance_score NUMERIC DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Sócios / Pessoas Relacionadas
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    tax_id TEXT UNIQUE, -- CPF
    role TEXT, -- Patriarca, Sucessor, Gestor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Participações Societárias (N-N entre Membros e Entidades)
CREATE TABLE public.entity_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    share_percentage NUMERIC NOT NULL CHECK (share_percentage >= 0 AND share_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Ativos Patrimoniais
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type public.asset_type DEFAULT 'outro',
    entity_id UUID REFERENCES public.entities(id),
    value NUMERIC DEFAULT 0,
    location TEXT, -- Cidade, Estado ou Coordenadas
    area TEXT, -- Ex: 1.240 ha ou 450 m²
    registration_number TEXT, -- Matrícula
    status public.compliance_status DEFAULT 'regular',
    health_score NUMERIC DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Documentos
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT, -- Escritura, Matrícula, Certidão, Contrato
    file_url TEXT,
    expiry_date DATE,
    status public.compliance_status DEFAULT 'regular',
    ocr_processed BOOLEAN DEFAULT false,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Riscos e Alertas
CREATE TABLE public.risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity public.risk_severity DEFAULT 'medium',
    status TEXT DEFAULT 'pending', -- pending, resolved, ignored
    asset_id UUID REFERENCES public.assets(id),
    entity_id UUID REFERENCES public.entities(id),
    document_id UUID REFERENCES public.documents(id),
    due_date TIMESTAMP WITH TIME ZONE,
    responsible_id UUID REFERENCES public.members(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Transações Financeiras (Dividendos, Impostos, Custos)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    entity_id UUID REFERENCES public.entities(id),
    asset_id UUID REFERENCES public.assets(id),
    amount NUMERIC NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')),
    category TEXT, -- Dividendos, IPTU, ITR, Manutenção
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Logs de Auditoria
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- UUID do auth.users se houver
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS e Permissões
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.entities TO authenticated, service_role;
GRANT ALL ON public.members TO authenticated, service_role;
GRANT ALL ON public.entity_shares TO authenticated, service_role;
GRANT ALL ON public.assets TO authenticated, service_role;
GRANT ALL ON public.documents TO authenticated, service_role;
GRANT ALL ON public.risks TO authenticated, service_role;
GRANT ALL ON public.transactions TO authenticated, service_role;
GRANT ALL ON public.audit_logs TO authenticated, service_role;

-- Políticas Simplificadas (Ajustar conforme necessidade de multi-tenancy real)
CREATE POLICY "Full access to authenticated users" ON public.entities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.entity_shares FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.assets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.risks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON public.audit_logs FOR ALL USING (auth.role() = 'authenticated');

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
CREATE TRIGGER set_updated_at_entities BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_members BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_documents BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_risks BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
