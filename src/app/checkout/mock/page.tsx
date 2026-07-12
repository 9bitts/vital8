import { Suspense } from "react";
import MockCheckoutClient from "./checkout-client";

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Carregando checkout...</p>}>
      <MockCheckoutClient />
    </Suspense>
  );
}
