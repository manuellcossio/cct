import { useState, useEffect, useCallback } from "react";
import { useGetEngineNews, getGetEngineNewsQueryKey, useGenerateTwitterFromUrl, useGenerateInstagramFromUrl } from "@workspace/api-client-react";
import { Loader2, RefreshCw, Globe, ArrowLeft, ExternalLink, Instagram } from "lucide-react";
import { XIcon } from "@/components/x-icon";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";

interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  importance: number;
}

function getTimeSince(start: number): string {
  const seconds = Math.floor((Date.now() - start) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getImportanceDot(importance: number): string {
  if (importance >= 9) return "bg-red-500";
  if (importance >= 7) return "bg-orange-500";
  if (importance >= 5) return "bg-yellow-500";
  return "bg-blue-500";
}

function ArticleDetail({ article, onBack }: { article: Article; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const twitterMutation = useGenerateTwitterFromUrl();
  const instagramMutation = useGenerateInstagramFromUrl();

  const [error, setError] = useState<string | null>(null);
  const isGenerating = twitterMutation.isPending || instagramMutation.isPending;

  const handleXGen = () => {
    setError(null);
    twitterMutation.mutate(
      { data: { url: article.url, title: article.title, description: article.description, lang } },
      {
        onSuccess: () => setLocation("/twitter"),
        onError: () => setError(t("eng.error.twitter")),
      }
    );
  };

  const handleInstagramGen = () => {
    setError(null);
    instagramMutation.mutate(
      { data: { url: article.url, title: article.title, description: article.description, lang } },
      {
        onSuccess: () => setLocation("/instagram"),
        onError: () => setError(t("eng.error.instagram")),
      }
    );
  };

  if (isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <div className="text-sm font-medium">
          {twitterMutation.isPending ? t("eng.loading.twitter") : t("eng.loading.instagram")}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{t("eng.loading.hint")}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-2 h-2 rounded-full", getImportanceDot(article.importance))} />
          <span className="text-xs text-muted-foreground">{article.source}</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-6 break-words">
          {article.title}
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed mb-10 break-words">
          {article.description}
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={handleXGen}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            <XIcon className="h-4 w-4" />
            Gen
          </button>
          <button
            onClick={handleInstagramGen}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            <Instagram className="h-4 w-4" />
            Gen
          </button>
        </div>
        {error && (
          <div className="text-xs text-red-400 mb-4">{error}</div>
        )}

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {article.source}
        </a>
      </div>
    </div>
  );
}

export default function EnginePage() {
  const [lastFetched, setLastFetched] = useState<number>(Date.now());
  const [timeAgo, setTimeAgo] = useState("just now");
  const [autoRefresh] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const { data, isLoading, isFetching, refetch } = useGetEngineNews({
    query: {
      queryKey: getGetEngineNewsQueryKey(),
      refetchInterval: autoRefresh ? 120000 : false,
      staleTime: 60000,
    },
  });

  useEffect(() => {
    if (data && !isFetching) {
      setLastFetched(Date.now());
    }
  }, [data, isFetching]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeSince(lastFetched));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastFetched]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const articles = data?.articles ?? [];

  if (selectedArticle) {
    return <ArticleDetail article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <div className="flex-1 p-4 md:p-8 w-full">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">cct engine</h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {articles.length} headlines
            {data?.totalFetched ? ` · ${data.totalFetched} scanned` : ""}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/60">
          Updated {timeAgo}
        </span>
      </div>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 md:py-20 space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <div className="text-sm text-muted-foreground">Scanning news sources...</div>
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 md:py-20 space-y-3">
          <Globe className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">No breaking news found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article, i) => (
            <div
              key={i}
              onClick={() => setSelectedArticle(article as Article)}
              className="group rounded-lg border border-border/20 p-4 transition-all duration-200 hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", getImportanceDot(article.importance))} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-muted-foreground/50 truncate">{article.source}</span>
                  </div>
                  <h3 className="text-sm font-medium leading-snug mb-1 text-foreground/90 group-hover:text-foreground transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                    {article.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}