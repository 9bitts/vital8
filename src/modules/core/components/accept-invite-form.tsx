"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acceptInvitationAction } from "@/modules/core/actions/organization.actions";

export function AcceptInviteForm({
  token,
  email,
  organizationName,
  isNewUser,
}: {
  token: string;
  email: string;
  organizationName: string;
  isNewUser: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await acceptInvitationAction({
      token,
      name: isNewUser ? name : undefined,
      password: isNewUser ? password : undefined,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (isNewUser && password) {
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
    }

    router.push(isNewUser ? "/app" : "/entrar");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
        <CardDescription>
          Você foi convidado para {organizationName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} disabled />
          </div>
          {isNewUser && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processando..." : "Aceitar convite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
