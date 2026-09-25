"use client";

import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ChevronLeft,
  MoreHorizontal,
  Phone,
  Video,
  Camera,
  Image as ImageIcon,
  Smile,
  Plus,
  Wifi,
  Battery,
  Home,
  Search,
  PlusSquare,
  Film,
  ExternalLink,
} from "lucide-react";
import type { Recipe } from "@/lib/flow/recipe";

type Props = {
  recipe: Recipe;
  accountUsername?: string;
  activeTab?: "post" | "comments" | "dm";
  onTabChange?: (tab: "post" | "comments" | "dm") => void;
};

export function DmPreview({
  recipe,
  accountUsername = "movingfestival",
  activeTab: controlledTab,
  onTabChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<"post" | "comments" | "dm">("post");
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  const [liked, setLiked] = useState(false);
  const [commentLiked1, setCommentLiked1] = useState(false);
  const [commentLiked2, setCommentLiked2] = useState(false);

  const keyword = recipe.trigger.keywords[0] ?? "Casamento";
  const publicReply = recipe.trigger.publicReplies.enabled
    ? recipe.trigger.publicReplies.variations.find((r) => r.trim()) ||
      "Que bom que você vai casar na Moving! 💍✨ Olha tua DM"
    : "Que bom que você vai casar na Moving! 💍✨ Olha tua DM";

  const welcomeEnabled = recipe.welcome.enabled !== false;
  const followGateEnabled = recipe.followGate.enabled;
  const reminderEnabled = recipe.reminder.enabled;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ── CELULAR IPHONE REALISTA (ManyChat Live Simulator) ── */}
      <div className="relative w-[340px] h-[670px] rounded-[48px] border-[10px] border-[#18181b] bg-[#000000] text-[#f4f4f5] shadow-2xl overflow-hidden font-sans select-none flex flex-col">
        {/* Dynamic Island + Barra de Status iOS */}
        <div className="flex h-11 w-full flex-none items-center justify-between px-6 pt-2 text-[12px] font-semibold text-white/90 z-20">
          <span>4:39</span>
          <div className="h-4 w-20 rounded-full bg-black mx-auto" />
          <div className="flex items-center gap-1.5 text-white/80">
            <Wifi size={13} />
            <Battery size={15} />
          </div>
        </div>

        {/* ── 1. TELA: PUBLICAR (Post / Reel) ── */}
        {tab === "post" && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
            {/* Top Bar da Postagem */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <ChevronLeft size={20} className="text-white cursor-pointer" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {accountUsername.toUpperCase()}
                </span>
                <span className="text-[13px] font-bold text-white">Publicação</span>
              </div>
              <MoreHorizontal size={18} className="text-white/60" />
            </div>

            {/* Conteúdo do Post */}
            <div className="flex-1 flex flex-col px-3 pt-1 overflow-y-auto">
              {/* Header do Autor */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1.5px]">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[9px] font-bold text-white uppercase">
                      {accountUsername.slice(0, 1)}
                    </div>
                  </div>
                  <span className="font-semibold text-[13px] text-white">
                    {accountUsername}
                  </span>
                </div>
                <MoreHorizontal size={16} className="text-white/60" />
              </div>

              {/* Mídia do Post com transição suave */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#18191e] border border-white/10 shadow-inner flex items-center justify-center">
                {recipe.trigger.scope === "specific" && (recipe.trigger.mediaUrl || recipe.trigger.mediaId) ? (
                  <div
                    key={recipe.trigger.mediaId || recipe.trigger.mediaUrl}
                    className="relative h-full w-full animate-in fade-in zoom-in-95 duration-300 ease-out"
                  >
                    <img
                      src={
                        recipe.trigger.mediaUrl ||
                        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80"
                      }
                      alt="Postagem selecionada"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold text-white border border-white/20">
                      POST
                    </div>
                  </div>
                ) : recipe.trigger.scope === "next" ? (
                  <div
                    key="next"
                    className="h-full w-full flex items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300 ease-out"
                  >
                    <p className="text-[15px] font-medium text-white/90 leading-snug max-w-[220px]">
                      Sua automação funcionará na próxima publicação ou reel
                    </p>
                  </div>
                ) : (
                  <div
                    key="any"
                    className="h-full w-full flex items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300 ease-out"
                  >
                    <p className="text-[15px] font-medium text-white/90 leading-snug max-w-[220px]">
                      Sua automação funcionará em qualquer postagem ou vídeo
                    </p>
                  </div>
                )}
              </div>

              {/* Ações do Post */}
              <div className="flex items-center justify-between py-2.5 px-1 text-white/90">
                <div className="flex items-center gap-4">
                  {/* Like Button */}
                  <div
                    onClick={() => setLiked(!liked)}
                    className="flex items-center gap-1.5 cursor-pointer select-none group"
                  >
                    <Heart
                      size={21}
                      className={`transition-all duration-200 ${
                        liked
                          ? "fill-rose-500 text-rose-500 scale-115"
                          : "group-hover:text-rose-400 group-hover:scale-110"
                      }`}
                    />
                    <span className="text-[12.5px] font-semibold">
                      {liked ? 262 : 261}
                    </span>
                  </div>

                  {/* Comment Button (abre Comentários) */}
                  <div
                    className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => setTab("comments")}
                    title="Ver comentários"
                  >
                    <MessageCircle size={21} />
                    <span className="text-[12.5px] font-semibold">2</span>
                  </div>

                  {/* Direct Button (abre DM) */}
                  <button
                    type="button"
                    className="cursor-pointer hover:text-white transition-colors text-white/90"
                    onClick={() => setTab("dm")}
                    title="Ver conversa no direct"
                  >
                    <Send size={20} />
                  </button>
                </div>

                <Bookmark size={20} className="cursor-pointer hover:text-white transition-colors" />
              </div>

              {/* Legenda e Data */}
              <div className="flex flex-col gap-1 text-[12px] px-1 text-white/80 pb-2">
                <p className="line-clamp-3 text-[12px] leading-snug text-white/90">
                  <span className="font-bold text-white mr-1.5">{accountUsername}</span>
                  {recipe.trigger.scope === "specific" && recipe.trigger.mediaCaption
                    ? recipe.trigger.mediaCaption
                    : "É PEDIR DEMAIS? 🥺🙏 Heeey Moving Maníacos 🗣 O que vocês também ELIMINARIAM? ❌ Garanta hoje o seu ingresso (link na bio @movingfestival)"}
                </p>

                <div
                  onClick={() => setTab("comments")}
                  className="text-white/50 text-[12px] hover:text-white cursor-pointer mt-1"
                >
                  Ver todos os comentários
                </div>
                <div className="text-[10px] text-white/40 uppercase">24 Sep, 2026</div>
              </div>
            </div>

            {/* Bottom Nav Instagram */}
            <div className="flex h-12 w-full flex-none items-center justify-around border-t border-white/10 px-4 text-white/70 bg-[#000000]">
              <Home size={20} className="text-white" />
              <Search size={20} />
              <PlusSquare size={20} />
              <Film size={20} />
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px]">
                <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[9px] font-bold text-white uppercase">
                  {accountUsername.slice(0, 1)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. TELA: COMENTÁRIOS (Bottom Sheet Instagram) ── */}
        {tab === "comments" && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#121214] animate-in fade-in duration-200">
            {/* Sheet Handle + Top Bar */}
            <div className="flex flex-col items-center pt-2 pb-1 border-b border-white/10 px-4">
              <div className="h-1 w-10 rounded-full bg-white/30 mb-2" />
              <div className="w-full flex items-center justify-between">
                <div className="w-5" />
                <span className="text-[14px] font-bold text-white">Comentários</span>
                <Send size={18} className="text-white/70 cursor-pointer" onClick={() => setTab("dm")} />
              </div>
            </div>

            {/* Lista de Comentários */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs">
              {/* Comentário do Usuário */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex-none flex items-center justify-center text-white/60 font-bold text-[11px]">
                    U
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-[12px]">Usuário</span>
                      <span className="text-[10px] text-white/40">Agora</span>
                    </div>
                    <p className="text-[12.5px] text-white/90 font-medium break-words">
                      {keyword}
                    </p>
                    <button type="button" className="text-[11px] text-white/40 hover:text-white mt-0.5 self-start">
                      Responder
                    </button>
                  </div>
                </div>
                <Heart
                  size={14}
                  onClick={() => setCommentLiked1(!commentLiked1)}
                  className={`flex-none mt-1 cursor-pointer transition-colors ${
                    commentLiked1 ? "fill-rose-500 text-rose-500" : "text-white/40 hover:text-white"
                  }`}
                />
              </div>

              {/* Resposta da Página (movingfestival) */}
              <div className="flex items-start justify-between gap-3 ml-6 pl-2 border-l-2 border-white/10">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px]">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[8px] font-bold text-white uppercase">
                      {accountUsername.slice(0, 1)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-[12px]">{accountUsername}</span>
                      <span className="text-[10px] text-white/40">Agora</span>
                    </div>
                    <p className="text-[12px] text-white/90 break-words">
                      {publicReply}
                    </p>
                    <button type="button" className="text-[11px] text-white/40 hover:text-white mt-0.5 self-start">
                      Responder
                    </button>
                  </div>
                </div>
                <Heart
                  size={14}
                  onClick={() => setCommentLiked2(!commentLiked2)}
                  className={`flex-none mt-1 cursor-pointer transition-colors ${
                    commentLiked2 ? "fill-rose-500 text-rose-500" : "text-white/40 hover:text-white"
                  }`}
                />
              </div>
            </div>

            {/* Barra de Reação Rápida com Emojis */}
            <div className="flex items-center justify-around py-2 px-3 border-t border-white/5 text-[18px]">
              <span className="cursor-pointer hover:scale-125 transition-transform">❤️</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">🙌</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">🔥</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">👏</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">😢</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">😍</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">😮</span>
              <span className="cursor-pointer hover:scale-125 transition-transform">😂</span>
            </div>

            {/* Input Fake de Comentário */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-[#09090b]">
              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px] flex-none">
                <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[8px] font-bold text-white uppercase">
                  {accountUsername.slice(0, 1)}
                </div>
              </div>
              <div className="flex-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/40 truncate">
                Insira um comentário para {accountUsername}...
              </div>
            </div>
          </div>
        )}

        {/* ── 3. TELA: CONVERSA NA DM (Direct Message Chat) ── */}
        {tab === "dm" && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#000000] animate-in fade-in duration-200">
            {/* Header da DM */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ChevronLeft
                  size={20}
                  className="text-white cursor-pointer"
                  onClick={() => setTab("post")}
                />
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px]">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[8px] font-bold text-white uppercase">
                      {accountUsername.slice(0, 1)}
                    </div>
                  </div>
                  <span className="font-bold text-[13px] text-white">
                    {accountUsername}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <Phone size={17} className="cursor-pointer hover:text-white" />
                <Video size={19} className="cursor-pointer hover:text-white" />
              </div>
            </div>

            {/* Timeline da Conversa */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 text-xs">
              {/* 1. Mensagem de Boas-Vindas */}
              {welcomeEnabled && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                  {/* Mensagem da Marca */}
                  <div className="flex items-end gap-1.5 max-w-[85%]">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px] flex-none">
                      <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[7px] font-bold text-white uppercase">
                        {accountUsername.slice(0, 1)}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-2xl bg-[#26262b] overflow-hidden border border-white/5 shadow-sm">
                      <div className="p-3 text-[12px] leading-relaxed text-white whitespace-pre-line">
                        {recipe.welcome.text ||
                          "AAAAH! 💍✨\nQue bom saber que você quer casar na Movin!\n\nVou te passar todas as informações de como participar do casamento. 👇"}
                      </div>
                      {recipe.welcome.buttonTitle && (
                        <div className="border-t border-white/10 bg-[#323238]/60 p-2 text-center text-[11px] font-bold text-white uppercase tracking-wider">
                          {recipe.welcome.buttonTitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resposta do Usuário tocando no botão */}
                  {recipe.welcome.buttonTitle && (
                    <div className="self-end rounded-2xl rounded-tr-xs bg-[#6366f1] text-white font-medium px-3.5 py-2 text-[11.5px] max-w-[80%] text-right shadow-sm uppercase tracking-wide">
                      {recipe.welcome.buttonTitle}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Trava de Seguidor (Follow Gate) */}
              {followGateEnabled && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                  {/* Mensagem pedindo pra seguir */}
                  <div className="flex items-end gap-1.5 max-w-[85%]">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px] flex-none">
                      <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[7px] font-bold text-white uppercase">
                        {accountUsername.slice(0, 1)}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-2xl bg-[#26262b] overflow-hidden border border-white/5 shadow-sm">
                      <div className="p-3 text-[12px] leading-relaxed text-white whitespace-pre-line">
                        {recipe.followGate.text ||
                          "Você ainda não está seguindo a Moving! 👀\n\nSiga o nosso perfil para receber as informações sobre o casamento de 2026. 💍✨"}
                      </div>
                      <div className="border-t border-white/10 bg-[#323238]/60 p-2 text-center text-[11px] font-bold text-white uppercase tracking-wider">
                        {recipe.followGate.buttonTitle || "Seguindo"}
                      </div>
                    </div>
                  </div>

                  {/* Resposta do Usuário tocando no botão "Seguindo" */}
                  <div className="self-end rounded-2xl rounded-tr-xs bg-[#6366f1] text-white font-medium px-3.5 py-2 text-[11.5px] max-w-[80%] text-right shadow-sm uppercase tracking-wide">
                    {recipe.followGate.buttonTitle || "Seguindo"}
                  </div>
                </div>
              )}

              {/* 3. Entrega do Link (WhatsApp / Link de Destino) */}
              <div className="flex items-end gap-1.5 max-w-[85%] animate-in fade-in duration-300">
                <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px] flex-none">
                  <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[7px] font-bold text-white uppercase">
                    {accountUsername.slice(0, 1)}
                  </div>
                </div>
                <div className="flex flex-col rounded-2xl bg-[#26262b] overflow-hidden border border-white/5 shadow-sm">
                  <div className="p-3 text-[12px] leading-relaxed text-white whitespace-pre-line">
                    {recipe.link.text ||
                      "AAAAH! 💍🥹\nEntão você também sonha em viver esse momento com a Moving!\n\nQuer saber como funciona a inscrição para o casamento? Vou te encaminhar para o WhatsApp da equipe. 👇"}
                  </div>
                  {recipe.link.buttonTitle && (
                    <div className="border-t border-white/10 bg-[#323238]/60 p-2 text-center text-[11px] font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1">
                      <span>{recipe.link.buttonTitle}</span>
                      <ExternalLink size={11} className="text-white/70" />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. DM de Lembrete (caso o link não tenha sido acessado) */}
              {reminderEnabled && (
                <div className="flex items-end gap-1.5 max-w-[85%] animate-in fade-in duration-300">
                  <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1px] flex-none">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[7px] font-bold text-white uppercase">
                      {accountUsername.slice(0, 1)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#26262b] p-3 text-[12px] leading-relaxed text-white whitespace-pre-line border border-white/5 shadow-sm">
                    {recipe.reminder.text ||
                      "Seu acesso está esperando por você. 👀 Clique no link acima e entre no grupo."}
                  </div>
                </div>
              )}
            </div>

            {/* Input Fake de DM */}
            <div className="flex h-12 w-full flex-none items-center justify-between border-t border-white/10 px-3 bg-[#000000] text-white/50 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[#0084ff] flex items-center justify-center text-white">
                  <Camera size={15} />
                </div>
                <span>Mensagem...</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <ImageIcon size={18} />
                <Smile size={18} />
                <Plus size={18} />
              </div>
            </div>
          </div>
        )}

        {/* Indicador Home do iOS no rodapé */}
        <div className="h-4 w-full flex-none flex items-center justify-center bg-[#000000]">
          <div className="h-1 w-28 rounded-full bg-white/30" />
        </div>
      </div>

      {/* ── SEGMENTED PILL UNDER THE PHONE (Exatamente como no Manychat do print e vídeo) ── */}
      <div className="flex items-center rounded-full bg-[#e4e4e7] dark:bg-[#18181b] border border-border p-1 text-[13px] font-medium shadow-xs">
        <button
          type="button"
          onClick={() => setTab("post")}
          className={`px-4 py-1.5 rounded-full transition-all text-xs font-semibold ${
            tab === "post"
              ? "bg-white dark:bg-[#27272a] text-ink font-bold shadow-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Publicar
        </button>
        <button
          type="button"
          onClick={() => setTab("comments")}
          className={`px-4 py-1.5 rounded-full transition-all text-xs font-semibold ${
            tab === "comments"
              ? "bg-white dark:bg-[#27272a] text-ink font-bold shadow-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Comentários
        </button>
        <button
          type="button"
          onClick={() => setTab("dm")}
          className={`px-4 py-1.5 rounded-full transition-all text-xs font-semibold ${
            tab === "dm"
              ? "bg-white dark:bg-[#27272a] text-ink font-bold shadow-xs"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          DM
        </button>
      </div>
    </div>
  );
}
