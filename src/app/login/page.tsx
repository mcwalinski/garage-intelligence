import Link from "next/link";
import { signInWithGoogle } from "@/app/login/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page-shell auth-page">
      <section className="auth-card card">
        <span className="eyebrow">Sign in</span>
        <h1>Connect your garage account</h1>
        <p>
          Google is the launch sign-in method for the initial Vercel and Supabase stack.
        </p>
        {params.error ? <p className="auth-error">{params.error}</p> : null}
        <form action={signInWithGoogle}>
          <button type="submit" className="button button--primary">
            Continue with Google
          </button>
        </form>
        <Link href="/" className="button button--ghost">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
