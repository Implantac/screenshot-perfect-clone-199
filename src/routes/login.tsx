import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/" });
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Bem-vindo ao Use Patrium");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none -translate-x-1/2 translate-y-1/2" />
      
      <div className="w-full max-w-[450px] space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-16 group/main cursor-default">
          <div className="inline-flex items-center justify-center mb-4">
            <motion.div
              animate={{ 
                rotateY: [0, 360]
              }}
              transition={{ 
                duration: 18, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              style={{ 
                transformStyle: "preserve-3d",
                perspective: "2000px"
              }}
              className="relative w-64 h-64 flex items-center justify-center"
            >
              {/* High-Fidelity 3D Solid Effect using stacking */}
              {[...Array(12)].map((_, i) => (
                <img 
                  key={i}
                  src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" 
                  alt="Use Patrium" 
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ 
                    transform: `translateZ(${i - 6}px)`,
                    filter: i === 11 ? 'brightness(1.15) drop-shadow(0 20px 40px rgba(0,0,0,0.5))' : 'brightness(0.65)',
                    opacity: i === 0 || i === 11 ? 1 : 0.9
                  }}
                />
              ))}
              
              {/* Premium cinematic depth glow */}
              <div className="absolute inset-[-40%] bg-primary/15 blur-[120px] rounded-full -z-10" />
            </motion.div>
          </div>
          <h1 className="text-8xl font-black tracking-[0.45em] text-foreground uppercase animate-in slide-in-from-bottom-16 duration-1000 delay-200 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/20 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
            USE PATRIUM
          </h1>
        </div>








        <div className="glass-card rounded-[2.5rem] p-10 space-y-8 border-white/10 relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">Insira suas credenciais para gerenciar a governança.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">E-mail Corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@usepatrium.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Senha</label>
                <button type="button" className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline transition-all">Esqueceu?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/20"
                />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className={cn(
                "w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 group",
                loading && "opacity-70 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Decorative faint glow */}
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">
          © 2026 Use Patrium • Segurança & Compliance
        </p>
      </div>
    </div>
  );
}
