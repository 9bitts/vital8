"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="no-print mb-4 rounded border px-3 py-1 text-sm"
      onClick={() => window.print()}
    >
      Imprimir / PDF
    </button>
  );
}
