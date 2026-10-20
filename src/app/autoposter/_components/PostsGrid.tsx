"use client";

import Link from "next/link";
import { useState } from "react";
import type { CardDTO } from "../_lib/cards";
import { EmptyState } from "../_ui/primitives";
import { PostCard } from "./PostCard";
import { PostDetailModal } from "./PostDetailModal";

export type Chip = { key: string; label: string; href: string; count?: number; active: boolean; tone?: "green" | "blue" };

type Props = {
  chips: Chip[];
  cards: CardDTO[];
  page: number;
  pages: number;
  /** URL das páginas, com o número no fim (ex.: "?status=all&page="). */
  pageBase: string;
  emptyText?: string;
};

export function PostsGrid({ chips, cards, page, pages, pageBase, emptyText = "Nenhum post encontrado." }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className="rounded-[12px] bg-white px-4 pt-6 pb-8 md:px-10">
      <nav aria-label="Filtrar por status" className="flex gap-2 overflow-x-auto pb-2">
        {chips.map((chip) => (
          <Link key={chip.key} href={chip.href} className="ap-chip" aria-current={chip.active ? "true" : undefined}>
            {chip.label}
            {chip.count ? (
              <span className={`ml-1 rounded-full px-1.5 text-xs font-semibold text-white ${chip.tone === "green" ? "bg-ap-green" : chip.tone === "blue" ? "bg-ap-primary" : "bg-ap-subtle"}`}>
                {chip.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {cards.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {cards.map((card) => (
            <PostCard key={card.id} card={card} onOpen={setOpenId} showDate />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-10 flex justify-center gap-2 rounded-xl border border-ap-line py-3">
          {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
            <Link
              key={number}
              href={`${pageBase}${number}`}
              aria-current={number === page ? "page" : undefined}
              className={`flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-sm ${number === page ? "bg-ap-title font-semibold text-white" : "text-ap-subtle hover:bg-ap-bg"}`}
            >
              {number}
            </Link>
          ))}
        </nav>
      )}

      {openId && <PostDetailModal postId={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}
