import { lazy, Suspense, useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  BarChart3,
  Volume2,
  VolumeX,
  Radio,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { useAudioLifecycle } from "./hooks/useAudioLifecycle";
import { useAppStore } from "./store/useAppStore";
import { LiveStudio } from "./components/dashboard/LiveStudio";
import { ambienceService } from "./services/ambienceService";
import { Progress } from "./components/Progress";
const BasicLessons = lazy(() =>
  import("./components/game/BasicLessons").then((m) => ({
    default: m.BasicLessons,
  })),
);
const RhythmTraining = lazy(() =>
  import("./components/game/RhythmTraining").then((m) => ({
    default: m.RhythmTraining,
  })),
);
const tabs = [
  { id: "studio", label: "Let’s play", icon: Radio },
  { id: "lessons", label: "Lessons", icon: BookOpen },
  { id: "rhythm", label: "Rhythm practice", icon: Activity },
  { id: "progress", label: "Progress", icon: BarChart3 },
] as const;
type Tab = (typeof tabs)[number]["id"];
export default function App() {
  const [tab, setTab] = useState<Tab>("studio");
  const [volume, setVolume] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const state = useAppStore();
  useAudioLifecycle();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      ambienceService.stop();
    };
  }, []);
  const navigate = (next: Tab) => {
    if (next === tab) return;
    state.setRecording(false);
    state.setMetronomeActive(false);
    setTab(next);
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Skip to practice
        </a>
        <header className="app-header">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              navigate("studio");
            }}
            aria-label="Manjira Tracker home"
          >
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span>
              <strong>
                Manjira<span>Tracker</span>
              </strong>
              <span className="brand-caption">
                A little practice. A steadier rhythm.
              </span>
            </span>
          </a>
          <div className="header-actions">
            {tab !== "studio" && <label className="ambience-control">
              {volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <span>Ambience</span>
              <input
                aria-label="Ambience volume"
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setVolume(value);
                  ambienceService.setVolume(value);
                  if (value) void ambienceService.start();
                  else ambienceService.stop();
                }}
              />
            </label>}

          </div>
        </header>
        <nav className="app-navigation" aria-label="Main navigation">
          <div className="nav-tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <span className="environment-label">
            {window.electron?.isDesktop
              ? "Offline desktop"
              : online
                ? "Web studio"
                : "Connection offline"}
          </span>
        </nav>
        <main id="main-content" className="app-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>
                {tab === "studio"
                  ? "Let’s play Manjira!"
                  : tab === "lessons"
                    ? "Learn the sound. Feel the rhythm."
                    : tab === "rhythm"
                      ? "Practice with a steady pulse."
                      : "Every session is a step forward."}
              </h1>
              <p>
                {tab === "studio"
                  ? "Pick up your Manjira and make a sound."
                  : tab === "lessons"
                    ? "Short, focused lessons for Murda, Tardi, and listening."
                    : tab === "rhythm"
                      ? "Follow the pattern, honor the rests, and find your timing."
                      : "Revisit your results and keep a record of your practice."}
              </p>
            </div>
            <span className="page-date">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
          {state.audioError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={20} />
              <div>
                <strong>Input needs attention</strong>
                <p>{state.audioError}</p>
              </div>
              {tab === "studio" && (
                <button
                  className="button secondary"
                  onClick={() => state.setRecording(true)}
                >
                  <RotateCcw size={16} />
                  Try again
                </button>
              )}
              <button
                className="button ghost"
                onClick={() => state.setAudioStatus("idle")}
              >
                Dismiss
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <p role="status" className="loading-screen">
                Opening practice…
              </p>
            }
          >
            {tab === "studio" ? (
              <LiveStudio volume={volume} onVolumeChange={(value) => {
                setVolume(value);
                ambienceService.setVolume(value);
                if (value) void ambienceService.start();
                else ambienceService.stop();
              }} />
            ) : tab === "lessons" ? (
              <BasicLessons />
            ) : tab === "rhythm" ? (
              <RhythmTraining />
            ) : (
              <Progress />
            )}
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>Manjira Tracker · Made for daily riyaz</span>
          {tab !== "studio" && <span>
            {state.audioStatus === "ready" ? "Input active" : "Input idle"} ·
            Delay compensation {state.calibration.inputLatency} ms
          </span>}
        </footer>
      </div>
    </MotionConfig>
  );
}
