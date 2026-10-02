import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Finance OS" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Finance OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your private dashboard.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
