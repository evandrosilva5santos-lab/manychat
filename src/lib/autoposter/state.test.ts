import { describe, expect, it } from "vitest";
import {
  afterCancelSchedule,
  afterReview,
  afterSchedule,
  afterSendToReview,
  canEdit,
  finalStatusFromTargets,
  initialState,
  overallDecision,
  publishDecision,
  reviewStatusFromReviews,
  type PostState,
} from "./state";

const at = (iso: string) => new Date(iso);

describe("initialState", () => {
  it("vira rascunho sem data e sem revisão", () => {
    expect(initialState({ scheduledAt: null, sendToReview: false, publishOnlyIfApproved: true }).status).toBe("draft");
  });

  it("vira agendado com data e sem revisão", () => {
    expect(initialState({ scheduledAt: at("2026-10-20T13:00:00Z"), sendToReview: false, publishOnlyIfApproved: true }).status).toBe("scheduled");
  });

  it("fica aguardando revisão quando enviado ao cliente, mesmo com data", () => {
    const state = initialState({ scheduledAt: at("2026-10-20T13:00:00Z"), sendToReview: true, publishOnlyIfApproved: true });
    expect(state).toMatchObject({ status: "reviewing", reviewStatus: "pending" });
  });
});

describe("revisão do cliente", () => {
  const pending: PostState = { status: "reviewing", reviewStatus: "pending", scheduledAt: null, publishOnlyIfApproved: true };

  it("aprovado sem data vira Aprovado", () => {
    expect(afterReview(pending, "approved").status).toBe("approved");
  });

  it("aprovado com data vira Agendado", () => {
    expect(afterReview({ ...pending, scheduledAt: at("2026-10-20T13:00:00Z") }, "approved").status).toBe("scheduled");
  });

  it("pedido de ajuste ganha status próprio", () => {
    expect(afterReview(pending, "needs_adjustment")).toMatchObject({ status: "needs_adjustment", reviewStatus: "needs_adjustment" });
  });

  it("reenviar para revisão volta para aguardando", () => {
    const adjusted = afterReview(pending, "needs_adjustment");
    expect(afterSendToReview(adjusted)).toMatchObject({ status: "reviewing", reviewStatus: "pending" });
  });
});

describe("agendamento", () => {
  const approved: PostState = { status: "approved", reviewStatus: "approved", scheduledAt: null, publishOnlyIfApproved: true };

  it("agendar um aprovado vira Agendado e cancelar volta para Aprovado", () => {
    const scheduled = afterSchedule(approved, at("2026-10-20T13:00:00Z"));
    expect(scheduled.status).toBe("scheduled");
    expect(afterCancelSchedule(scheduled)).toMatchObject({ status: "approved", scheduledAt: null });
  });

  it("agendar um post em revisão mantém aguardando revisão", () => {
    const reviewing: PostState = { ...approved, status: "reviewing", reviewStatus: "pending" };
    expect(afterSchedule(reviewing, at("2026-10-20T13:00:00Z")).status).toBe("reviewing");
  });
});

describe("reviewStatusFromReviews", () => {
  it("vale a decisão válida mais recente", () => {
    const reviews = [
      { decision: "needs_adjustment", invalidatedAt: null, createdAt: at("2026-10-01T10:00:00Z") },
      { decision: "approved", invalidatedAt: null, createdAt: at("2026-10-02T10:00:00Z") },
    ];
    expect(reviewStatusFromReviews(reviews, true)).toBe("approved");
  });

  it("ignora decisões invalidadas e volta a aguardar", () => {
    const reviews = [{ decision: "approved", invalidatedAt: at("2026-10-03T10:00:00Z"), createdAt: at("2026-10-02T10:00:00Z") }];
    expect(reviewStatusFromReviews(reviews, true)).toBe("pending");
    expect(reviewStatusFromReviews(reviews, false)).toBe("none");
  });
});

describe("publishDecision", () => {
  const now = at("2026-10-20T13:00:00Z");
  const base: PostState = { status: "scheduled", reviewStatus: "none", scheduledAt: at("2026-10-20T12:59:00Z"), publishOnlyIfApproved: true };

  it("espera enquanto a hora não chegou", () => {
    expect(publishDecision({ ...base, scheduledAt: at("2026-10-20T13:05:00Z") }, now)).toBe("wait");
  });

  it("publica agendado sem revisão", () => {
    expect(publishDecision(base, now)).toBe("publish");
  });

  it("publica agendado aprovado", () => {
    expect(publishDecision({ ...base, reviewStatus: "approved" }, now)).toBe("publish");
  });

  it("não publica se só pode publicar aprovado e o cliente não aprovou", () => {
    expect(publishDecision({ ...base, status: "reviewing", reviewStatus: "pending" }, now)).toBe("skip_not_approved");
    expect(publishDecision({ ...base, status: "needs_adjustment", reviewStatus: "needs_adjustment" }, now)).toBe("skip_not_approved");
  });

  it("publica mesmo sem aprovação quando a regra permite", () => {
    expect(publishDecision({ ...base, status: "reviewing", reviewStatus: "pending", publishOnlyIfApproved: false }, now)).toBe("publish");
  });

  it("nunca republica nem publica rascunho", () => {
    for (const status of ["published", "publishing", "not_published", "failed", "draft"] as const) {
      expect(publishDecision({ ...base, status }, now)).toBe("wait");
    }
  });
});

describe("overallDecision (arte + legenda)", () => {
  it("só aprova quando arte e legenda estão aprovadas", () => {
    expect(overallDecision("approved", "approved")).toBe("approved");
    expect(overallDecision("approved", "needs_adjustment")).toBe("needs_adjustment");
    expect(overallDecision("needs_adjustment", "approved")).toBe("needs_adjustment");
  });

  it("legenda editada pelo cliente conta como aprovada", () => {
    expect(overallDecision("approved", "edited")).toBe("approved");
    expect(overallDecision("needs_adjustment", "edited")).toBe("needs_adjustment");
  });
});

describe("finalStatusFromTargets e canEdit", () => {
  it("só é publicado se todas as redes publicaram", () => {
    expect(finalStatusFromTargets(["published", "published"])).toBe("published");
    expect(finalStatusFromTargets(["published", "failed"])).toBe("failed");
    expect(finalStatusFromTargets([])).toBe("failed");
  });

  it("bloqueia edição durante e depois da publicação", () => {
    expect(canEdit("published")).toBe(false);
    expect(canEdit("publishing")).toBe(false);
    expect(canEdit("needs_adjustment")).toBe(true);
  });
});
