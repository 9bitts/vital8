export function MobileSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}
