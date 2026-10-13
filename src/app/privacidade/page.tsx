import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Lock,
  Eye,
  Trash2,
  Database,
  ArrowLeft,
  FileText,
  Mail,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Política de Privacidade · Fluxo",
  description:
    "Política de Privacidade da plataforma Fluxo. Saiba como tratamos, protegemos e armazenamos seus dados e os dados de interações do Instagram em conformidade com a LGPD e políticas da Meta.",
};

export default function PoliticaPrivacidadePage() {
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
              <ShieldCheck size={13} className="text-success" />
              LGPD & Meta Compliance
            </span>
            <Link
              href="/termos"
              className="text-ink-muted hover:text-ink transition underline underline-offset-4"
            >
              Termos de Uso
            </Link>
          </div>
        </div>

        {/* ── Cabeçalho do Documento ── */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary">
            <Lock size={13} />
            Privacidade e Proteção de Dados
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-sm text-ink-muted">
            Última atualização: <strong>{dataAtualizacao}</strong> · Versão 1.1
          </p>
          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            A plataforma <strong>Fluxo</strong> (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Plataforma&quot;), desenvolvida e operada
            pela Start Inc. Tecnologia, valoriza a sua privacidade e assume o compromisso
            inegociável de proteger os seus dados pessoais e as informações dos usuários que
            interagem com suas contas do Instagram, em estrita conformidade com a Lei Geral de
            Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), o Regulamento Geral sobre a
            Proteção de Dados (GDPR) e os Termos e Políticas da Plataforma Meta.
          </p>
        </header>

        {/* ── Destaque de Garantias Meta ── */}
        <div className="rounded-2xl border border-border bg-surface-200 p-6 shadow-card space-y-4">
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            Nossos Compromissos Fundamentais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-ink-muted">
            <div className="bg-surface-100 p-4 rounded-xl border border-border space-y-1.5">
              <strong className="text-ink flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" />
                Zero Venda de Dados
              </strong>
              <p>Nunca vendemos, alugamos ou comercializamos dados pessoais ou dados de seguidores a terceiros.</p>
            </div>
            <div className="bg-surface-100 p-4 rounded-xl border border-border space-y-1.5">
              <strong className="text-ink flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" />
                Criptografia AES-256
              </strong>
              <p>Tokens de acesso oficiais da Meta são armazenados com criptografia simétrica AES-256-GCM.</p>
            </div>
            <div className="bg-surface-100 p-4 rounded-xl border border-border space-y-1.5">
              <strong className="text-ink flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" />
                Janela Oficial de 24h
              </strong>
              <p>Respeitamos rigorosamente as regras da Meta Graph API para troca de mensagens e prevenção a spam.</p>
            </div>
          </div>
        </div>

        {/* ── Conteúdo Detalhado ── */}
        <div className="prose prose-sm max-w-none space-y-8 text-ink-muted text-sm leading-relaxed">
          {/* Seção 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              1. Informações e Dados que Coletamos
            </h2>
            <p>
              Para prestar nossos serviços de automação no Instagram, coletamos e processamos
              apenas as informações indispensáveis para a execução do contrato de serviço:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Dados do Titular da Conta (Assinante):</strong> Nome, endereço de e-mail,
                identificador de conta comercial do Instagram (IG User ID), identificador da Página do Facebook vinculada,
                e token de acesso emitido mediante autorização explícita via Facebook/Instagram Login (OAuth).
              </li>
              <li>
                <strong className="text-ink">Dados de Interação de Usuários Finais (Seguidores/Leads):</strong> Identificador
                escopado do Instagram (<code className="font-mono bg-surface-300 px-1 py-0.5 rounded text-ink">IGSID</code>),
                nome de usuário público, data e horário do contato, conteúdo de comentários deixados em postagens
                ou Reels públicos do perfil conectado, e histórico de mensagens trocadas na Direct Message (DM)
                para continuidade da conversa automatizada.
              </li>
              <li>
                <strong className="text-ink">Métricas de Engajamento e Rastreamento:</strong> Contagem de cliques em links
                encurtados (<code className="font-mono bg-surface-300 px-1 py-0.5 rounded text-ink">/api/l/[code]</code>) e
                etiquetas (&quot;Tags&quot;) atribuídas ao contato dentro do CRM para fins de segmentação.
              </li>
            </ul>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Database size={18} className="text-primary" />
              2. Finalidade e Base Legal do Tratamento
            </h2>
            <p>O tratamento de dados pessoais no Fluxo é realizado com respaldo nas seguintes bases legais da LGPD:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Execução de Contrato (Art. 7º, V):</strong> Permitir que o assinante crie,
                execute e monitore fluxos automáticos de resposta a comentários e mensagens no Instagram.
              </li>
              <li>
                <strong className="text-ink">Consentimento (Art. 7º, I):</strong> Quando concedido pelo titular ao autenticar
                sua conta via Facebook Login for Business e permitir as permissões específicas da Meta Graph API
                (<code className="font-mono bg-surface-300 px-1 py-0.5 rounded text-ink">instagram_business_basic</code>,{" "}
                <code className="font-mono bg-surface-300 px-1 py-0.5 rounded text-ink">instagram_manage_messages</code>,{" "}
                <code className="font-mono bg-surface-300 px-1 py-0.5 rounded text-ink">instagram_manage_comments</code>).
              </li>
              <li>
                <strong className="text-ink">Legítimo Interesse (Art. 7º, IX):</strong> Prevenção a fraudes, segurança
                da infraestrutura de rede, auditoria de logs e aprimoramento da performance do motor de regras.
              </li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              3. Segurança da Informação e Criptografia
            </h2>
            <p>
              Implementamos medidas técnicas e organizacionais avançadas para salvaguardar todos os dados processados:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Criptografia em Repouso:</strong> Todas as credenciais de longa duração da Meta
                são cifradas no banco de dados com algoritmo de alta segurança <strong>AES-256-GCM</strong>.
              </li>
              <li>
                <strong className="text-ink">Criptografia em Trânsito:</strong> Todas as comunicações entre o navegador,
                nossos servidores e os endpoints da Meta são protegidas por protocolo TLS 1.3 com HTTPS obrigatório.
              </li>
              <li>
                <strong className="text-ink">Verificação de Integridade de Webhooks:</strong> Todas as notificações recebidas
                da Meta são validadas por assinatura criptográfica HMAC-SHA256 antes de qualquer processamento.
              </li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Trash2 size={18} className="text-primary" />
              4. Retenção de Dados e Instruções de Exclusão (Data Deletion)
            </h2>
            <p>
              Os dados são retidos apenas pelo período necessário para cumprir as finalidades contratadas pelo assinante
              ou para atendimento a obrigações legais e regulatórias.
            </p>
            <div className="rounded-xl bg-surface-100 p-4 border border-border space-y-2">
              <h3 className="font-semibold text-ink">Como solicitar a exclusão de seus dados:</h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  <strong>Revogação pelo Instagram/Facebook:</strong> O titular pode revogar o acesso do Fluxo a qualquer
                  momento acessando as Configurações de Aplicativos e Sites em sua conta do Facebook ou Instagram.
                </li>
                <li>
                  <strong>Exclusão via Painel do Fluxo:</strong> Acessando a página de <strong>Ajustes</strong> e
                  clicando em &quot;Descarregar perfil&quot;, a credencial é removida do Fluxo e a assinatura de
                  webhooks é cancelada na Meta. Os dados do negócio (contatos, conversas e fluxos) permanecem até que
                  você use &quot;Excluir perfil e dados&quot; em Ajustes ou peça a exclusão por e-mail. Veja também{" "}
                  <Link href="/exclusao-de-dados" className="text-primary underline">
                    como apagar seus dados
                  </Link>
                  .
                </li>
                <li>
                  <strong>Solicitação por E-mail (LGPD Art. 18):</strong> Para solicitar a exclusão total de dados de
                  contatos ou histórico de conversas, envie um e-mail para{" "}
                  <a href="mailto:privacidade@fluxo.app" className="text-primary underline">
                    privacidade@fluxo.app
                  </a>{" "}
                  com o assunto &quot;Exclusão de Dados Pessoais&quot;. Atenderemos a solicitação em até 5 dias úteis.
                </li>
              </ol>
            </div>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              5. Compartilhamento com Terceiros
            </h2>
            <p>
              O Fluxo não compartilha dados pessoais com corretores de dados, parceiros de marketing ou redes de anúncios.
              O compartilhamento ocorre estritamente com os provedores de infraestrutura necessários para a operação do sistema:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Meta Platforms, Inc.:</strong> Para envio e recebimento de mensagens e comentários
                através da Meta Graph API oficial.
              </li>
              <li>
                <strong className="text-ink">Provedor de Banco de Dados e Hospedagem (Supabase / Vercel):</strong> Ambientes de
                nuvem com certificações ISO 27001 e SOC 2 para armazenamento de dados criptografados.
              </li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Mail size={18} className="text-primary" />
              6. Encarregado pelo Tratamento de Dados (DPO) e Contato
            </h2>
            <p>
              Se você tiver dúvidas, reclamações ou desejar exercer qualquer um dos seus direitos previstos pela LGPD
              (confirmação de tratamento, acesso, correção, anonimização ou eliminação), entre em contato com nosso
              Encarregado de Proteção de Dados:
            </p>
            <div className="rounded-xl bg-surface-200 p-4 border border-border text-xs space-y-1">
              <p><strong>Encarregado (DPO):</strong> Start Inc. Privacidade & Compliance</p>
              <p><strong>E-mail direto:</strong> privacidade@fluxo.app</p>
              <p><strong>Prazo de resposta:</strong> Até 15 dias corridos conforme disposições da LGPD.</p>
            </div>
          </section>
        </div>

        {/* ── Rodapé da Página ── */}
        <footer className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted gap-3">
          <span>Fluxo © 2026 Start Inc. Tecnologia · Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link href="/termos" className="hover:text-ink transition underline underline-offset-4">
              Termos de Uso
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
