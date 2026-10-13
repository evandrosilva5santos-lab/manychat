import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  FileText,
  Shield,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Scale,
  Ban,
  Clock,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Termos de Uso · instachat",
  description:
    "Termos de Uso e Condições de Serviço da plataforma instachat. Leia sobre os direitos, obrigações e diretrizes de conformidade com a Meta para uso das automações do Instagram.",
};

export default function TermosDeUsoPage() {
  const dataAtualizacao = "11 de outubro de 2026";

  return (
    <div className="min-h-screen bg-canvas text-ink py-10 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* ── Navegação Superior ── */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink transition group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar ao Início</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200 text-ink-muted border border-border">
              <Scale size={13} className="text-primary" />
              Contrato de Licença de Software
            </span>
            <Link
              href="/privacidade"
              className="text-ink-muted hover:text-ink transition underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
          </div>
        </div>

        {/* ── Cabeçalho do Documento ── */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary">
            <FileText size={13} />
            Termos e Condições Gerais
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-sm text-ink-muted">
            Última atualização: <strong>{dataAtualizacao}</strong> · Versão 1.1
          </p>
          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            Bem-vindo ao <strong>instachat</strong>. Estes Termos de Uso (&quot;Termos&quot;) regulam o acesso e a utilização
            da plataforma de software como serviço (SaaS) fornecida pela Start Inc. Tecnologia (&quot;Start Inc.&quot;,
            &quot;nós&quot; ou &quot;Plataforma&quot;). Ao acessar, cadastrar-se ou conectar sua conta do Instagram ao instachat,
            você (&quot;Usuário&quot; ou &quot;Assinante&quot;) concorda expressa e integralmente com as disposições aqui estabelecidas.
          </p>
        </header>

        {/* ── Quadro de Regras Críticas da Meta ── */}
        <div className="rounded-2xl border border-warning/30 bg-warning-soft/20 p-6 shadow-card space-y-4">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <AlertCircle size={18} className="text-warning" />
            Diretriz Inegociável: Respeito às Regras da Meta
          </h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            O instachat opera exclusivamente por meio das APIs oficiais da Meta (Instagram Graph API). O uso da
            plataforma para envio de mensagens invasivas, práticas de spam ou descumprimento das regras de
            atendimento da Meta é estritamente proibido e resultará na suspensão imediata da conta.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-ink-muted">
            <div className="bg-surface-100 p-3.5 rounded-xl border border-border flex items-start gap-2.5">
              <Clock size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink block">Janela Regulamentar de 24 Horas</strong>
                <span>DMs comerciais só são disparadas até 24 horas após a última interação voluntária do lead.</span>
              </div>
            </div>
            <div className="bg-surface-100 p-3.5 rounded-xl border border-border flex items-start gap-2.5">
              <Ban size={16} className="text-danger shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink block">Proibição Absoluta de Spam</strong>
                <span>É vedado o disparo em massa para listas frias ou perfis que não tenham interagido voluntariamente.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Conteúdo dos Termos ── */}
        <div className="prose prose-sm max-w-none space-y-8 text-ink-muted text-sm leading-relaxed">
          {/* Seção 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              1. Objeto e Escopo dos Serviços
            </h2>
            <p>
              O instachat é uma solução tecnológica que disponibiliza ferramentas para criação visual e execução
              automatizada de fluxos de interação no Instagram, incluindo:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Resposta automática e privada a comentários em publicações e Reels específicos;</li>
              <li>Envio de Direct Messages (DMs) com botões fixos interativos e modelos de carrossel autorizados;</li>
              <li>Encurtamento e rastreamento de cliques em links de destino;</li>
              <li>Gestão básica de contatos e atribuição de etiquetas (Tags) para organização operacional.</li>
            </ul>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <CheckCircle2 size={18} className="text-primary" />
              2. Elegibilidade e Vínculo de Contas
            </h2>
            <p>
              Para utilizar a Plataforma, o Usuário declara e garante que:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Possui plena capacidade civil (maior de 18 anos) para firmar contratos vinculativos;</li>
              <li>
                É o titular legítimo ou detentor de autorização formal para gerenciar a conta profissional do
                Instagram (Empresarial ou Criador de Conteúdo) vinculada à Página do Facebook correspondente;
              </li>
              <li>
                Manterá suas credenciais de acesso em sigilo e não compartilhará contas sem expressa autorização.
              </li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Ban size={18} className="text-danger" />
              3. Práticas Proibidas e Uso Indevido
            </h2>
            <p>É expressamente vedado ao Usuário utilizar a Plataforma para:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Disseminar conteúdo fraudulento, difamatório, pornográfico, preconceituoso ou ilícito;</li>
              <li>Violar os Termos da Plataforma Meta, as Políticas de Desenvolvedores ou as Diretrizes da Comunidade do Instagram;</li>
              <li>
                Praticar assédio, ameaças ou enviar comunicações repetitivas a destinatários que manifestaram desejo
                de interromper o contato (&quot;opt-out&quot;);
              </li>
              <li>
                Tentar realizar engenharia reversa, burlar mecanismos de limitação de taxa (rate limits) ou injetar código malicioso no sistema;
              </li>
              <li>Comercializar ou sublicenciar a conta de acesso a terceiros sem prévia anuência escrita.</li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Scale size={18} className="text-primary" />
              4. Responsabilidade pelo Conteúdo das Automações
            </h2>
            <p>
              O Usuário é o único e exclusivo responsável pelo conteúdo, veracidade, conformidade e legalidade das
              mensagens, imagens, ofertas e links veiculados através dos fluxos de automação configurados por ele.
              O instachat não exerce moderação prévia sobre as mensagens configuradas pelo Usuário.
            </p>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <AlertCircle size={18} className="text-primary" />
              5. Disponibilidade e Limitação de Responsabilidade
            </h2>
            <p>
              A operação do instachat depende diretamente da infraestrutura da internet e, em particular, da disponibilidade
              dos servidores da Meta Platforms, Inc. Em razão disso:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                A Plataforma não garante que os serviços serão ininterruptos ou livres de falhas decorrentes de instabilidades
                externas nas APIs da Meta, bloqueios temporários de contas por violações das regras do Instagram ou
                alterações unilaterais nas políticas de terceiros;
              </li>
              <li>
                Em nenhuma circunstância o instachat será responsável por lucros cessantes, perdas financeiras indiretas ou danos morais
                decorrentes do uso ou da impossibilidade de uso da Plataforma;
              </li>
              <li>
                A responsabilidade total acumulada da Plataforma perante o Usuário, por qualquer causa, é limitada ao valor
                efetivamente pago pelo Usuário nos últimos 3 (três) meses de assinatura do serviço.
              </li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              6. Propriedade Intelectual
            </h2>
            <p>
              Todos os direitos de propriedade intelectual relativos ao software instachat — incluindo código-fonte, arquitetura,
              interfaces visuais, componentes de design, algoritmos, logotipos e marcas — pertencem com exclusividade à
              Start Inc. Tecnologia. É concedida ao Usuário uma licença limitada, revogável, não exclusiva e intransferível
              para utilizar a ferramenta durante a vigência de seu acesso.
            </p>
          </section>

          {/* Seção 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              7. Vigência, Rescisão e Modificações
            </h2>
            <p>
              Estes Termos permanecem válidos enquanto o Usuário mantiver seu acesso à Plataforma. O Usuário pode cancelar
              sua conta a qualquer momento por meio do painel de ajustes. Reservamo-nos o direito de suspender ou rescindir
              imediatamente o acesso de qualquer Usuário que viole estes Termos ou as regras da Meta, sem direito a reembolso.
              Alterações nestes Termos serão comunicadas pelo aplicativo ou por e-mail com antecedência razoável.
            </p>
          </section>

          {/* Seção 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Scale size={18} className="text-primary" />
              8. Lei Aplicável e Foro de Eleição
            </h2>
            <p>
              Estes Termos são regidos e interpretados segundo as leis da República Federativa do Brasil, em particular
              a Lei nº 12.965/2014 (Marco Civil da Internet) e a Lei nº 13.709/2018 (LGPD). Fica eleito o Foro da Comarca da
              sede da empresa para dirimir eventuais controvérsias decorrentes destes Termos, com renúncia expressa a qualquer outro.
            </p>
          </section>
        </div>

        {/* ── Rodapé da Página ── */}
        <footer className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted gap-3">
          <span>instachat © 2026 Start Inc. Tecnologia · Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link href="/privacidade" className="hover:text-ink transition underline underline-offset-4">
              Política de Privacidade
            </Link>
            <Link href="/conectar" className="hover:text-ink transition">
              Conectar Instagram
            </Link>
            <Link href="/" className="hover:text-ink transition">
              Início
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
