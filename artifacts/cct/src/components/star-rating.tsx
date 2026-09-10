import { useState, useEffect } from "react";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const STORAGE_KEY = "cct_ratings";

function getRatings(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRating(key: string, value: number) {
  const ratings = getRatings();
  ratings[key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
}

function getRating(key: string): number | null {
  const ratings = getRatings();
  return ratings[key] ?? null;
}

export function useRating(type: "ig" | "ad", id: number) {
  const key = `${type}_${id}`;
  const [rating, setR] = useState<number | null>(() => getRating(key));

  const save = (value: number) => {
    if (rating !== null) return;
    saveRating(key, value);
    setR(value);
  };

  return { rating, save, hasRating: rating !== null };
}

export function StarRatingButton({
  type,
  id,
  size = "sm",
}: {
  type: "ig" | "ad";
  id: number;
  size?: "sm" | "md";
}) {
  const { rating, save, hasRating } = useRating(type, id);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setSelected(0);
      setHover(null);
    }
  }, [open]);

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  const handleConfirm = () => {
    if (selected > 0 && !hasRating) {
      save(selected);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { if (!hasRating) setOpen(true); }}
        className={`${btnSize} rounded-full flex items-center justify-center transition-all ${
          hasRating
            ? rating! >= 4
              ? "text-green-400 bg-green-400/10 cursor-default"
              : "text-red-400 bg-red-400/10 cursor-default"
            : "text-muted-foreground hover:text-muted-foreground/80 hover:bg-white/5 cursor-pointer"
        }`}
        title={hasRating ? `${rating}/5` : "Rate"}
      >
        {hasRating ? (
          rating! >= 4 ? (
            <ThumbsUp className={iconSize} fill="currentColor" />
          ) : (
            <ThumbsDown className={iconSize} fill="currentColor" />
          )
        ) : (
          <ThumbsDown className={iconSize} />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[260px] p-0 bg-[#0a0a0a] border-border/40 rounded-2xl overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">Rate Generation</DialogTitle>
          <div className="p-5 flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
              Rate
            </p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hover ?? selected) >= star;
                return (
                  <button
                    key={star}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelected(star)}
                    className="p-1 transition-all cursor-pointer hover:scale-110"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        active ? "text-amber-400" : "text-white/15"
                      }`}
                      fill={active ? "currentColor" : "none"}
                      strokeWidth={1.5}
                    />
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleConfirm}
              disabled={selected === 0}
              className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
