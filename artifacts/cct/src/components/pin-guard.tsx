import { useState, useEffect, useRef } from "react";
import omLogoUrl from "/antiq-logo.png";
import { useI18n } from "@/lib/i18n";

const SESSION_KEY = "cct_auth_token";
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { "x-cct-token": token },
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

async function submitPin(pin: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data.token : null;
  } catch {
    return null;
  }
}

export function PinGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">("loading");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      setStatus("locked");
      return;
    }
    verifyToken(token).then((ok) => setStatus(ok ? "unlocked" : "locked"));
  }, []);

  useEffect(() => {
    if (status === "locked") {
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [status]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setError(false);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 3) {
      const pin = [...next.slice(0, 3), value].join("");
      if (pin.length === 4) handleSubmit(pin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (pin: string) => {
    setSubmitting(true);
    const token = await submitPin(pin);
    if (token) {
      localStorage.setItem(SESSION_KEY, token);
      setStatus("unlocked");
    } else {
      setError(true);
      setDigits(["", "", "", ""]);
      setSubmitting(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  if (status === "loading") {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-10">
      <img
        src={omLogoUrl}
        alt="antiq"
        className="h-8 w-auto"
        style={{ filter: "brightness(0) invert(1)" }}
      />

      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col items-center gap-6">
        <div className="flex gap-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={submitting}
              className={`w-14 h-14 text-center text-2xl font-light bg-transparent border rounded-xl text-white outline-none transition-all
                ${error ? "border-red-500/70" : d ? "border-white/60" : "border-white/20"}
                focus:border-white/80 disabled:opacity-40 caret-transparent`}
            />
          ))}
        </div>

        <p
          className={`text-sm transition-opacity duration-200 ${error ? "opacity-100 text-red-400" : "opacity-0"}`}
        >
          {t("pin.incorrect")}
        </p>
      </form>
    </div>
  );
}
