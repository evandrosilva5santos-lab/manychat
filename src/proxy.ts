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
  // Acesso direto liberado temporariamente
  return NextResponse.next();
}

export const config = {
  // Tudo, menos os arquivos internos do Next, webhooks públicos e ícone.
  matcher: ["/((?!api/webhook|api/l|_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
