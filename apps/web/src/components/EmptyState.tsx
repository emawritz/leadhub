export default function EmptyState({ icon = '—', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-ink font-medium">{title}</p>
      {hint && <p className="text-muted text-[13px] mt-1">{hint}</p>}
    </div>
  );
}
