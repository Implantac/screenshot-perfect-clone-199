import { createFileRoute } from "@tanstack/react-router";
import { 
  Network, 
  Building2, 
  User, 
  Boxes, 
  FileText, 
  ArrowUpRight, 
  ShieldCheck,
  Zap,
  Maximize2,
  Search
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/grafo")({
  component: JarvisGraphPage,
});

function JarvisGraphPage() {
  // Mock data for the relationship graph
  const nodes = [
    { id: "1", label: "Holding Alencar", type: "holding", x: 400, y: 300 },
    { id: "2", label: "Patrimonial Beta", type: "company", x: 250, y: 450 },
    { id: "3", label: "Fazenda Santa Fé", type: "asset", x: 550, y: 450 },
    { id: "4", label: "Sócio Majoritário", type: "person", x: 400, y: 150 },
    { id: "5", label: "Escritura Sede", type: "document", x: 150, y: 350 },
  ];

  const edges = [
    { from: "4", to: "1", label: "Controlador" },
    { from: "1", to: "2", label: "Subsidiária" },
    { from: "1", to: "3", label: "Propriedade" },
    { from: "2", to: "5", label: "Titularidade" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Rede de <span className="text-primary">Relacionamentos</span></h2>
          <p className="text-muted-foreground text-sm font-medium">Mapeamento visual da estrutura societária e conexões patrimoniais.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
            <Maximize2 className="h-4 w-4" />
            Tela Cheia
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[3.5rem] h-[700px] border-white/5 bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center border-dashed border-2">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.05)_0,transparent_70%)]" />
        
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from)!;
            const toNode = nodes.find(n => n.id === edge.to)!;
            return (
              <motion.line
                key={i}
                x1={fromNode.x} y1={fromNode.y}
                x2={toNode.x} y2={toNode.y}
                stroke="rgba(var(--primary), 0.2)"
                strokeWidth="1.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, delay: i * 0.3 }}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15, delay: i * 0.2 }}
            className="absolute cursor-grab active:cursor-grabbing group"
            style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
          >
            <div className={cn(
              "h-20 w-20 rounded-2xl flex flex-col items-center justify-center border transition-all duration-500 relative bg-black/40 backdrop-blur-md",
              node.type === 'holding' ? 'border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]' :
              node.type === 'company' ? 'border-blue-500/50' :
              node.type === 'person' ? 'border-amber-500/50' :
              'border-white/10'
            )}>
              <NodeIcon type={node.type} />
              <div className="absolute -bottom-10 whitespace-nowrap">
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">{node.label}</p>
                <p className="text-[8px] text-center text-muted-foreground uppercase">{node.type}</p>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="absolute bottom-10 left-10 p-6 glass-card rounded-3xl border-white/5 bg-white/[0.02] space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">Legenda do Grafo</p>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-foreground">Holdings</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-foreground">Empresas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-foreground">Sócios</span>
          </div>
        </div>

        <div className="absolute top-10 right-10 flex flex-col gap-3">
          <button className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <Zap className="h-5 w-5 text-primary" />
          </button>
          <button className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeIcon({ type }: { type: string }) {
  if (type === 'holding') return <Boxes className="h-8 w-8 text-primary" />;
  if (type === 'company') return <Building2 className="h-8 w-8 text-blue-500" />;
  if (type === 'person') return <User className="h-8 w-8 text-amber-500" />;
  if (type === 'asset') return <Building2 className="h-8 w-8 text-emerald-500" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}
