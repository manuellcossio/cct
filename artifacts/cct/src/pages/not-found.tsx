export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black gap-6">
      <img
        src="/antiq-logo.png"
        alt="antiq"
        className="h-12 w-auto"
        style={{ filter: "brightness(0) invert(1)" }}
      />
      <p className="text-sm text-white/60 tracking-wide">
        This page was removed or modified
      </p>
    </div>
  );
}
