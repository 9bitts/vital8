import { LoginForm } from "@/modules/core/components/login-form";

export default function EntrarPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <LoginForm ssoError={searchParams.error} />
    </div>
  );
}
