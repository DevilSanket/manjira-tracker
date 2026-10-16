import React from "react";
import { motion } from "motion/react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Trophy,
  Target,
  Zap,
  Clock,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface SessionStats {
  correctType: number;
  incorrectType: number;
  perfect: number;
  near: number;
  miss: number;
}

interface SessionDashboardProps {
  stats: SessionStats;
  accuracy: number;
  combo: number;
  onRestart: () => void;
  onHome: () => void;
  title?: string;
  hideTiming?: boolean;
  isFullscreen?: boolean;
  homeLabel?: string;
  hideButtons?: boolean;
}

export const SessionDashboard: React.FC<SessionDashboardProps> = ({
  stats,
  accuracy,
  combo,
  onRestart,
  onHome,
  title = "Session Complete",
  hideTiming = false,
  isFullscreen = false,
  homeLabel = "BACK TO MENU",
  hideButtons = false,
}) => {
  const accuracyData = [
    {
      name: `Correct (${stats.correctType})`,
      value: stats.correctType,
      color: "#10b981",
    },
    {
      name: `Wrong (${stats.incorrectType})`,
      value: stats.incorrectType,
      color: "#ef4444",
    },
  ];

  const timingData = [
    {
      name: `Perfect (${stats.perfect})`,
      value: stats.perfect,
      color: "#fb923c",
    },
    { name: `Near (${stats.near})`, value: stats.near, color: "#fcd34d" },
    { name: `Miss (${stats.miss})`, value: stats.miss, color: "#94a3b8" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "mx-auto transition-all duration-700 relative backdrop-blur-3xl w-full",
        isFullscreen
          ? "fixed inset-0 w-full h-screen max-w-none rounded-none border-0 bg-transparent p-6 md:p-10 overflow-y-auto z-[100] flex flex-col"
          : "max-w-4xl max-h-full glass-card p-4 md:p-12 bg-white border-saffron/20 shadow-2xl rounded-3xl overflow-y-auto overflow-x-hidden",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity",
          isFullscreen ? "opacity-20" : "opacity-10",
        )}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/pune-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-orange-50 via-transparent to-orange-50/50" />
      </div>

      <div
        className={cn(
          "relative z-10 w-full max-w-6xl mx-auto",
          isFullscreen ? "my-auto py-8" : "",
        )}
      >
        <div
          className={cn(
            "w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transform rotate-6 border",
            isFullscreen
              ? "bg-saffron/10 border-saffron/30"
              : "bg-amber-sacred/20 border-amber-sacred/30",
          )}
        >
          <Trophy
            className={cn(
              "w-10 h-10",
              isFullscreen ? "text-saffron" : "text-amber-sacred",
            )}
          />
        </div>

        <h2
          className={cn(
            "text-4xl md:text-6xl font-black font-heading italic uppercase tracking-tighter text-center mb-1",
            isFullscreen ? "text-slate-900" : "text-black",
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "text-slate-500 uppercase tracking-[0.2em] font-black text-[10px] md:text-sm text-center",
            isFullscreen ? "mb-6" : "mb-10",
          )}
        >
          Spiritual Pulse Analysis
        </p>
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-8",
            isFullscreen ? "mb-8" : "mb-12",
          )}
        >
          <div
            className={cn(
              "space-y-6",
              hideTiming ? "flex flex-col items-center" : "",
            )}
          >
            <div
              className={cn(
                "h-56 md:h-72 glass-card border-saffron/10 bg-black/5 p-4 md:p-6",
                hideTiming ? "w-full max-w-sm" : "w-full",
              )}
            >
              <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                <Target className="w-3 h-3 text-saffron" /> Strike Precision
              </h3>
              <div className="h-[180px] md:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accuracyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isFullscreen ? 60 : 50}
                      outerRadius={isFullscreen ? 80 : 70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {accuracyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        color: "#fff",
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {!hideTiming && (
              <div className="h-56 md:h-72 glass-card border-saffron/10 bg-black/5 p-4 md:p-6">
                <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                  <Zap className="w-3 h-3 text-orange-400" /> Timing Accuracy
                </h3>
                <div className="h-[180px] md:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isFullscreen ? 60 : 50}
                        outerRadius={isFullscreen ? 80 : 70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {timingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.8)",
                          color: "#fff",
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: "10px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              hideTiming ? "mx-auto w-full max-w-md" : "",
            )}
          >
            <div className="p-8 rounded-[2rem] bg-saffron/10 border border-saffron/20 shadow-sm flex flex-col items-center justify-center">
              <div className="text-[10px] md:text-xs text-saffron font-black uppercase tracking-widest mb-2">
                {hideTiming ? "Recognition Rate" : "Overall Accuracy"}
              </div>
              <div className="text-6xl md:text-8xl font-black font-heading text-saffron tracking-tighter italic">
                {accuracy.toFixed(1)}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                className={cn(
                  "p-6 rounded-[2rem] border shadow-sm flex flex-col items-center",
                  isFullscreen
                    ? "bg-black/5 border-saffron/10"
                    : "bg-black/5 border-saffron/10",
                )}
              >
                <span
                  className={cn(
                    "text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1",
                    "text-slate-400",
                  )}
                >
                  MAX COMBO
                </span>
                <span
                  className={cn(
                    "text-3xl md:text-5xl font-black font-heading italic",
                    isFullscreen ? "text-black" : "text-black",
                  )}
                >
                  {combo}
                </span>
              </div>
              <div
                className={cn(
                  "p-6 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-sm flex flex-col items-center",
                )}
              >
                <span className="text-[8px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                  {!hideTiming ? "PERFECTS" : "STRIKES"}
                </span>
                <span className="text-3xl md:text-5xl font-black font-heading text-emerald-500 italic">
                  {!hideTiming ? stats.perfect : stats.correctType}
                </span>
              </div>
            </div>

            <div
              className={cn(
                "p-6 rounded-[2rem] border shadow-sm flex items-center justify-between px-10",
                isFullscreen
                  ? "bg-black/5 border-saffron/10 text-black"
                  : "bg-black/5 border-saffron/10 text-black",
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    TOTAL
                  </div>
                  <div className="text-xl font-black">
                    {stats.correctType + stats.incorrectType}
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200/20" />
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    RANK
                  </div>
                  <div
                    className={cn(
                      "text-xl font-black",
                      accuracy > 90
                        ? "text-emerald-400"
                        : accuracy > 75
                          ? "text-saffron"
                          : "text-slate-300",
                    )}
                  >
                    {accuracy > 90 ? "A+" : accuracy > 75 ? "B" : "C"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between w-full mt-8 md:mt-12">
          {!hideButtons && (
            <>
              <button
                onClick={onRestart}
                className="px-8 py-4 sm:py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-4 sm:mb-0"
              >
                <RotateCcw className="w-4 h-4" /> RETRY SESSION
              </button>
              <button
                onClick={onHome}
                className="px-8 py-4 sm:py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {homeLabel} <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
