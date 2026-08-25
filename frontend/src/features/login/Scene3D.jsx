import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Layers, TrendingUp, CheckCircle2, FileText, Calendar, Folder, Target,
} from "lucide-react";

/**
 * The 3D login environment (spec §60).
 *
 * Built with real CSS 3D — a shared `perspective` stage with every element on
 * its own `translateZ` plane, so moving the pointer produces genuine parallax
 * rather than a flat pan. Heavy 3D is confined to this screen; the dashboards
 * stay 2D for performance.
 */

const PARTICLE_COUNT = 26;

export default function Scene3D() {
  const stageRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  /**
   * Parallax runs on motion values rather than React state: pointer moves fire
   * at ~60Hz, and re-rendering the whole scene that often would be wasteful.
   * These write straight to the DOM, and the springs smooth the motion.
   */
  const pointerX = useMotionValue(0); // -0.5 … 0.5
  const pointerY = useMotionValue(0);

  const springConfig = { stiffness: 70, damping: 18, mass: 0.6 };
  const smoothX = useSpring(pointerX, springConfig);
  const smoothY = useSpring(pointerY, springConfig);

  // Vertical pointer movement tilts around X; horizontal around Y.
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-14, 14]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const onPointerMove = (event) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
      pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
    };

    // Recentre when the pointer leaves the window entirely.
    const onPointerOut = (event) => {
      if (event.relatedTarget === null) {
        pointerX.set(0);
        pointerY.set(0);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
    };
  }, [reducedMotion, pointerX, pointerY]);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 10,
        duration: 9 + Math.random() * 10,
        depth: -180 + Math.random() * 360,
        hue: i % 3,
      })),
    []
  );

  return (
    <div ref={stageRef} className="stage-3d" aria-hidden="true">
      {/* Ambient depth orbs — furthest back */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Particles rise through the scene at varying depths */}
      <div className="particle-field">
        {particles.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              transform: `translateZ(${p.depth}px)`,
              background:
                p.hue === 0
                  ? "rgba(167,139,250,0.9)"
                  : p.hue === 1
                  ? "rgba(96,165,250,0.85)"
                  : "rgba(74,222,128,0.7)",
            }}
          />
        ))}
      </div>

      {/* Everything below shares one 3D space and tilts together */}
      <motion.div
        className="stage-world"
        style={reducedMotion ? undefined : { rotateX, rotateY }}
      >
        <GridFloor />
        <Laptop />
        <GraduationCap />

        <FloatingPanel
          className="panel-timeline"
          depth={110}
          delay={0.15}
          float={7}
          style={{ top: "6%", right: "4%", width: 186 }}
        >
          <PanelTitle icon={Calendar}>Project Timeline</PanelTitle>
          {[
            { week: "Week 8", task: "Backend APIs", state: "done" },
            { week: "Week 9", task: "Integration", state: "done" },
            { week: "Week 10", task: "Testing", state: "active" },
            { week: "Week 11", task: "Documentation", state: "todo" },
          ].map((item) => (
            <div key={item.week} className="timeline-row">
              <span className={`timeline-dot timeline-dot-${item.state}`} />
              <span>
                <span className="timeline-week">{item.week}</span>
                <span className={`timeline-task ${item.state === "active" ? "is-active" : ""}`}>
                  {item.task}
                </span>
              </span>
            </div>
          ))}
        </FloatingPanel>

        <FloatingPanel
          className="panel-progress"
          depth={70}
          delay={0.3}
          float={9}
          style={{ bottom: "22%", left: "1%", width: 202 }}
        >
          <PanelTitle icon={TrendingUp} tone="green">
            Weekly Submissions
          </PanelTitle>
          <div className="spark-bars">
            {[28, 52, 44, 68, 58, 78, 70, 84, 76, 90, 86, 96].map((h, i) => (
              <span
                key={i}
                className="spark-bar"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 0.08}s`,
                  background:
                    i >= 10
                      ? "linear-gradient(180deg,#a78bfa,#3b82f6)"
                      : "rgba(124,58,237,0.38)",
                }}
              />
            ))}
          </div>
          <div className="spark-axis">
            <span>Week 1</span>
            <span>Week 12</span>
          </div>
        </FloatingPanel>

        <FloatingPanel
          className="panel-domains"
          depth={40}
          delay={0.45}
          float={6}
          style={{ top: "44%", left: "-2%", width: 152 }}
        >
          <PanelTitle icon={Layers}>By Domain</PanelTitle>
          {[
            { name: "AI / ML", count: 12, max: 20, color: "#a78bfa" },
            { name: "Web", count: 18, max: 20, color: "#60a5fa" },
            { name: "Flutter", count: 9, max: 20, color: "#4ade80" },
          ].map((d) => (
            <div key={d.name} className="domain-row">
              <div className="domain-head">
                <span>{d.name}</span>
                <span style={{ color: d.color, fontWeight: 700 }}>{d.count}</span>
              </div>
              <div className="domain-track">
                <span
                  className="domain-fill"
                  style={{ width: `${(d.count / d.max) * 100}%`, background: d.color }}
                />
              </div>
            </div>
          ))}
        </FloatingPanel>

        <FloatingPanel
          className="panel-status"
          depth={150}
          delay={0.6}
          float={8}
          style={{ bottom: "13%", right: "6%", width: 172 }}
        >
          {[
            { icon: CheckCircle2, text: "SRS Approved", color: "#4ade80" },
            { icon: Target, text: "Week 9 Verified", color: "#60a5fa" },
            { icon: FileText, text: "Final Report Due", color: "#fbbf24" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.text} className="status-row" style={{ borderColor: `${item.color}33` }}>
                <Icon size={13} color={item.color} />
                <span>{item.text}</span>
              </div>
            );
          })}
        </FloatingPanel>

        {/* Floating check badge — closest to the viewer */}
        <motion.div
          className="float-badge"
          style={{ top: "34%", right: "0%", transform: "translateZ(190px)" }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        >
          <CheckCircle2 size={15} color="#4ade80" />
          <span>Faculty Approved</span>
        </motion.div>

        {/* Project folders, stacked in depth */}
        <motion.div
          className="folder-stack"
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
        >
          {[
            { label: "Capstone", z: 0, color: "#7c3aed" },
            { label: "Web Tech", z: 26, color: "#3b82f6" },
            { label: "Mobile App", z: 52, color: "#22c55e" },
          ].map((f, i) => (
            <div
              key={f.label}
              className="folder-card"
              style={{
                transform: `translateZ(${f.z}px) translateX(${i * 13}px) translateY(${i * -9}px)`,
                borderColor: `${f.color}44`,
              }}
            >
              <Folder size={12} color={f.color} />
              <span>{f.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <SceneStyles />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PanelTitle({ icon: Icon, children, tone = "purple" }) {
  return (
    <div className="panel-title">
      <Icon size={12} color={tone === "green" ? "#4ade80" : "#a78bfa"} />
      {children}
    </div>
  );
}

function FloatingPanel({ children, className = "", style, depth = 0, delay = 0, float = 8 }) {
  return (
    <motion.div
      className={`float-panel ${className}`}
      style={{ ...style, transform: `translateZ(${depth}px)` }}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: [0, -float, 0] }}
      transition={{
        opacity: { duration: 0.7, delay },
        y: { duration: 6 + float * 0.2, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Perspective grid that grounds the scene in space. */
function GridFloor() {
  return <div className="grid-floor" />;
}

/**
 * CSS-3D laptop with a live-looking dashboard on its screen. The lid, base and
 * hinge are separate planes rotated in the same 3D space.
 */
function Laptop() {
  return (
    <motion.div
      className="laptop"
      initial={{ opacity: 0, scale: 0.9, rotateX: -22 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="laptop-lid">
        <div className="laptop-screen">
          <div className="screen-topbar">
            <span className="screen-logo">
              <Layers size={10} color="#fff" />
            </span>
            <span>
              <span className="screen-title">SAPMS</span>
              <span className="screen-sub">Student Dashboard</span>
            </span>
            <span className="screen-dot" />
          </div>

          <div className="screen-kpis">
            {[
              { value: "4", label: "Projects" },
              { value: "72%", label: "Progress" },
              { value: "W10", label: "Week" },
            ].map((k) => (
              <div key={k.label} className="screen-kpi">
                <span className="screen-kpi-value">{k.value}</span>
                <span className="screen-kpi-label">{k.label}</span>
              </div>
            ))}
          </div>

          {[
            { label: "Capstone Project", value: 72, color: "#a78bfa" },
            { label: "Advanced Web Tech", value: 85, color: "#4ade80" },
            { label: "Mobile Application", value: 45, color: "#fb923c" },
            { label: "Software Engineering", value: 60, color: "#60a5fa" },
          ].map((row, i) => (
            <div key={row.label} className="screen-row">
              <div className="screen-row-head">
                <span>{row.label}</span>
                <span style={{ color: row.color }}>{row.value}%</span>
              </div>
              <div className="screen-track">
                <span
                  className="screen-fill"
                  style={{
                    width: `${row.value}%`,
                    background: row.color,
                    boxShadow: `0 0 8px ${row.color}99`,
                    animationDelay: `${0.9 + i * 0.15}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="laptop-hinge" />
      <div className="laptop-base">
        <div className="laptop-trackpad" />
      </div>
      <div className="laptop-glow" />
    </motion.div>
  );
}

/** Graduation cap assembled from four rotated planes. */
function GraduationCap() {
  return (
    <motion.div
      className="cap"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { duration: 0.8, delay: 0.4 },
        y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 },
      }}
    >
      <div className="cap-board" />
      <div className="cap-base" />
      <div className="cap-tassel" />
      <div className="cap-knot" />
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SceneStyles() {
  return (
    <style>{`
      .stage-3d {
        position: absolute;
        inset: 0;
        perspective: 1400px;
        perspective-origin: 50% 45%;
        overflow: hidden;
        pointer-events: none;
      }

      .stage-world {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        will-change: transform;
      }

      /* ── Ambient orbs ─────────────────────────────────────────────── */
      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        pointer-events: none;
      }
      .orb-1 {
        width: 380px; height: 380px;
        background: rgba(124,58,237,0.30);
        top: 4%; left: 6%;
        animation: orbPulse 7s ease-in-out infinite;
      }
      .orb-2 {
        width: 300px; height: 300px;
        background: rgba(59,130,246,0.24);
        bottom: 10%; right: 8%;
        animation: orbPulse 9s ease-in-out 2s infinite;
      }
      .orb-3 {
        width: 190px; height: 190px;
        background: rgba(34,197,94,0.14);
        top: 52%; left: 42%;
        animation: orbPulse 6s ease-in-out 1s infinite;
      }
      @keyframes orbPulse {
        0%, 100% { transform: scale(1); opacity: 0.55; }
        50%      { transform: scale(1.18); opacity: 1; }
      }

      /* ── Perspective floor ────────────────────────────────────────── */
      .grid-floor {
        position: absolute;
        left: -30%;
        right: -30%;
        bottom: -14%;
        height: 62%;
        background-image:
          linear-gradient(rgba(124,58,237,0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,58,237,0.16) 1px, transparent 1px);
        background-size: 54px 54px;
        transform: rotateX(74deg) translateZ(-140px);
        transform-origin: bottom center;
        mask-image: radial-gradient(ellipse at 50% 100%, #000 5%, transparent 72%);
        -webkit-mask-image: radial-gradient(ellipse at 50% 100%, #000 5%, transparent 72%);
        opacity: 0.75;
      }

      /* ── Particles ────────────────────────────────────────────────── */
      .particle-field {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
      }
      .particle {
        position: absolute;
        bottom: -12px;
        border-radius: 50%;
        opacity: 0;
        animation-name: particleRise;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }
      @keyframes particleRise {
        0%   { transform: translateY(0) scale(0.6); opacity: 0; }
        12%  { opacity: 0.75; }
        88%  { opacity: 0.6; }
        100% { transform: translateY(-92vh) scale(1.1); opacity: 0; }
      }

      /* ── Laptop ───────────────────────────────────────────────────── */
      .laptop {
        position: absolute;
        left: 50%;
        top: 46%;
        width: 330px;
        margin-left: -165px;
        margin-top: -130px;
        transform-style: preserve-3d;
        transform: translateZ(20px) rotateX(9deg);
      }

      .laptop-lid {
        width: 330px;
        height: 214px;
        border-radius: 12px 12px 3px 3px;
        background: linear-gradient(150deg, #1a2744, #0b1424);
        border: 1px solid rgba(255,255,255,0.14);
        padding: 9px;
        box-shadow:
          0 30px 60px rgba(0,0,0,0.55),
          0 0 42px rgba(124,58,237,0.24),
          inset 0 1px 0 rgba(255,255,255,0.08);
        transform-style: preserve-3d;
      }

      .laptop-screen {
        width: 100%;
        height: 100%;
        border-radius: 6px;
        background: linear-gradient(165deg, #0a1424 0%, #111f38 100%);
        border: 1px solid rgba(124,58,237,0.22);
        padding: 10px 11px;
        overflow: hidden;
        position: relative;
      }
      /* Screen sheen */
      .laptop-screen::after {
        content: '';
        position: absolute;
        top: 0; left: -60%;
        width: 45%; height: 100%;
        background: linear-gradient(100deg, transparent, rgba(255,255,255,0.06), transparent);
        animation: screenSheen 7s ease-in-out infinite;
      }
      @keyframes screenSheen {
        0%, 65% { left: -60%; }
        100%    { left: 130%; }
      }

      .screen-topbar {
        display: flex;
        align-items: center;
        gap: 7px;
        padding-bottom: 8px;
        margin-bottom: 9px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .screen-logo {
        width: 19px; height: 19px;
        border-radius: 5px;
        background: linear-gradient(135deg,#7c3aed,#3b82f6);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .screen-title { display: block; font-size: 9px; font-weight: 800; color: #fff; letter-spacing: 0.05em; }
      .screen-sub   { display: block; font-size: 7px; color: rgba(148,163,184,0.75); }
      .screen-dot {
        margin-left: auto;
        width: 6px; height: 6px; border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 7px #4ade80;
        animation: livePulse 2s ease-in-out infinite;
      }
      @keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

      .screen-kpis { display: flex; gap: 6px; margin-bottom: 10px; }
      .screen-kpi {
        flex: 1;
        background: rgba(255,255,255,0.045);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 5px;
        padding: 5px 6px;
      }
      .screen-kpi-value {
        display: block;
        font-size: 11px; font-weight: 800;
        background: linear-gradient(135deg,#a78bfa,#60a5fa);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.1;
      }
      .screen-kpi-label { display: block; font-size: 6.5px; color: rgba(148,163,184,0.8); }

      .screen-row { margin-bottom: 7px; }
      .screen-row-head {
        display: flex; justify-content: space-between;
        font-size: 7px; font-weight: 600;
        color: rgba(203,213,225,0.85);
        margin-bottom: 3px;
      }
      .screen-track {
        height: 3.5px;
        background: rgba(255,255,255,0.07);
        border-radius: 99px;
        overflow: hidden;
      }
      .screen-fill {
        display: block;
        height: 100%;
        border-radius: 99px;
        transform-origin: left;
        animation: fillIn 1.1s cubic-bezier(0.22,1,0.36,1) backwards;
      }
      @keyframes fillIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }

      .laptop-hinge {
        width: 336px;
        height: 5px;
        margin-left: -3px;
        background: linear-gradient(180deg, #2a3a5c, #16223c);
        border-radius: 2px;
        transform: translateZ(-2px);
      }

      .laptop-base {
        width: 392px;
        height: 15px;
        margin-left: -31px;
        border-radius: 3px 3px 11px 11px;
        background: linear-gradient(180deg, #223354, #0e1830);
        border: 1px solid rgba(255,255,255,0.09);
        border-top: none;
        transform: rotateX(72deg) translateZ(-8px);
        transform-origin: top center;
        box-shadow: 0 22px 44px rgba(0,0,0,0.55);
        position: relative;
      }
      .laptop-trackpad {
        position: absolute;
        left: 50%; top: 3px;
        width: 74px; height: 7px;
        margin-left: -37px;
        border-radius: 2px;
        background: rgba(255,255,255,0.07);
      }

      /* Ground glow under the machine */
      .laptop-glow {
        position: absolute;
        left: 50%; bottom: -46px;
        width: 330px; height: 54px;
        margin-left: -165px;
        background: radial-gradient(ellipse, rgba(124,58,237,0.42), transparent 72%);
        filter: blur(18px);
        transform: translateZ(-40px);
      }

      /* ── Graduation cap ───────────────────────────────────────────── */
      .cap {
        position: absolute;
        top: 9%;
        left: 12%;
        width: 76px;
        height: 62px;
        transform-style: preserve-3d;
        transform: translateZ(130px) rotateX(58deg) rotateZ(-16deg);
      }
      .cap-board {
        position: absolute;
        width: 76px; height: 76px;
        top: -8px; left: 0;
        background: linear-gradient(135deg, #7c3aed, #4c1d95);
        transform: rotateZ(45deg);
        border-radius: 4px;
        box-shadow: 0 12px 26px rgba(124,58,237,0.5);
      }
      .cap-base {
        position: absolute;
        width: 34px; height: 26px;
        left: 21px; top: 22px;
        background: linear-gradient(180deg, #6d28d9, #3b1a7a);
        border-radius: 4px 4px 8px 8px;
        transform: translateZ(-11px);
      }
      .cap-tassel {
        position: absolute;
        right: 5px; top: 12px;
        width: 2.5px; height: 30px;
        background: linear-gradient(180deg, #fbbf24, #f59e0b);
        border-radius: 99px;
        transform-origin: top center;
        animation: tasselSway 3.6s ease-in-out infinite;
      }
      .cap-knot {
        position: absolute;
        right: 2px; top: 40px;
        width: 8px; height: 11px;
        background: #fbbf24;
        border-radius: 0 0 5px 5px;
        box-shadow: 0 0 10px rgba(251,191,36,0.65);
        animation: tasselSway 3.6s ease-in-out infinite;
      }
      @keyframes tasselSway {
        0%, 100% { transform: rotate(-7deg); }
        50%      { transform: rotate(7deg); }
      }

      /* ── Floating glass panels ────────────────────────────────────── */
      .float-panel {
        position: absolute;
        background: rgba(15, 32, 64, 0.78);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 15px;
        padding: 13px;
        box-shadow:
          0 24px 48px rgba(0,0,0,0.45),
          0 0 24px rgba(124,58,237,0.14),
          inset 0 1px 0 rgba(255,255,255,0.07);
        will-change: transform;
      }

      .panel-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 8.5px;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(167,139,250,1);
        margin-bottom: 11px;
      }

      /* Timeline panel */
      .timeline-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .timeline-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .timeline-dot-done   { background: #4ade80; box-shadow: 0 0 7px rgba(74,222,128,0.7); }
      .timeline-dot-active { background: #a78bfa; box-shadow: 0 0 9px rgba(167,139,250,0.9); }
      .timeline-dot-todo   { background: rgba(255,255,255,0.16); }
      .timeline-week { display: block; font-size: 7px; color: rgba(148,163,184,0.75); font-weight: 700; }
      .timeline-task { display: block; font-size: 8.5px; color: rgba(148,163,184,0.7); }
      .timeline-task.is-active { color: #fff; font-weight: 600; }

      /* Sparkline panel */
      .spark-bars { display: flex; gap: 3px; align-items: flex-end; height: 42px; }
      .spark-bar {
        flex: 1;
        border-radius: 2px;
        transform-origin: bottom;
        animation: barGrow 0.8s cubic-bezier(0.22,1,0.36,1) backwards;
      }
      @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      .spark-axis {
        display: flex;
        justify-content: space-between;
        margin-top: 7px;
        font-size: 7px;
        color: rgba(148,163,184,0.6);
      }

      /* Domain panel */
      .domain-row { margin-bottom: 7px; }
      .domain-head {
        display: flex; justify-content: space-between;
        font-size: 7.5px; color: rgba(148,163,184,0.85);
        margin-bottom: 3px;
      }
      .domain-track { height: 3px; background: rgba(255,255,255,0.07); border-radius: 99px; }
      .domain-fill  { display: block; height: 100%; border-radius: 99px; }

      /* Status panel */
      .status-row {
        display: flex; align-items: center; gap: 7px;
        padding: 6px 8px;
        background: rgba(255,255,255,0.045);
        border: 1px solid;
        border-radius: 7px;
        font-size: 8px;
        color: rgba(203,213,225,0.92);
        font-weight: 500;
        margin-bottom: 6px;
      }
      .status-row:last-child { margin-bottom: 0; }

      /* Floating badge */
      .float-badge {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px 13px;
        background: rgba(15,32,64,0.86);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(74,222,128,0.3);
        border-radius: 99px;
        font-size: 9px;
        font-weight: 600;
        color: #fff;
        box-shadow: 0 14px 30px rgba(0,0,0,0.45), 0 0 18px rgba(74,222,128,0.18);
        white-space: nowrap;
      }

      /* Folder stack */
      .folder-stack {
        position: absolute;
        bottom: 6%;
        left: 16%;
        transform-style: preserve-3d;
      }
      .folder-card {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        background: rgba(15,32,64,0.8);
        backdrop-filter: blur(14px);
        border: 1px solid;
        border-radius: 9px;
        font-size: 8.5px;
        font-weight: 600;
        color: rgba(203,213,225,0.95);
        box-shadow: 0 12px 26px rgba(0,0,0,0.4);
        white-space: nowrap;
      }

      /* ── Reduced motion: keep the depth, drop the movement ─────────── */
      @media (prefers-reduced-motion: reduce) {
        .particle, .spark-bar, .screen-fill, .cap-tassel, .cap-knot,
        .orb, .laptop-screen::after, .screen-dot {
          animation: none !important;
        }
      }

      /* Scale the whole scene down on shorter viewports */
      @media (max-height: 800px) {
        .laptop { transform: translateZ(20px) rotateX(9deg) scale(0.86); }
        .cap { transform: translateZ(130px) rotateX(58deg) rotateZ(-16deg) scale(0.85); }
      }
    `}</style>
  );
}
