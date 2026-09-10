import { useState } from "react";
import { useGetTwitterPosts, useGetInstagramCarousels, useGetTwitterThreads } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Archive, Instagram, ChevronDown, ListOrdered } from "lucide-react";
import { XIcon } from "@/components/x-icon";
import { useI18n } from "@/lib/i18n";

export default function ArchivePage() {
  const { t } = useI18n();
  const { data: twitterData, isLoading: twitterLoading } = useGetTwitterPosts({ archived: "true" });
  const { data: instagramData, isLoading: instagramLoading } = useGetInstagramCarousels({ archived: "true" });
  const { data: threadsData, isLoading: threadsLoading } = useGetTwitterThreads({ archived: "true" });

  const posts = twitterData?.posts || [];
  const carousels = instagramData?.carousels || [];
  const threads = threadsData?.threads || [];

  const [xOpen, setXOpen] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);

  return (
    <div className="p-4 md:p-12 w-full animate-in fade-in duration-700 ease-out">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-6 mb-8 md:mb-12 border-b border-border/50 pb-6 md:pb-8">
        <div className="flex items-center gap-3 min-w-0">
          <Archive className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{t("nav.archivo")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t("arch.subtitle")}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono shrink-0">
          {posts.length} X · {threads.length} {t("arch.threadsCount")} · {carousels.length} IG
        </div>
      </header>

      {/* X / Twitter Archive */}
      <section className="mb-6">
        <button
          onClick={() => setXOpen(!xOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 rounded-xl border border-border/30 bg-card/10 hover:bg-card/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <XIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-medium">
              X
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {posts.length} posts
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${xOpen ? "rotate-180" : ""}`} />
        </button>

        {xOpen && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {twitterLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-card/20 animate-pulse rounded-xl border border-border/30" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/30 rounded-xl text-muted-foreground/50 text-sm">
                {t("arch.empty.posts")}
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="p-5 rounded-xl border border-border/30 bg-card/10 opacity-70 hover:opacity-90 transition-opacity">
                  <p className="font-sans text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground/50 font-mono">
                    {format(new Date(post.createdAt), "HH:mm · MMM d, yyyy")}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Threads Archive */}
      <section className="mb-6">
        <button
          onClick={() => setThreadsOpen(!threadsOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 rounded-xl border border-border/30 bg-card/10 hover:bg-card/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ListOrdered className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-medium">
              {t("arch.threads")}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {threads.length} {t("arch.threadsCount")}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${threadsOpen ? "rotate-180" : ""}`} />
        </button>

        {threadsOpen && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {threadsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-32 bg-card/20 animate-pulse rounded-xl border border-border/30" />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/30 rounded-xl text-muted-foreground/50 text-sm">
                {t("arch.empty.threads")}
              </div>
            ) : (
              threads.map((thread) => (
                <div key={thread.id} className="p-5 rounded-xl border border-border/30 bg-card/10 opacity-70 hover:opacity-90 transition-opacity">
                  <p className="text-sm font-semibold text-foreground/70 tracking-wide mb-3">
                    {thread.title}
                  </p>
                  <div className="space-y-2">
                    {thread.tweets.map((tweet, idx) => (
                      <p key={idx} className="text-xs text-foreground/50 leading-relaxed pl-3 border-l border-border/20">
                        <span className="text-muted-foreground/40 font-mono mr-1.5">{idx + 1}.</span>
                        {tweet}
                      </p>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground/50 font-mono">
                    {format(new Date(thread.createdAt), "HH:mm · MMM d, yyyy")}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Instagram Archive */}
      <section className="mb-6">
        <button
          onClick={() => setIgOpen(!igOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 rounded-xl border border-border/30 bg-card/10 hover:bg-card/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Instagram className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground/80 font-medium">
              Instagram
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {carousels.length} {t("arch.carouselsCount")}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${igOpen ? "rotate-180" : ""}`} />
        </button>

        {igOpen && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {instagramLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 bg-card/20 animate-pulse rounded-xl border border-border/30" />
                ))}
              </div>
            ) : carousels.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/30 rounded-xl text-muted-foreground/50 text-sm">
                {t("arch.empty.carousels")}
              </div>
            ) : (
              carousels.map((carousel) => (
                <div key={carousel.id} className="p-5 rounded-xl border border-border/30 bg-card/10 opacity-70 hover:opacity-90 transition-opacity">
                  <p className="text-sm font-semibold text-foreground/70 tracking-wide mb-2">
                    {carousel.headline}
                  </p>
                  <p className="text-xs text-foreground/50 leading-relaxed line-clamp-2">
                    {carousel.contentParagraph1}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground/50 font-mono">
                    {format(new Date(carousel.createdAt), "HH:mm · MMM d, yyyy")}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
