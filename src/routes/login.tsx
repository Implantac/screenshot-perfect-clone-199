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

    // Netflix-style cinematic audio sequence
    const playIntroSound = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playOscillator = (freq: number, type: OscillatorType, start: number, duration: number, vol: number) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          
          osc.type = type;
          osc.frequency.setValueAtTime(freq, start);
          
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(vol, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
          
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          osc.start(start);
          osc.stop(start + duration);
        };

        const now = audioContext.currentTime;
        playOscillator(40, 'sine', now, 2, 0.4);
        playOscillator(80, 'triangle', now + 0.1, 1.5, 0.2);
        playOscillator(800, 'sine', now + 0.5, 0.8, 0.1);
        playOscillator(1200, 'sine', now + 0.8, 0.6, 0.05);
        playOscillator(220, 'sine', now + 1.2, 2.5, 0.3);
        playOscillator(440, 'sine', now + 1.2, 2.0, 0.15);
      } catch (e) {
        console.warn("Audio context failed to start:", e);
      }
    };

    const timer = setTimeout(playIntroSound, 500);
    return () => clearTimeout(timer);
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
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none -translate-x-1/2 translate-y-1/2" />
      
      <div className="w-full max-w-[450px] space-y-8">
        <div className="text-center space-y-16 group/main cursor-default">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="inline-flex items-center justify-center mb-4"
          >
            <motion.div
              animate={{ 
                rotateY: [0, 360]
              }}
              transition={{ 
                duration: 12, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              style={{ 
                transformStyle: "preserve-3d",
                perspective: "2000px"
              }}
              className="relative w-64 h-64 flex items-center justify-center"
            >
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
              <div className="absolute inset-[-40%] bg-primary/15 blur-[120px] rounded-full -z-10" />
            </motion.div>
          </motion.div>

          <div className="relative perspective-2000 group/text flex flex-col items-center">
            <div className="relative z-10 flex flex-col leading-[1.0]">
              <motion.h1 
                initial={{ opacity: 0, x: -30, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="text-4xl font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-[#f3d38c] via-[#c4924c] to-[#7a531e] drop-shadow-[0_10px_30px_rgba(122,83,30,0.4)]"
              >
                USE
              </motion.h1>
              <motion.h1 
                initial={{ opacity: 0, x: 30, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 1.6, duration: 0.8, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="text-4xl font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-[#f3d38c] via-[#c4924c] to-[#7a531e] drop-shadow-[0_10px_30px_rgba(122,83,30,0.4)]"
              >
                PATRIUM
              </motion.h1>
            </div>

            <div className="absolute inset-0 pointer-events-none select-none flex flex-col leading-[1.0]">
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}
                className="text-4xl font-black tracking-[0.2em] uppercase text-[#63421a] blur-[1px]" 
                style={{ transform: "translateZ(-8px) translateY(3px)" }}
              >USE</motion.span>
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.8 }}
                className="text-4xl font-black tracking-[0.2em] uppercase text-[#63421a] blur-[1px]" 
                style={{ transform: "translateZ(-8px) translateY(3px)" }}
              >PATRIUM</motion.span>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 50, filter: "blur(15px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 2.5, duration: 1.2, ease: "circOut" }}
          className="glass-card rounded-[2.5rem] p-10 space-y-8 border-white/10 relative overflow-hidden"
        >
          <div className="space-y-2 relative z-10 text-center">
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

          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        </motion.div>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">
          © 2026 Use Patrium • Segurança & Compliance
        </p>
      </div>
    </div>
  );
}
