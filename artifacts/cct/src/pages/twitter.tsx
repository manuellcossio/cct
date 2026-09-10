import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTwitterPosts,
  useGenerateTwitterPosts,
  useDeleteTwitterPost,
  useMarkTwitterPostAsPosted,
  useGetTwitterThreads,
  useGenerateTwitterThreads,
  useGenerateMarketThread,
  useDeleteTwitterThread,
  useMarkTwitterThreadAsPosted,
  getGetTwitterPostsQueryKey,
  getGetTwitterThreadsQueryKey,
  getGetCctStatsQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Copy, Trash2, Check, Loader2, Sparkles, CheckCheck, MessageSquareText, ListOrdered, BarChart3, X, ImageIcon, Download } from "lucide-react";
import { XIcon } from "@/components/x-icon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function playComplete() {
  try { new Audio(`${BASE}/complete.mp3`).play(); } catch {}
}

type Tab = "posts" | "threads";

export default function TwitterPage() {
  const queryClient = useQueryClient();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("posts");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: postsData, isLoading: postsLoading } = useGetTwitterPosts();
  const generatePostsMutation = useGenerateTwitterPosts();
  const deletePostMutation = useDeleteTwitterPost();
  const postedPostMutation = useMarkTwitterPostAsPosted();

  const { data: threadsData, isLoading: threadsLoading } = useGetTwitterThreads();
  const generateThreadsMutation = useGenerateTwitterThreads();
  const deleteThreadMutation = useDeleteTwitterThread();
  const postedThreadMutation = useMarkTwitterThreadAsPosted();

  const generateMarketMutation = useGenerateMarketThread();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [marketWizardOpen, setMarketWizardOpen] = useState(false);
  const [marketIdInput, setMarketIdInput] = useState("");

  const posts = postsData?.posts || [];
  const threads = threadsData?.threads || [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGeneratePosts = () => {
    setDropdownOpen(false);
    setTab("posts");
    generatePostsMutation.mutate({ data: { lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTwitterPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("tw.postsGenerated"));
      },
      onError: () => toast.error(t("tw.postsError")),
    });
  };

  const handleGenerateThreads = () => {
    setDropdownOpen(false);
    setTab("threads");
    generateThreadsMutation.mutate({ data: { lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTwitterThreadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("tw.threadsGenerated"));
      },
      onError: () => toast.error(t("tw.threadsError")),
    });
  };

  const handleOpenMarketWizard = () => {
    setDropdownOpen(false);
    setMarketIdInput("");
    setMarketWizardOpen(true);
  };

  const handleGenerateMarketThread = () => {
    if (!marketIdInput.trim() || !/^\d+$/.test(marketIdInput.trim())) {
      toast.error(t("tw.invalidMarket"));
      return;
    }
    setMarketWizardOpen(false);
    setTab("threads");
    generateMarketMutation.mutate({ data: { marketId: marketIdInput.trim(), lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTwitterThreadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("tw.marketThreadGenerated"));
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || t("tw.marketThreadError");
        toast.error(msg);
      },
    });
  };

  const handleDeletePost = (id: number) => {
    deletePostMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetTwitterPostsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, posts: old.posts.filter((p: any) => p.id !== id) };
        });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        toast.success(t("tw.postDeleted"));
      }
    });
  };

  const handleDeleteThread = (id: number) => {
    deleteThreadMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetTwitterThreadsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, threads: old.threads.filter((t: any) => t.id !== id) };
        });
        toast.success(t("tw.threadDeleted"));
      }
    });
  };

  const handleCopy = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success(t("common.copiedClipboard"));
  };

  const handleCopyThread = (thread: { title: string; tweets: string[] }) => {
    const numbered = thread.tweets.map((t, i) => `${i + 1}/${thread.tweets.length} ${t}`).join("\n\n");
    handleCopy(`thread-all-${thread.title}`, numbered);
  };

  const handleDownloadImage = async (url: string, title: string) => {
    try {
      const proxyUrl = `${import.meta.env.BASE_URL}api/cct/image-proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("proxy failed");
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_").slice(0, 50)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success(t("common.imageDownloaded"));
    } catch {
      toast.error(t("common.imageDownloadFailed"));
    }
  };

  const handlePostedPost = (id: number) => {
    postedPostMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetTwitterPostsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, posts: old.posts.filter((p: any) => p.id !== id) };
        });
        toast.success(t("common.movedToArchive"));
      },
      onError: () => toast.error(t("common.archiveError")),
    });
  };

  const handlePostedThread = (id: number) => {
    postedThreadMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetTwitterThreadsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, threads: old.threads.filter((t: any) => t.id !== id) };
        });
        toast.success(t("tw.threadMovedToArchive"));
      },
      onError: () => toast.error(t("tw.threadArchiveError")),
    });
  };

  const isGenerating = generatePostsMutation.isPending || generateThreadsMutation.isPending || generateMarketMutation.isPending;

  return (
    <div className="p-4 md:p-12 w-full animate-in fade-in duration-700 ease-out">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 md:mb-12 border-b border-border/50 pb-6 md:pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <XIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isGenerating}
            className="px-6 h-11 rounded-full font-medium"
          >
            {isGenerating ? t("common.generating") : t("common.generate")}
          </Button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
              <button
                onClick={handleGeneratePosts}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
              >
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{t("tw.menu.posts")}</div>
                  <div className="text-xs text-muted-foreground">{t("tw.menu.postsDesc")}</div>
                </div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={handleGenerateThreads}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{t("tw.menu.threads")}</div>
                  <div className="text-xs text-muted-foreground">{t("tw.menu.threadsDesc")}</div>
                </div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={handleOpenMarketWizard}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
              >
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{t("tw.menu.market")}</div>
                  <div className="text-xs text-muted-foreground">{t("tw.menu.marketDesc")}</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </header>

      {isGenerating && (
        <div className="mb-6 md:mb-12 p-6 md:p-10 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center space-y-5 animate-pulse backdrop-blur-sm">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <div className="space-y-1">
            <div className="font-medium text-lg">
              {generateMarketMutation.isPending ? t("tw.loading.market") : generateThreadsMutation.isPending ? t("tw.loading.threads") : t("tw.loading.posts")}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-8 bg-muted/30 p-1 rounded-full w-fit">
        <button
          onClick={() => setTab("posts")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            tab === "posts"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquareText className="h-3.5 w-3.5" />
            {t("tw.tab.posts")}
            {posts.length > 0 && <span className="text-xs opacity-60">({posts.length})</span>}
          </span>
        </button>
        <button
          onClick={() => setTab("threads")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            tab === "threads"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <ListOrdered className="h-3.5 w-3.5" />
            {t("tw.tab.threads")}
            {threads.length > 0 && <span className="text-xs opacity-60">({threads.length})</span>}
          </span>
        </button>
      </div>

      {tab === "posts" && (
        <>
          {postsLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-card/20 animate-pulse rounded-2xl border border-border/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.id} className="group relative p-5 md:p-8 rounded-2xl border border-border/50 bg-card/20 hover:bg-card/40 transition-all duration-300">
                  <div className="pr-16 whitespace-pre-wrap font-sans text-base leading-relaxed text-foreground/90">
                    {post.content}
                  </div>
                  <div className="mt-6 pt-6 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>{format(new Date(post.createdAt), "HH:mm • MMM d, yyyy")}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      title={t("common.markPosted")}
                      className="h-7 px-3 rounded-full text-xs text-muted-foreground hover:text-green-500 hover:bg-green-500/10 gap-1.5 transition-all"
                      onClick={() => handlePostedPost(post.id)}
                      disabled={postedPostMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Posted
                    </Button>
                  </div>
                  <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm transition-all"
                      onClick={() => handleCopy(`post-${post.id}`, post.content)}
                    >
                      {copiedId === `post-${post.id}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border/50 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all text-muted-foreground"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletePostMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {posts.length === 0 && !generatePostsMutation.isPending && (
                <div className="text-center p-8 md:p-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground flex flex-col items-center justify-center">
                  <XIcon className="h-8 w-8 mb-4 opacity-50" />
                  <p>{t("tw.empty.posts")}</p>
                  <p className="text-sm mt-1">{t("tw.empty.postsHint")}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "threads" && (
        <>
          {threadsLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-card/20 animate-pulse rounded-2xl border border-border/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {threads.map((thread) => (
                <div key={thread.id} className="group rounded-2xl border border-border/50 bg-card/20 hover:bg-card/40 transition-all duration-300 overflow-hidden">
                  <div className="p-4 md:p-6 pb-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground mb-1 break-words">{thread.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{format(new Date(thread.createdAt), "HH:mm • MMM d, yyyy")}</span>
                        <span className="bg-muted/50 px-2 py-0.5 rounded-full">{thread.tweets.length} {t("tw.tweetsCount")}</span>
                        {thread.sourceArticles && thread.sourceArticles.length > 0 && (
                          <span className="text-muted-foreground/60">
                            {t("tw.sources")}: {thread.sourceArticles.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 px-4 rounded-full bg-background/80 backdrop-blur border border-border/50 hover:bg-primary hover:text-primary-foreground gap-2 text-xs font-medium"
                        onClick={() => handleCopyThread(thread)}
                      >
                        {copiedId === `thread-all-${thread.title}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {t("tw.copyThread")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border/50 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all text-muted-foreground"
                        onClick={() => handleDeleteThread(thread.id)}
                        disabled={deleteThreadMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="px-4 md:px-6 pb-2">
                    <div className="border-l-2 border-primary/20 ml-3">
                      {thread.tweets.map((tweet, idx) => (
                        <div key={idx} className="relative pl-6 pb-5 last:pb-3 group/tweet">
                          <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary/40 border-2 border-background" />
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0 w-8">{idx + 1}/{thread.tweets.length}</span>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm leading-relaxed text-foreground/85">{tweet}</p>
                              {idx === 0 && thread.hookImageUrl && (
                                <div className="relative rounded-xl overflow-hidden border border-border/40 max-w-sm">
                                  <img
                                    src={thread.hookImageUrl}
                                    alt={thread.title}
                                    className="w-full h-auto max-h-48 object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3 text-white/70" />
                                    <span className="text-[10px] text-white/70">Hook</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {idx === 0 && thread.hookImageUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t("tw.downloadImage")}
                                  className="h-7 w-7 rounded-full opacity-0 group-hover/tweet:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                  onClick={() => handleDownloadImage(thread.hookImageUrl!, thread.title)}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full opacity-0 group-hover/tweet:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopy(`tweet-${thread.id}-${idx}`, tweet)}
                              >
                                {copiedId === `tweet-${thread.id}-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 md:px-6 pb-5 pt-2 border-t border-border/30 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      title={t("common.markPosted")}
                      className="h-7 px-3 rounded-full text-xs text-muted-foreground hover:text-green-500 hover:bg-green-500/10 gap-1.5 transition-all"
                      onClick={() => handlePostedThread(thread.id)}
                      disabled={postedThreadMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Posted
                    </Button>
                  </div>
                </div>
              ))}
              {threads.length === 0 && !generateThreadsMutation.isPending && (
                <div className="text-center p-8 md:p-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground flex flex-col items-center justify-center">
                  <ListOrdered className="h-8 w-8 mb-4 opacity-50" />
                  <p>{t("tw.empty.threads")}</p>
                  <p className="text-sm mt-1">{t("tw.empty.threadsHint")}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {marketWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between p-4 md:p-6 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Market Based Thread</h2>
              </div>
              <button
                onClick={() => setMarketWizardOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-5">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  {t("tw.marketWizard.label")}
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm text-muted-foreground/60 font-mono shrink-0 break-all">opinionmarket.mx/markets/</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={marketIdInput}
                    onChange={(e) => setMarketIdInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerateMarketThread()}
                    placeholder="689"
                    autoFocus
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("tw.marketWizard.hint")}
              </p>
              <Button
                onClick={handleGenerateMarketThread}
                disabled={!marketIdInput.trim()}
                className="w-full gap-2 h-11 rounded-full font-medium"
              >
                <Sparkles className="h-4 w-4" />
                {t("tw.marketWizard.generate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
