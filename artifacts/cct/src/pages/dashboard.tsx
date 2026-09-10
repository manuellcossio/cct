import { Link } from "wouter";
import { useGetCctStats, useGetTwitterPosts, useGetInstagramCarousels } from "@workspace/api-client-react";
import { Instagram, Plus } from "lucide-react";
import { XIcon } from "@/components/x-icon";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetCctStats();
  const { data: twitterData } = useGetTwitterPosts();
  const { data: instaData } = useGetInstagramCarousels();

  return (
    <div className="p-4 md:p-12 w-full animate-in fade-in duration-700 ease-out">
      <header className="mb-8 md:mb-16">
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight mb-2">cct panel.</h1>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
        {/* Twitter Stats */}
        <div className="p-5 md:p-8 rounded-2xl border border-border bg-card/40 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <XIcon className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <XIcon className="h-6 w-6 text-foreground" />
              <h2 className="font-medium text-foreground tracking-wide uppercase text-sm">X Posts</h2>
            </div>
            <Link href="/twitter">
              <button
                aria-label="Generate"
                className="bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-all flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </Link>
          </div>
          <div className="flex items-end gap-6 relative z-10">
            <div>
              <div className="text-3xl md:text-5xl font-light tracking-tighter">{statsLoading ? "-" : stats?.twitterPostsToday || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 font-medium">Today</div>
            </div>
            <div className="h-10 w-px bg-border/50 mx-2"></div>
            <div>
              <div className="text-2xl md:text-3xl font-light tracking-tighter text-muted-foreground">{statsLoading ? "-" : stats?.twitterPostsTotal || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 font-medium">Total</div>
            </div>
          </div>
        </div>

        {/* Instagram Stats */}
        <div className="p-5 md:p-8 rounded-2xl border border-border bg-card/40 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Instagram className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Instagram className="h-6 w-6 text-foreground" />
              <h2 className="font-medium text-foreground tracking-wide uppercase text-sm">Instagram</h2>
            </div>
            <Link href="/instagram">
              <button
                aria-label="Generate"
                className="bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-all flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </Link>
          </div>
          <div className="flex items-end gap-6 relative z-10">
            <div>
              <div className="text-3xl md:text-5xl font-light tracking-tighter">{statsLoading ? "-" : stats?.instagramCarouselsToday || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 font-medium">Today</div>
            </div>
            <div className="h-10 w-px bg-border/50 mx-2"></div>
            <div>
              <div className="text-2xl md:text-3xl font-light tracking-tighter text-muted-foreground">{statsLoading ? "-" : stats?.instagramCarouselsTotal || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 font-medium">Total</div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-widest mb-6 text-muted-foreground border-b border-border/50 pb-4">
            Recent Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div className="space-y-4">
              <h4 className="text-xs text-foreground font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <XIcon className="w-3 h-3" /> Latest X Posts
              </h4>
              {twitterData?.posts?.slice(0, 3).map(post => (
                <div key={post.id} className="text-sm p-5 rounded-xl bg-card/20 border border-border/40 line-clamp-3 leading-relaxed hover:bg-card/40 transition-colors">
                  <span className="text-muted-foreground mr-3 font-mono text-xs">{format(new Date(post.createdAt), "MMM d")}</span>
                  {post.content}
                </div>
              ))}
              {!twitterData?.posts?.length && <div className="text-sm text-muted-foreground italic p-4">No recent tweets.</div>}
            </div>
            <div className="space-y-4">
              <h4 className="text-xs text-foreground font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Instagram className="w-3 h-3" /> Latest Carousels
              </h4>
              {instaData?.carousels?.slice(0, 3).map(car => (
                <div key={car.id} className="text-sm p-5 rounded-xl bg-card/20 border border-border/40 hover:bg-card/40 transition-colors flex items-start gap-4">
                  <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">{format(new Date(car.createdAt), "MMM d")}</span>
                  <span className="font-medium leading-relaxed">{car.headline}</span>
                </div>
              ))}
              {!instaData?.carousels?.length && <div className="text-sm text-muted-foreground italic p-4">No recent carousels.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}