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

    // High-End Cinematic Sound Identity (inspired by Netflix/Tech-Luxury)
    const playCinematicIntro = () => {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        
        const audioCtx = new AudioContextClass();
        
        // Handle browser autoplay restrictions
        if (audioCtx.state === 'suspended') {
          const resumeOnInteraction = () => {
            audioCtx.resume();
            document.removeEventListener('click', resumeOnInteraction);
            document.removeEventListener('keydown', resumeOnInteraction);
            // Re-trigger sound if it was blocked
            runSequence(audioCtx);
          };
          document.addEventListener('click', resumeOnInteraction);
          document.addEventListener('keydown', resumeOnInteraction);
        } else {
          runSequence(audioCtx);
        }
      } catch (e) {
        console.warn("Cinematic audio failed:", e);
      }
    };

    const runSequence = (ctx: AudioContext) => {
      const now = ctx.currentTime;

      // Helper for clean gain envelopes
      const createEnv = (start: number, duration: number, maxVol: number) => {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(maxVol, start + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        gain.connect(ctx.destination);
        return gain;
      };

      // 1. THE "TUDUM" BASS (Logo Surge - Perfect Sync at 0.5s)
      const playBassThump = (time: number, freq: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = createEnv(time, 2.5, vol);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(20, time + 2.5);
        osc.connect(gain);
        osc.start(time);
        osc.stop(time + 2.5);
      };
      
      playBassThump(now, 60, 0.7);
      playBassThump(now + 0.3, 40, 0.9);

      // 2. TECH RESONANCE (USE - Perfect Sync at 2.0s)
      const playResonance = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = createEnv(time, 4.0, 0.15);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 4.0);
        filter.Q.setValueAtTime(12, time);
        
        osc.connect(filter);
        filter.connect(gain);
        osc.start(time);
        osc.stop(time + 4.0);
      };
      playResonance(now + 1.5, 440);

      // 3. PREMIUM HARMONIC SWELL (PATRIUM - Perfect Sync at 3.8s)
      const playSwell = (time: number, freqs: number[]) => {
        freqs.forEach(f => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.1, time + 2.0);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 7.0);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, time);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(time);
          osc.stop(time + 7.0);
        });
      };
      playSwell(now + 3.3, [110, 165, 220, 330, 440]);

      // 4. SYSTEM INITIALIZATION WHOOSH (Form - Perfect Sync at 5.8s)
      const playWhoosh = (time: number) => {
        const duration = 2.5;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(4000, time + 0.8);
        filter.frequency.exponentialRampToValueAtTime(50, time + duration);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.8);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(time);
        noise.stop(time + duration);
      };
      playWhoosh(now + 5.3);
    };

    const timer = setTimeout(playCinematicIntro, 500);
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
      
      <div className="w-full max-w-[400px] space-y-8 relative z-10">
        <div className="text-center space-y-12 group/main cursor-default">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="inline-flex items-center justify-center mb-2"
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
              className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center"
            >
              {[...Array(12)].map((_, i) => (
                <img 
                  key={i}
                  src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" 
                  alt="Use Patrium" 
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ 
                    transform: `translateZ(${i - 6}px)`,
                    filter: i === 11 ? 'brightness(1.15) drop-shadow(0 15px 30px rgba(0,0,0,0.5))' : 'brightness(0.65)',
                    opacity: i === 0 || i === 11 ? 1 : 0.9
                  }}
                />
              ))}
              <div className="absolute inset-[-40%] bg-primary/15 blur-[80px] rounded-full -z-10" />
            </motion.div>
          </motion.div>

          <div className="relative perspective-2000 group/text flex flex-col items-center">
            <div className="relative z-10 flex flex-col leading-[1.0]">
              <motion.h1 
                initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 1.8, duration: 1.2, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-[#f3d38c] via-[#c4924c] to-[#7a531e] drop-shadow-[0_8px_20px_rgba(122,83,30,0.4)]"
              >
                USE
              </motion.h1>
              <motion.h1 
                initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 3.5, duration: 1.2, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-[#f3d38c] via-[#c4924c] to-[#7a531e] drop-shadow-[0_8px_20px_rgba(122,83,30,0.4)]"
              >
                PATRIUM
              </motion.h1>
            </div>

            <div className="absolute inset-0 pointer-events-none select-none flex flex-col leading-[1.0]">
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1.2 }}
                className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase text-[#63421a] blur-[1px]" 
                style={{ transform: "translateZ(-8px) translateY(3px)" }}
              >USE</motion.span>
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5, duration: 1.2 }}
                className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase text-[#63421a] blur-[1px]" 
                style={{ transform: "translateZ(-8px) translateY(3px)" }}
              >PATRIUM</motion.span>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 50, filter: "blur(15px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 5.5, duration: 1.5, ease: "circOut" }}
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
