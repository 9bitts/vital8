import { ApiReferenceEmbed } from "@/modules/api/components/api-reference-embed";

export default function DesenvolvedoresPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portal de desenvolvedores</h1>
        <p className="text-zinc-600">API REST Vital8 v1 — OpenAPI 3.1</p>
      </div>
      <p className="text-sm text-zinc-600">
        Autenticação, escopos, idempotência e webhooks: consulte{" "}
        <code className="text-xs bg-zinc-100 px-1 rounded">docs/api.md</code> no repositório.
      </p>
      <ApiReferenceEmbed />
    </div>
  );
}
