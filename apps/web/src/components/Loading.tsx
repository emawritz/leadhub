export default function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted text-[15px]">
      <span className="inline-block w-4 h-4 rounded-pill border-2 border-hairline border-t-accent animate-spin" />
      {label}
    </div>
  );
}
