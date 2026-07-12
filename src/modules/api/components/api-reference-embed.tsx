"use client";

export function ApiReferenceEmbed() {
  const specUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/openapi.json`
      : "/api/v1/openapi.json";

  const iframeSrc = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.56/dist/browser/standalone.html#apiDescriptionUrl=${encodeURIComponent(specUrl)}`;

  return (
    <div className="rounded-lg border overflow-hidden min-h-[70vh]">
      <iframe title="Vital8 API Reference" src={iframeSrc} className="w-full min-h-[70vh] border-0" />
    </div>
  );
}
