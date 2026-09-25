// Senha na porta do site, até o login de verdade (Etapa 6).
// O navegador pede usuário e senha (HTTP Basic). Configure na Vercel:
//   SITE_PASSWORD = a senha que você quiser (obrigatória em produção)
//   SITE_USER     = opcional, padrão "fluxo"
// Sem SITE_PASSWORD em produção, o site fica fechado (melhor fechado que aberto).
import { NextResponse, type NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  // Compara sem "vazar" pelo tempo de resposta quantos caracteres batem.
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const user = process.env.SITE_USER || "fluxo";

  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next(); // local: sem senha
    return new NextResponse("Site fechado: defina SITE_PASSWORD nas variáveis de ambiente.", { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [givenUser, ...rest] = atob(header.slice(6)).split(":");
    if (safeEqual(givenUser, user) && safeEqual(rest.join(":"), password)) return NextResponse.next();
  }

  return new NextResponse("Acesso restrito.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fluxo", charset="UTF-8"' },
  });
}

export const config = {
  // Tudo, menos os arquivos internos do Next e o ícone.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
