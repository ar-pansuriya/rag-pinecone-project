import { login } from './actions';
import { SubmitButton } from '@/components/submit-button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white p-4 font-sans">
      {/* Background Blobs for Glass Effect to show up */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-primary/10 bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col items-center justify-center space-y-1.5 p-8 pb-6 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-card-foreground">
            Welcome back
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        <form action={login} className="space-y-4 px-8 pb-8">
          {resolvedSearchParams?.error && (
            <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {resolvedSearchParams.error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium leading-none text-foreground"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. arpansuriya"
              autoComplete="username"
              defaultValue="arpansuriya"
              required
              className="flex h-9 w-full rounded-sm border border-input bg-gray-50 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none text-foreground"
              >
                Password
              </label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              defaultValue="123456789"
              required
              className="flex h-9 w-full rounded-sm border border-input bg-gray-50 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
