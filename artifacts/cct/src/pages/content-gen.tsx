import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useContentGenChat,
  useGetContentGenConversations,
  getContentGenConversation,
  useDeleteContentGenConversation,
  getGetContentGenConversationsQueryKey,
  type ContentGenMessage,
  type ContentGenAttachment,
  type ContentGenChatRequest,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  Send,
  Paperclip,
  Loader2,
  Plus,
  Trash2,
  Download,
  FileText,
  X,
  Check,
  MessageSquare,
  History,
  Images,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MAX_ATTACHMENTS = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

type PendingAttachment = ContentGenAttachment & { isImage: boolean };

export default function ContentGenPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ContentGenMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [imgFormat, setImgFormat] = useState<ContentGenChatRequest["format"]>("auto");
  const [marketId, setMarketId] = useState("");
  const [watermark, setWatermark] = useState(false);
  const [carousel, setCarousel] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useContentGenChat();
  const deleteConv = useDeleteContentGenConversation();
  const { data: convData } = useGetContentGenConversations();
  const conversations = convData?.conversations ?? [];

  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sending) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sending]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const detail = await getContentGenConversation(id);
      setConversationId(id);
      setMessages(detail.messages);
      setHistoryOpen(false);
    } catch {
      toast.error(t("cg.error"));
    }
  }, [t]);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setPending([]);
    setMarketId("");
    setImgFormat("auto");
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (pending.length + next.length >= MAX_ATTACHMENTS) break;
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name}: > 20MB`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        next.push({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          isImage: file.type.startsWith("image/"),
        });
      } catch {
        toast.error(t("cg.error"));
      }
    }
    setPending((p) => [...p, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [pending.length, t]);

  const send = useCallback(async () => {
    const text = input.trim();
    const mkt = marketId.trim();
    if ((!text && pending.length === 0 && !mkt) || sending) return;

    const optimisticUser: ContentGenMessage = {
      id: Date.now(),
      role: "user",
      content: text || (mkt ? `${t("cg.market")} #${mkt}` : "(adjuntos)"),
      attachments: pending.map((p) => ({
        name: p.name,
        mimeType: p.mimeType,
        kind: p.isImage ? "image" : "document",
        dataUrl: p.isImage ? p.dataUrl : null,
      })),
      images: [],
    };
    setMessages((m) => [...m, optimisticUser]);
    setInput("");
    const attachments = pending.map(({ name, mimeType, dataUrl }) => ({ name, mimeType, dataUrl }));
    setPending([]);
    setSending(true);

    try {
      const resp = await chat.mutateAsync({
        data: {
          conversationId: conversationId ?? undefined,
          message: text,
          attachments,
          lang,
          format: imgFormat,
          marketId: mkt || null,
          watermark,
          carousel,
        },
      });
      setConversationId(resp.conversationId);
      setMessages((m) => [...m, resp.message]);
      queryClient.invalidateQueries({ queryKey: getGetContentGenConversationsQueryKey() });
      setMarketId("");
      try {
        new Audio(import.meta.env.BASE_URL.replace(/\/$/, "") + "/complete.mp3").play();
      } catch {}
    } catch {
      toast.error(t("cg.error"));
      setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }, [input, pending, sending, chat, conversationId, lang, imgFormat, marketId, watermark, carousel, queryClient, t]);

  const removeConversation = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConv.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetContentGenConversationsQueryKey() });
      if (id === conversationId) newConversation();
      toast.success(t("cg.deleted"));
    } catch {
      toast.error(t("cg.deleteError"));
    }
  }, [deleteConv, queryClient, conversationId, newConversation, t]);

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <header className="flex items-center justify-between gap-4 mb-6 border-b border-border/50 pb-6 px-1 md:pr-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setHistoryOpen(true)}
          className="rounded-full shrink-0 lg:hidden"
          aria-label={t("cg.history")}
        >
          <History className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={newConversation}
          className="rounded-full shrink-0 ml-auto"
          aria-label={t("cg.new")}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </header>

      {/* Mobile history drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-black border-r border-border/60 flex flex-col p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("cg.history")}
              </p>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 px-2">{t("cg.noConversations")}</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => loadConversation(c.id)}
                      className={`group flex items-center gap-2 px-2.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        c.id === conversationId ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                      <span className="text-[13px] truncate flex-1">{c.title}</span>
                      <button
                        onClick={(e) => removeConversation(c.id, e)}
                        className="text-muted-foreground hover:text-red-500 transition-all shrink-0"
                        aria-label={t("cg.deleteConv")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-6">
        {/* History sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border/50 pr-4 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3 px-2">
            {t("cg.history")}
          </p>
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 px-2">{t("cg.noConversations")}</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                    c.id === conversationId ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-[13px] truncate flex-1">{c.title}</span>
                  <button
                    onClick={(e) => removeConversation(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                    aria-label={t("cg.deleteConv")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-6">
            {messages.length === 0 && !sending ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <p className="text-sm text-muted-foreground max-w-md">{t("cg.empty.subtitle")}</p>
              </div>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  youLabel={t("cg.you")}
                  assistantLabel={t("cg.assistant")}
                  attachmentsLabel={t("cg.attachments")}
                  onImageClick={setLightbox}
                  onDownload={downloadDataUrl}
                />
              ))
            )}
            {sending && (() => {
              const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 45))));
              const phaseKey =
                elapsed < 6
                  ? "cg.phase.analyzing"
                  : elapsed < 40
                    ? "cg.phase.creating"
                    : elapsed < 75
                      ? "cg.phase.branding"
                      : "cg.phase.finishing";
              const mm = Math.floor(elapsed / 60);
              const ss = elapsed % 60;
              const clock = mm > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : `${ss}s`;
              return (
                <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t(phaseKey)}</span>
                    <span className="ml-auto tabular-nums text-xs text-muted-foreground">{clock}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground/70">{t("cg.eta.hint")}</p>
                </div>
              );
            })()}
          </div>

          {/* Composer */}
          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2 py-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("cg.format")}</span>
                <div className="flex flex-wrap items-center gap-1">
                  {(["auto", "1:1", "9:16", "4:5", "16:9"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setImgFormat(f)}
                      disabled={sending}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                        imgFormat === f
                          ? "bg-white text-black"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                      }`}
                    >
                      {f === "auto" ? t("cg.format.auto") : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2 py-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("cg.market")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={t("cg.market.placeholder")}
                  disabled={sending}
                  className="w-36 bg-transparent text-xs px-1 py-0.5 placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-40"
                />
              </div>
              <button
                type="button"
                role="checkbox"
                aria-checked={watermark}
                onClick={() => setWatermark((v) => !v)}
                disabled={sending}
                title={t("cg.watermark.title")}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-[7px] text-xs font-medium transition-colors disabled:opacity-40 ${
                  watermark
                    ? "border-white/20 bg-white/[0.06] text-foreground"
                    : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors ${
                    watermark ? "border-white bg-white text-black" : "border-white/25 bg-transparent"
                  }`}
                >
                  {watermark && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {t("cg.watermark")}
              </button>
              <button
                type="button"
                role="checkbox"
                aria-checked={carousel}
                onClick={() => setCarousel((v) => !v)}
                disabled={sending}
                title={t("cg.carousel.title")}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-[7px] text-xs font-medium transition-colors disabled:opacity-40 ${
                  carousel
                    ? "border-white/20 bg-white/[0.06] text-foreground"
                    : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                }`}
              >
                <Images className="h-3.5 w-3.5" />
                {t("cg.carousel")}
              </button>
            </div>
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pending.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-white/[0.04] text-xs"
                  >
                    {p.isImage ? (
                      <img src={p.dataUrl} alt={p.name} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[140px] truncate">{p.name}</span>
                    <button
                      onClick={() => setPending((arr) => arr.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 focus-within:border-white/15 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.csv,.json"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || pending.length >= MAX_ATTACHMENTS}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors disabled:opacity-40 shrink-0"
                aria-label={t("cg.attach")}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t("cg.placeholder")}
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none max-h-[200px]"
              />
              <button
                onClick={send}
                disabled={sending || (!input.trim() && pending.length === 0 && !marketId.trim())}
                className="p-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                aria-label={t("cg.send")}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-5 right-5 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-7 h-7" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  youLabel,
  assistantLabel,
  attachmentsLabel,
  onImageClick,
  onDownload,
}: {
  message: ContentGenMessage;
  youLabel: string;
  assistantLabel: string;
  attachmentsLabel: string;
  onImageClick: (url: string) => void;
  onDownload: (url: string, name: string) => void;
}) {
  const isUser = message.role === "user";
  const images = message.images ?? [];
  const attachments = message.attachments ?? [];
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-1.5 px-1">
        {isUser ? youLabel : assistantLabel}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-white/[0.06]" : "bg-white/[0.03] border border-white/[0.05]"
        }`}
      >
        {message.content && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((a, i) =>
              a.kind === "image" && a.dataUrl ? (
                <img
                  key={i}
                  src={a.dataUrl}
                  alt={a.name}
                  onClick={() => a.dataUrl && onImageClick(a.dataUrl)}
                  className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] text-xs"
                  title={attachmentsLabel}
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{a.name}</span>
                </div>
              ),
            )}
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {images.map((img, i) => (
              <div key={i} className="group relative rounded-xl overflow-hidden">
                <img
                  src={img.dataUrl}
                  alt=""
                  onClick={() => onImageClick(img.dataUrl)}
                  className="w-full rounded-xl cursor-pointer"
                />
                <button
                  onClick={() => onDownload(img.dataUrl, `antiq-content-${Date.now()}-${i + 1}.jpg`)}
                  className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
                  aria-label="download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
