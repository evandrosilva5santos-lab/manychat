// Senha na porta do site (HTTP Basic) até o login de verdade com contas (item 8),
// mais Content-Security-Policy com nonce em todas as respostas.
//   SITE_PASSWORD = obrigatória em produção (sem ela o site fica fechado)
//   SITE_USER     = opcional, padrão "fluxo"
// Rotas públicas (webhook da Meta, links rastreados, páginas legais, /conectar) não pedem senha.
import { NextResponse, type NextRequest } from "next/server";
import { BASIC_AUTH_REALM, evaluateBasicAuth, isPublicPath, readBasicAuthConfig } from "@/lib/auth/basic";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";

export function proxy(request: NextRequest) {
  if (!isPublicPath(request.nextUrl.pathname)) {
    const result = evaluateBasicAuth(request.headers.get("authorization"), readBasicAuthConfig());
    if (result === "misconfigured") {
      return new NextResponse("Site fechado: configure SITE_PASSWORD.", { status: 503 });
    }
    if (result === "unauthorized") {
      return new NextResponse("Autenticação necessária.", {
        status: 401,
        headers: { "WWW-Authenticate": `Basic realm="${BASIC_AUTH_REALM}", charset="UTF-8"` },
      });
    }
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Tudo, menos os arquivos estáticos do Next e o ícone.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
