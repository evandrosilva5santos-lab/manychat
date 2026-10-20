// Peças visuais do Autoposter (sem estado). Cores vêm dos tokens ap-* (autoposter.css).
import { STATUS_META, type PostStatus, type StatusTone } from "@/lib/autoposter/constants";
import { isVideoUrl } from "@/lib/autoposter/media";

export const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-ap-subtle",
  warning: "text-ap-yellow",
  adjust: "text-ap-orange",
  success: "text-ap-green",
  info: "text-ap-primary",
  published: "text-ap-purple",
  danger: "text-ap-orange",
};

export const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-ap-muted",
  warning: "bg-ap-yellow",
  adjust: "bg-ap-orange",
  success: "bg-ap-green",
  info: "bg-ap-primary",
  published: "bg-ap-purple",
  danger: "bg-ap-orange",
};

export const TONE_SOFT: Record<StatusTone, string> = {
  neutral: "bg-ap-line",
  warning: "bg-ap-yellow-soft",
  adjust: "bg-ap-orange-soft",
  success: "bg-ap-green-soft",
  info: "bg-ap-blue-soft",
  published: "bg-ap-purple-soft",
  danger: "bg-ap-orange-soft",
};

export function StatusPill({ status, count, solid = false }: { status: PostStatus; count?: number; solid?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${TONE_TEXT[meta.tone]} ${solid ? TONE_SOFT[meta.tone] : "bg-white"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
      {count !== undefined ? `${count} ` : ""}
      {meta.label}
    </span>
  );
}

export function InstagramGlyph({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function FacebookGlyph({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

/** Ícone redondo da rede (como nos cards do Flux). */
export function NetworkBadge({ network, size = 22 }: { network: string; size?: number }) {
  const inner = Math.round(size * 0.62);
  if (network === "facebook") {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-white text-ap-primary ring-1 ring-ap-line" style={{ width: size, height: size }}>
        <FacebookGlyph size={inner} />
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-ap-pink-soft text-ap-pink" style={{ width: size, height: size }}>
      <InstagramGlyph size={inner} />
    </span>
  );
}

/** Ícones das redes de um post, com "+N" depois de `max`. */
export function NetworkStack({ networks, max = 2, size = 22 }: { networks: string[]; max?: number; size?: number }) {
  const shown = networks.slice(0, max);
  const rest = networks.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((network, index) => (
        <NetworkBadge key={`${network}-${index}`} network={network} size={size} />
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-ap-line text-[11px] font-semibold text-ap-subtle" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

export function Avatar({ src, name, size = 48, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- fotos das CDNs da Meta/Storage, sem otimização do Next
    return <img src={src} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ap-purple font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** Miniatura da primeira mídia (imagem ou quadro do vídeo). */
export function MediaThumb({ url, className = "", alt = "" }: { url?: string | null; className?: string; alt?: string }) {
  if (!url) return <div className={`bg-ap-line ${className}`} aria-hidden />;
  if (isVideoUrl(url)) {
    return <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className={`object-cover ${className}`} aria-label={alt || "Vídeo"} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- mídia pública do Storage
  return <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-lg text-ap-muted">{title}</p>
      {children}
    </div>
  );
}
