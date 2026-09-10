import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Instagram, Archive, Megaphone, Activity, Sparkles } from "lucide-react";
import { XIcon } from "@/components/x-icon";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import omLogoUrl from "/antiq-logo.png";
import omIconUrl from "/antiq-square.png";

const MIN_W = 56;
const MAX_W = 220;
const SNAP_THRESHOLD = 100;

function LangToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-full border border-border/60 bg-card/40 p-0.5 text-[11px] font-semibold">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "rounded-full transition-colors uppercase",
            size === "md" ? "px-2.5 py-1" : "px-2 py-0.5",
            lang === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={l === "es" ? "Español" : "English"}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useI18n();
  const [sidebarW, setSidebarW] = useState(() => {
    const saved = localStorage.getItem("cct-sidebar-w");
    return saved ? Math.max(MIN_W, Math.min(MAX_W, Number(saved))) : MAX_W;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const expanded = sidebarW > SNAP_THRESHOLD;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = sidebarW;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarW]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.max(MIN_W, Math.min(MAX_W, startW.current + delta));
      setSidebarW(newW);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarW(prev => {
        const snapped = prev > SNAP_THRESHOLD ? MAX_W : MIN_W;
        localStorage.setItem("cct-sidebar-w", String(snapped));
        return snapped;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const navItems = [
    { href: "/", label: "Overview", short: "Inicio", icon: LayoutDashboard },
    { href: "/twitter", label: "X", short: "X", icon: XIcon },
    { href: "/instagram", label: "Instagram", short: "IG", icon: Instagram },
    { href: "/adgen", label: "Ad Gen", short: "Ads", icon: Megaphone },
    { href: "/content-gen", label: t("nav.contentGen"), short: "Studio", icon: Sparkles },
    { href: "/archivo", label: t("nav.archivo"), short: "Archivo", icon: Archive },
    { href: "/usage", label: "Usage", short: "Uso", icon: Activity },
  ];

  const isActiveHref = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const isEngine = location.startsWith("/engine");

  if (isEngine) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-background text-foreground selection:bg-primary/30">
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border/30 bg-black">
          <Link href="/">
            <div className="cursor-pointer">
              <img src={omLogoUrl} alt="antiq" className="h-5 md:h-6 w-auto" />
            </div>
          </Link>
        </header>
        <main className="flex-1 flex flex-col overflow-y-auto bg-black/50">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Desktop sidebar */}
      <aside
        className="relative border-r border-border bg-black hidden md:flex flex-col shrink-0 overflow-hidden"
        style={{ width: sidebarW, transition: dragging.current ? "none" : "width 0.2s ease" }}
      >
        <div className={cn("flex items-center", expanded ? "px-5 py-6 justify-between" : "justify-center py-6")}>
          <Link href="/">
            <div className="cursor-pointer">
              {expanded ? (
                <img src={omLogoUrl} alt="antiq" className="h-7 w-auto" />
              ) : (
                <div className="w-9 h-9 rounded-md overflow-hidden">
                  <img src={omIconUrl} alt="antiq" className="w-full h-full object-cover scale-[1.6]" />
                </div>
              )}
            </div>
          </Link>
          {expanded && <LangToggle />}
        </div>

        <nav className={cn("flex-1 space-y-1 mt-2", expanded ? "px-3" : "flex flex-col items-center")}>
          {navItems.map((item) => {
            const isActive = isActiveHref(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center rounded-xl transition-all duration-200 cursor-pointer",
                    expanded ? "gap-3 px-3 py-2.5 text-sm font-medium" : "justify-center w-10 h-10",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  title={expanded ? undefined : item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {expanded && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className={cn("py-4 border-t border-border rounded-t-xl", expanded ? "px-5 flex items-center justify-between" : "text-center")}>
          {expanded && <span className="text-[10px] text-muted-foreground/40">internal tool</span>}
          <span className="text-[9px] text-muted-foreground/50 font-mono">v0.6.4.9</span>
        </div>

        {/* Drag handle */}
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
          onPointerDown={onPointerDown}
        />
      </aside>

      {/* Content column */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/[0.08] bg-black/70 backdrop-blur-xl">
          <Link href="/">
            <div className="cursor-pointer flex items-center">
              <img src={omLogoUrl} alt="antiq" className="h-6 w-auto" />
            </div>
          </Link>
          <LangToggle size="md" />
        </header>

        <main className="flex-1 overflow-y-auto bg-black/50">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden shrink-0 border-t border-white/[0.08] bg-black/70 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-stretch justify-around px-1.5 pt-1.5 pb-1">
            {navItems.map((item) => {
              const isActive = isActiveHref(item.href);
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div className="flex flex-col items-center justify-center gap-1 py-1 cursor-pointer select-none">
                    <div
                      className={cn(
                        "flex items-center justify-center h-8 w-full max-w-[48px] rounded-[14px] transition-all duration-200",
                        isActive ? "bg-white/[0.1]" : "active:bg-white/[0.05]"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[21px] w-[21px] shrink-0 transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground/55"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] tracking-tight leading-none transition-colors",
                        isActive ? "text-primary font-semibold" : "text-muted-foreground/45 font-medium"
                      )}
                    >
                      {item.short}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
