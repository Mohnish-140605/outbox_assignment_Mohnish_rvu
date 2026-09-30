import { useSearchParams } from 'react-router-dom';

function googleAuthUrl(): string {
  const origin = import.meta.env.VITE_BACKEND_ORIGIN as string | undefined;
  const base = origin?.replace(/\/$/, '') ?? '';
  return `${base}/auth/google`;
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  let errorMessage: string | null = null;
  if (error === 'auth_denied') {
    errorMessage = 'Google sign-in was cancelled.';
  } else if (error === 'auth_not_configured') {
    errorMessage =
      'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env, then restart the backend.';
  } else if (error === 'auth_failed' || error === 'logout_failed') {
    errorMessage = 'Sign-in failed. Please try again.';
  } else if (error === 'slack_denied' || error === 'slack_failed' || error === 'slack_not_configured') {
    errorMessage = 'Slack connection failed. Sign in and try Connect Slack again.';
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">ReachInbox</h1>
        <p className="mt-2 text-sm text-gray-500">Sign in to schedule and manage your email campaigns.</p>

        {errorMessage && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <a
          href={googleAuthUrl()}
          className="mt-8 w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <GoogleGlyph />
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
