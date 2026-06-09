import { createFileRoute } from "@tanstack/react-router";
import { 
  Plus, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  UserPlus,
  ArrowRight,
  MoreVertical,
  FileText
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/implantacao")({
  component: Implantacao,
});

function Implantacao() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Implantação</h2>
          <p className="text-muted-foreground mt-2">
            Gestão de treinamentos e onboarding de ativos.
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" />
          Nova Implantação
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-3xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Agendados</p>
            <h4 className="text-xl font-bold">12 Treinamentos</h4>
          </div>
        </div>
        <div className="glass-card rounded-3xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Em Progresso</p>
            <h4 className="text-xl font-bold">08 Projetos</h4>
          </div>
        </div>
        <div className="glass-card rounded-3xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Finalizados</p>
            <h4 className="text-xl font-bold">42 Concluídos</h4>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Projects List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Projetos Ativos</h3>
            <button className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          
          <div className="space-y-4">
            <ImplantationCard 
              client="Holding J. Alencar" 
              progress={75} 
              nextStep="Treinamento Módulo Rural" 
              date="Hoje, 14:00"
              status="Em andamento"
            />
            <ImplantationCard 
              client="Condomínio Blue Park" 
              progress={30} 
              nextStep="Coleta de Matrículas" 
              date="Amanhã, 09:30"
              status="Aguardando docs"
            />
            <ImplantationCard 
              client="Fazenda Boa Vista" 
              progress={90} 
              nextStep="Encerramento e Feedback" 
              date="22 Out, 15:00"
              status="Finalização"
            />
          </div>
        </div>

        {/* Quick Actions / sidebar */}
        <div className="space-y-8">
          <div className="glass-card rounded-3xl p-8 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Documentação
            </h3>
            <div className="space-y-4">
              <DocItem title="Guia de Boas Vindas" size="2.4 MB" />
              <DocItem title="Manual do Operador" size="5.1 MB" />
              <DocItem title="Checklist de Documentos" size="1.2 MB" />
            </div>
            <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
              Acessar Knowledge Base
            </button>
          </div>

          <div className="glass-card rounded-3xl p-8 space-y-6">
            <h3 className="text-lg font-semibold">Próximos Agendamentos</h3>
            <div className="space-y-4">
              <ScheduleItem 
                title="Treinamento Equipe Financeira" 
                time="14:00" 
                client="Holding J. Alencar" 
              />
              <ScheduleItem 
                title="Reunião de Alinhamento" 
                time="16:30" 
                client="Tech Park Inc" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImplantationCard({ client, progress, nextStep, date, status }: any) {
  return (
    <div className="glass-card rounded-3xl p-6 hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-bold">{client}</h4>
          <span className="inline-block px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            {status}
          </span>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-primary" 
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Próximo Passo: {nextStep}</p>
            <p className="text-sm font-semibold">{date}</p>
          </div>
        </div>
        <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function DocItem({ title, size }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5 group">
      <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
        <FileText className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[10px] text-muted-foreground">{size}</p>
      </div>
    </div>
  );
}

function ScheduleItem({ title, time, client }: any) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary">{time}</span>
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <p className="text-sm font-medium leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground">{client}</p>
    </div>
  );
}
