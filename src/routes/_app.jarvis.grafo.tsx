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
    <div className="space-y-10 overflow-x-hidden">
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

      <div className="glass-card rounded-[3.5rem] h-[800px] border-white/5 bg-[#080808] relative overflow-hidden flex items-center justify-center border-dashed border-2 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.08)_0,transparent_70%)]" />
        
        {/* SVG for connections with glow effect */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from)!;
            const toNode = nodes.find(n => n.id === edge.to)!;
            return (
              <g key={i}>
                <motion.line
                  x1={fromNode.x} y1={fromNode.y}
                  x2={toNode.x} y2={toNode.y}
                  stroke="rgba(var(--primary), 0.3)"
                  strokeWidth="2"
                  filter="url(#glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, delay: i * 0.3 }}
                />
                <motion.circle
                  r="2"
                  fill="var(--color-primary)"
                  animate={{ 
                    cx: [fromNode.x, toNode.x],
                    cy: [fromNode.y, toNode.y],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    ease: "linear",
                    delay: i * 0.5
                  }}
                />
              </g>
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
              "h-24 w-24 rounded-[2rem] flex flex-col items-center justify-center border transition-all duration-700 relative bg-black/60 backdrop-blur-xl group-hover:scale-110",
              node.type === 'holding' ? 'border-primary/50 shadow-[0_0_40px_rgba(var(--primary),0.2)]' :
              node.type === 'company' ? 'border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.15)]' :
              node.type === 'person' ? 'border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)]' :
              'border-white/10'
            )}>
              <NodeIcon type={node.type} />
              <div className="absolute -bottom-14 whitespace-nowrap text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground group-hover:text-primary transition-colors italic">{node.label}</p>
                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{node.type}</p>
              </div>
              
              {/* Pulse effect for nodes */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "absolute inset-0 rounded-[2rem] -z-10",
                  node.type === 'holding' ? 'bg-primary/20' : 'bg-white/5'
                )}
              />
            </div>
          </motion.div>
        ))}

        <div className="absolute bottom-10 left-10 p-8 glass-card rounded-[2.5rem] border-white/5 bg-white/[0.02] space-y-5 shadow-2xl backdrop-blur-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/70 mb-4 italic">Diretório de Conexões</p>
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 rounded-lg bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Holdings</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 rounded-lg bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Empresas</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 rounded-lg bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Sócios</span>
          </div>
        </div>

        <div className="absolute top-10 right-10 flex flex-col gap-4">
          <button className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-xl shadow-primary/10 group">
            <Zap className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
          </button>
          <button className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shadow-xl">
            <Search className="h-6 w-6 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeIcon({ type }: { type: string }) {
  if (type === 'holding') return <Boxes className="h-10 w-10 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />;
  if (type === 'company') return <Building2 className="h-10 w-10 text-blue-500" />;
  if (type === 'person') return <User className="h-10 w-10 text-amber-500" />;
  if (type === 'asset') return <Building2 className="h-10 w-10 text-emerald-500" />;
  return <FileText className="h-10 w-10 text-muted-foreground" />;
}
