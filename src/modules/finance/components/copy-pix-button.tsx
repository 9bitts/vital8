"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyPixButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado!" : "Copiar PIX"}
    </Button>
  );
}
