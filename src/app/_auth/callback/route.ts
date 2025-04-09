// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // Ursprüngliche Host-Angabe vor dem Load Balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // Lokale Umgebung – kein Load Balancer, daher einfach:
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // In Produktion: Falls ein Load Balancer verwendet wird, leite über dessen Host weiter
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Bei Fehler oder fehlendem Code den Benutzer auf eine Error-Seite leiten
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}