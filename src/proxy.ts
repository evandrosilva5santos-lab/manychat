import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Modo de teste aberto: permite navegar livremente em todas as telas sem pop-up de senha
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
