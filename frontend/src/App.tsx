import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import AmbientBackground from "./components/AmbientBackground/AmbientBackground";
import InsightCards from "./components/InsightCards/InsightCards";
import PromptBar from "./components/PromptBar/PromptBar";
import Settings, { type SettingsSection } from "./components/Settings/Settings";
import SidebarNav from "./components/Sidebar/Sidebar";
import ThinkingState from "./components/ThinkingState/ThinkingState";
import AgentThinking from "./components/AgentThinking/AgentThinking";
import { pickScript, scriptById, type SimScript } from "./simulation/simScripts";
import { useSimulatedRun } from "./simulation/useSimulatedRun";
import {
  SUBLINES,
  SUBLINE_ROTATE_JITTER_MS,
  SUBLINE_ROTATE_MIN_MS,
  SUBLINE_STORE_KEY,
} from "./constants/sublines";
import styles from "./App.module.css";

type Message = {
  id: number;
  role: "user" | "agent";
  text: string;
  insights?: boolean;
  sim?: { scriptId: string; elapsedMs: number };
  thinking?: string;
};

type Chat = {
  id: number;
  title: string;
  messages: Message[];
};

const CANNED_REPLIES = [
  "Your voice profile is locked in (Base). I readapt captions to match it, keeping meaning intact.",
  "The caption readaptation flow: paste the post, pick the platform, and I rework tone without touching facts.",
  "Your best post this week scored 84. Hook + short lines + a question in the last sentence.",
  "I don't browse or invent links. Every answer points at your own data or the doc you gave me.",
];

const ANALYTICS_REPLY =
  "Impressions are up 12% week over week, but single images are lagging — carousels and video carried your reach. Here's the breakdown from your numbers:";

const ANALYTICS_RE =
  /analytic|analy[sz]e|impression|reach|engagement|metric|stat|perform|lagging|trend|chart|graph|insight|growth|follower|numbers?|views?|score|report/i;

const PROMPT_POOL = [
  "Show me how my account's impressions are doing and what's lagging behind",
  "Which post performed best last week?",
  "When's the best time for me to post?",
  "What should I post next?",
  "Compare this week's reach to last week",
  "Rewrite my latest caption in my voice",
  "Summarize my engagement trends this month",
  "Draft a launch post for my new feature",
  "Audit my content plan from google drive and weigh it against what is working now on Instagram",
  "What should I stop posting, based on the last 30 days?",
  "Turn last week's best reel into a carousel script",
  "Compare my TikTok and Reels performance and tell me where to focus",
  "Find the gaps in my posting schedule for next week",
  "Pull my saves-per-impression trend and flag anything unusual",
  "Build a one-week content plan from my top-performing posts",
];

const pickPills = () => {
  const shuffled = [...PROMPT_POOL].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2);
  return shuffled.slice(0, count);
};

let nextId = 1;
let nextChatId = 1;
let sessionPick: number | null = null;

const CHATS_KEY = "onscript_agent_chats";
const ACTIVE_KEY = "onscript_agent_active";
const DRAFTS_KEY = "onscript_agent_drafts";

const loadDrafts = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // corrupted storage -> start with no drafts
  }
  return {};
};

const loadChats = (): Chat[] => {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Chat[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const c of parsed) {
          nextChatId = Math.max(nextChatId, (c.id ?? 0) + 1);
          for (const msg of c.messages ?? []) {
            nextId = Math.max(nextId, (msg.id ?? 0) + 1);
          }
        }
        return parsed;
      }
    }
  } catch {
    // corrupted storage -> fall through to a fresh chat
  }
  return [{ id: 0, title: "", messages: [] }];
};

const applyEdgeGates = (el: HTMLElement) => {
  const max = Math.max(el.scrollHeight - el.clientHeight, 0);
  const top = max > 0 && el.scrollTop > 4 ? "on" : "off";
  const bottom = max > 0 && max - el.scrollTop > 4 ? "on" : "off";
  const zone = el.parentElement;
  if (el.dataset.edgeTop !== top) el.dataset.edgeTop = top;
  if (el.dataset.edgeBottom !== bottom) el.dataset.edgeBottom = bottom;
  if (zone) {
    if (zone.dataset.edgeTop !== top) zone.dataset.edgeTop = top;
    if (zone.dataset.edgeBottom !== bottom) zone.dataset.edgeBottom = bottom;
  }
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState(() => {
    const saved = Number(localStorage.getItem(ACTIVE_KEY));
    return loadChats().some((c) => c.id === saved) ? saved : 0;
  });
  const draftsRef = useRef<Record<string, string> | null>(null);
  if (draftsRef.current === null) draftsRef.current = loadDrafts();

  const draftFor = (id: number) => draftsRef.current?.[String(id)] ?? "";

  const [input, setInput] = useState(() => draftFor(activeId));

  const persistDrafts = () => {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(draftsRef.current));
    } catch {
      // storage unavailable -> drafts stay in memory for this session
    }
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (draftsRef.current) draftsRef.current[String(activeId)] = value;
    persistDrafts();
  };

  useEffect(() => {
    setInput(draftFor(activeId));
  }, [activeId]);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{
    script: SimScript;
    runId: number;
  } | null>(null);
  const [pills, setPills] = useState<string[]>(pickPills);
  const [subline, setSubline] = useState<string | null>(null);
  const [sublineShown, setSublineShown] = useState(false);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("profile");
  const sim = useSimulatedRun(run);
  const runCounterRef = useRef(0);
  const settledReplyRef = useRef(0);
  const pendingAnalyticsRef = useRef(false);
  const pendingChatIdRef = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const handledUserRef = useRef<HTMLElement | null>(null);
  const handledAgentRef = useRef<HTMLElement | null>(null);

  const activeChat = chats.find((c) => c.id === activeId);
  const messages = activeChat ? activeChat.messages : [];

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      applyEdgeGates(el);
    };
    const onScroll = () => {
      const max = Math.max(el.scrollHeight - el.clientHeight, 0);
      nearBottomRef.current = max - el.scrollTop < 96;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onResize = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    applyEdgeGates(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      localStorage.setItem(ACTIVE_KEY, String(activeId));
    } catch {
      // storage unavailable (private mode etc.) - ignore
    }
  }, [chats, activeId]);

  useEffect(() => {
    let alive = true;
    let rotateTimer = 0;
    let fadeTimer = 0;

    const readLast = (): number => {
      try {
        const v = Number(localStorage.getItem(SUBLINE_STORE_KEY));
        return Number.isInteger(v) && v >= 0 && v < SUBLINES.length ? v : -1;
      } catch {
        return -1;
      }
    };
    const writeLast = (i: number) => {
      try {
        localStorage.setItem(SUBLINE_STORE_KEY, String(i));
      } catch {
        // storage unavailable - rotation still works, just no repeat-guard
      }
    };
    const pickAvoiding = (avoid: number): number => {
      if (SUBLINES.length < 2) return 0;
      let i = Math.floor(Math.random() * SUBLINES.length);
      while (i === avoid) i = Math.floor(Math.random() * SUBLINES.length);
      return i;
    };
    const commit = (i: number) => {
      setSubline(SUBLINES[i]);
      writeLast(i);
      requestAnimationFrame(() => {
        if (alive) setSublineShown(true);
      });
    };

    // module scope: StrictMode re-runs this effect on mount - pick exactly
    // once per real page load so the repeat-guard advances only once too
    if (sessionPick === null) sessionPick = pickAvoiding(readLast());
    setSubline(SUBLINES[sessionPick]);
    writeLast(sessionPick);
    requestAnimationFrame(() => {
      if (alive) setSublineShown(true);
    });

    const schedule = () => {
      const delay =
        SUBLINE_ROTATE_MIN_MS + Math.random() * SUBLINE_ROTATE_JITTER_MS;
      rotateTimer = window.setTimeout(() => {
        if (!alive) return;
        setSublineShown(false);
        fadeTimer = window.setTimeout(() => {
          if (!alive) return;
          sessionPick = pickAvoiding(readLast());
          commit(sessionPick);
          schedule();
        }, 220);
      }, delay);
    };
    schedule();

    return () => {
      alive = false;
      window.clearTimeout(rotateTimer);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  useLayoutEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const max = Math.max(el.scrollHeight - el.clientHeight, 0);
    const users = el.querySelectorAll<HTMLElement>(
      '[data-role="user"]',
    );
    const agents = el.querySelectorAll<HTMLElement>(
      '[data-role="agent"]',
    );
    const lastUser = users[users.length - 1] ?? null;
    const lastAgent = agents[agents.length - 1] ?? null;
    const userNew = lastUser !== null && lastUser !== handledUserRef.current;
    const agentNew =
      lastAgent !== null && lastAgent !== handledAgentRef.current;

    const contentTopOf = (elm: HTMLElement) =>
      elm.getBoundingClientRect().top -
      el.getBoundingClientRect().top +
      el.scrollTop;

    if (nearBottomRef.current) {
      if (agentNew && lastUser) {
        const ub = lastUser.getBoundingClientRect();
        const s = el.getBoundingClientRect();
        const userInside = ub.top >= s.top - 1 && ub.bottom <= s.bottom + 1;
        el.scrollTop = userInside
          ? max
          : Math.min(Math.max(contentTopOf(lastUser) - 12, 0), max);
      } else {
        el.scrollTop = max;
      }
    } else if (userNew && lastUser) {
      el.scrollTop = Math.min(
        Math.max(contentTopOf(lastUser) - 12, 0),
        max,
      );
    } else if (agentNew && lastAgent) {
      const b = lastAgent.getBoundingClientRect();
      const s = el.getBoundingClientRect();
      const inside = b.top >= s.top - 1 && b.bottom <= s.bottom + 1;
      if (!inside) {
        el.scrollTop = Math.min(
          Math.max(
            contentTopOf(lastAgent) + b.height - el.clientHeight + 16,
            0,
          ),
          max,
        );
      }
    }
    handledUserRef.current = lastUser;
    handledAgentRef.current = lastAgent;
    nearBottomRef.current = max - el.scrollTop < 96;
    applyEdgeGates(el);
  }, [messages, busy, view]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    pendingAnalyticsRef.current = ANALYTICS_RE.test(text);
    pendingChatIdRef.current = activeId;
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title:
                c.title ||
                (text.length > 36 ? `${text.slice(0, 36)}…` : text),
              messages: [
                ...c.messages,
                { id: nextId++, role: "user", text },
              ],
            }
          : c,
      ),
    );
    handleInput("");
    runCounterRef.current += 1;
    setRun({ script: pickScript(text), runId: runCounterRef.current });
    setBusy(true);
  };

  const handleSettled = (scriptId: string, elapsedMs: number) => {
    const index = settledReplyRef.current;
    settledReplyRef.current += 1;
    const isAnalytics = pendingAnalyticsRef.current;
    pendingAnalyticsRef.current = false;
    const target = pendingChatIdRef.current;
    setChats((prev) =>
      prev.map((c) =>
        c.id === target
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: nextId++,
                  role: "agent",
                  text: isAnalytics
                    ? ANALYTICS_REPLY
                    : CANNED_REPLIES[
                        index % CANNED_REPLIES.length
                      ],
                  insights: isAnalytics,
                  sim: { scriptId, elapsedMs },
                },
              ],
            }
          : c,
      ),
    );
    setBusy(false);
  };

  useEffect(() => {
    if (sim.status !== "done" || !run) return;
    const { script } = run;
    const elapsed = sim.elapsedMs;
    const timer = window.setTimeout(() => {
      setRun(null);
      handleSettled(script.id, elapsed);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.status, run]);

  const resetChat = () => {
    const current = chats.find((c) => c.id === activeId);
    const withMessages = chats.filter((c) => c.messages.length > 0);
    if (current && current.messages.length === 0) {
      setChats([...withMessages, current]);
      setActiveId(current.id);
      if (draftsRef.current) delete draftsRef.current[String(current.id)];
      persistDrafts();
    } else {
      const fresh = { id: nextChatId++, title: "", messages: [] };
      setChats([...withMessages, fresh]);
      setActiveId(fresh.id);
    }
    setRun(null);
    setBusy(false);
    setInput("");
    pendingAnalyticsRef.current = false;
    setPills(pickPills());
  };

  const live = run
    ? {
        runId: run.runId,
        script: run.script,
        status:
          sim.runId === run.runId && sim.status === "done"
            ? ("done" as const)
            : ("running" as const),
        elapsedMs: sim.runId === run.runId ? sim.elapsedMs : 0,
        index: sim.runId === run.runId ? sim.index : 0,
        startedCount: sim.runId === run.runId ? sim.startedCount : 1,
      }
    : null;

  const recents = chats
    .filter((c) => c.messages.length > 0)
    .map((c) => ({ id: String(c.id), label: c.title || "Untitled" }));

  useLayoutEffect(() => {
    const say = new URLSearchParams(window.location.search).get(
      "say",
    );
    if (say && messages.length === 0 && !busy) send(say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <AmbientBackground />
      <div className={styles.shell}>
        <SidebarNav
          fill
          onNewChat={resetChat}
          onPick={(id) => setActiveId(Number(id))}
          activeTitle={activeChat ? activeChat.title || null : null}
          recents={recents}
          activeNav={view === "settings" ? "settings" : "home"}
          onNavigate={(key) =>
            setView(key === "settings" ? "settings" : "chat")
          }
          onOpenSettings={(section) => {
            setSettingsSection(section as SettingsSection);
            setView("settings");
          }}
        />
        <main className={styles.main}>
          {view === "settings" ? (
            <Settings
              section={settingsSection}
              onSectionChange={setSettingsSection}
              onBack={() => setView("chat")}
            />
          ) : (
            <>
              <header className={styles.header}>
                <h1 className={styles.title}>
                  {activeChat && activeChat.title ? activeChat.title : "New chat"}
                </h1>
              </header>

              <div
                className={styles.streamZone}
                data-edge-top="off"
                data-edge-bottom="off"
              >
                <div
                  className={`${styles.edge} ${styles.edgeTop}`}
                  aria-hidden="true"
                />
                <div
                  className={styles.stream}
                  ref={streamRef}
                  data-edge-top="off"
                  data-edge-bottom="off"
                >
                  <div className={styles.streamInner}>
                    {messages.length === 0 && !busy && (
                      <div className={styles.empty}>
                        <span className={styles.emptyMark}>Onscript</span>
                        <p
                          className={styles.emptyText}
                          aria-live="polite"
                          data-subline-shown={sublineShown ? "true" : "false"}
                        >
                          {subline}
                        </p>
                      </div>
                    )}
                    {messages.map((m) => (
                      <Fragment key={m.id}>
                        {m.role === "agent" && m.sim && (
                          <div className={styles.thinkingSlot}>
                            <AgentThinking
                              settled
                              script={scriptById(m.sim.scriptId)}
                              elapsedMs={m.sim.elapsedMs}
                            />
                          </div>
                        )}
                        {m.role === "agent" && !m.sim && m.thinking && (
                          <div className={styles.thinkingSlot}>
                            <ThinkingState variant={m.thinking} settled />
                          </div>
                        )}
                        <div
                          data-role={m.role}
                          className={
                            m.role === "user"
                              ? styles.userMsg
                              : styles.agentMsg
                          }
                        >
                          {m.role === "agent" && (
                            <span className={styles.agentLabel}>Agent</span>
                          )}
                          <p className={styles.msgText}>{m.text}</p>
                          {m.insights && (
                            <div className={styles.insightSlot}>
                              <InsightCards onPill={(text) => handleInput(text)} />
                            </div>
                          )}
                        </div>
                      </Fragment>
                    ))}
                    {live && (
                      <AgentThinking
                        key={live.runId}
                        script={live.script}
                        status={live.status}
                        elapsedMs={live.elapsedMs}
                        index={live.index}
                        startedCount={live.startedCount}
                      />
                    )}
                  </div>
                </div>
                <div
                  className={`${styles.edge} ${styles.edgeBottom}`}
                  aria-hidden="true"
                />
              </div>

              <div className={styles.dock}>
                {messages.length === 0 && !busy && (
                  <div className={styles.pills}>
                    {pills.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={styles.pill}
                        onClick={() => handleInput(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <PromptBar
                  demo={false}
                  text={input}
                  onTextChange={handleInput}
                  onSend={send}
                  busy={busy}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
