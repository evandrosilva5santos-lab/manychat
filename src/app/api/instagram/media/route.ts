import { NextResponse } from "next/server";
import { defaultGraphClient } from "@/lib/meta/graph";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    
    let limit = 25;
    const limitParam = searchParams.get("limit");
    if (limitParam && !isNaN(Number(limitParam))) {
      limit = Number(limitParam);
    }

    let targetUserId = userId;

    // Se temos um token mas não recebemos userId na query, 
    // tentamos buscar o ID validando a conexão (fallback inteligente)
    if (!targetUserId && process.env.IG_ACCESS_TOKEN && process.env.NODE_ENV !== "test") {
      const validation = await defaultGraphClient.validateConnection();
      if (validation.valid && validation.igUserId) {
        targetUserId = validation.igUserId;
      }
    }

    const result = await defaultGraphClient.getUserMedia(targetUserId, limit);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: [], error: error.message || String(error) },
      { status: 500 }
    );
  }
}
