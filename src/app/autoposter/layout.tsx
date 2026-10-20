import type { Metadata } from "next";
import { Inter, Quicksand } from "next/font/google";
import { FeatureGate } from "@/components/billing/FeatureGate";
import "./autoposter.css";

const inter = Inter({ variable: "--font-ap-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const quicksand = Quicksand({ variable: "--font-ap-quicksand", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Autoposter · instachat",
  description: "Agendamento de posts com aprovação do cliente e calendário editorial.",
};

export default function AutoposterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`ap ${inter.variable} ${quicksand.variable} flex min-h-full shrink-0 flex-col`}>
      {/* Portal de aprovação e calendário compartilhado são do cliente final: ficam fora do bloqueio por plano. */}
      <FeatureGate feature="autoposter" publicPrefixes={["/autoposter/aprovacao", "/autoposter/calendario"]}>
        {children}
      </FeatureGate>
    </div>
  );
}
