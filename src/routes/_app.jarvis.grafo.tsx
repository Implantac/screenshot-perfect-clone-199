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
    <div className="space-y-12 overflow-x-hidden max-w-[1800px] mx-auto w-full relative">
      <div className="fixed inset-0 noise-overlay opacity-[0.02] pointer-events-none" />
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/[0.05] pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-black uppercase tracking-[0.4em] text-primary backdrop-blur-md">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Neural Relationship Engine
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Mapa de <span className="text-primary">Conexões</span></h2>
          <p className="text-muted-foreground text-base font-medium italic opacity-70">Visualização estratégica da capilaridade societária e ativos reais.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-3 px-8 py-4 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
            <Maximize2 className="h-4 w-4" />
            Full Immersion
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[4rem] h-[600px] md:h-[850px] border-white/[0.05] bg-black/40 relative overflow-hidden flex items-center justify-center border-dashed border-2 shadow-2xl executive-grid">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.12)_0,transparent_70%)]" />
        
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
              "h-28 w-28 rounded-[2.5rem] flex flex-col items-center justify-center border transition-all duration-700 relative bg-black/80 backdrop-blur-2xl group-hover:scale-110 group-hover:border-primary/60",
              node.type === 'holding' ? 'border-primary/30 shadow-[0_0_50px_rgba(var(--primary),0.15)]' :
              node.type === 'company' ? 'border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.1)]' :
              node.type === 'person' ? 'border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]' :
              'border-white/10'
            )}>
              <NodeIcon type={node.type} />
              <div className="absolute -bottom-16 whitespace-nowrap text-center space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground group-hover:text-primary transition-colors italic leading-none">{node.label}</p>
                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em] italic">{node.type}</p>
              </div>
              
              {/* Pulse effect for nodes */}
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.05, 0.2] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "absolute inset-0 rounded-[2.5rem] -z-10",
                  node.type === 'holding' ? 'bg-primary/20' : 'bg-white/5'
                )}
              />
            </div>
          </motion.div>
        ))}

        <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 p-8 md:p-10 glass-card rounded-[3rem] border-white/[0.05] bg-black/60 space-y-6 shadow-2xl backdrop-blur-3xl max-w-[calc(100%-4rem)]">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/80 mb-6 italic border-b border-primary/20 pb-4">Conexões Estratégicas</p>
          <div className="space-y-4">
            <div className="flex items-center gap-5 group cursor-default">
              <div className="h-5 w-5 rounded-lg bg-primary shadow-[0_0_15px_rgba(var(--primary),0.4)] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/70 group-hover:text-foreground transition-colors">Holdings e Estruturas</span>
            </div>
            <div className="flex items-center gap-5 group cursor-default">
              <div className="h-5 w-5 rounded-lg bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/70 group-hover:text-foreground transition-colors">Sociedades e Empresas</span>
            </div>
            <div className="flex items-center gap-5 group cursor-default">
              <div className="h-5 w-5 rounded-lg bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/70 group-hover:text-foreground transition-colors">Sócios e Controladores</span>
            </div>
          </div>
        </div>

        <div className="absolute top-8 right-8 md:top-12 md:right-12 flex flex-col gap-4">
          <button className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-black transition-all shadow-2xl shadow-primary/10 group">
            <Zap className="h-6 w-6 text-primary group-hover:text-black" />
          </button>
          <button className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center hover:bg-white/10 transition-all shadow-2xl backdrop-blur-md">
            <Search className="h-6 w-6 text-muted-foreground/50 hover:text-white transition-colors" />
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
