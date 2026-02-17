export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060608]" aria-live="polite" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" role="status" aria-label="Chargement">
        <span className="sr-only">Chargement…</span>
      </div>
    </div>
  );
}
