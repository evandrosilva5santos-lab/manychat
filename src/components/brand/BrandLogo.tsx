import Image from "next/image";

// Arquivos de origem em design-system/assets/brand; cópias leves para a web em public/brand.
const WORDMARK_LIGHT = { src: "/brand/instachat-logo-light.png", width: 600, height: 157 };
const WORDMARK_DARK = { src: "/brand/instachat-logo-dark.png", width: 600, height: 161 };
const SYMBOL = { src: "/brand/instachat-symbol.png", width: 128, height: 128 };

/** Logotipo "instachat". Troca sozinho entre a versão diurna e a noturna pelo data-theme do <html>. */
export function BrandWordmark({ height = 24, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} role="img" aria-label="instachat">
      <Image
        {...WORDMARK_LIGHT}
        alt=""
        className="brand-only-light w-auto"
        style={{ height }}
        priority
      />
      <Image
        {...WORDMARK_DARK}
        alt=""
        className="brand-only-dark w-auto"
        style={{ height }}
        priority
      />
    </span>
  );
}

/** Símbolo do balão, para espaços pequenos (sidebar, avatares da marca). */
export function BrandSymbol({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Image {...SYMBOL} alt="instachat" className={className} style={{ width: size, height: size }} priority />;
}
