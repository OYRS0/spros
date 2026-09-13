"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { statusLabels } from "@/lib/domain/catalog";
import { canTransition } from "@/lib/domain/moderation";
import type { ModerationStatus } from "@/lib/domain/types";
import { api } from "@/lib/client";
import { Choice, Modal } from "./fields";
type Row = {
  id: string;
  title: string;
  location: string;
  status: ModerationStatus;
  reason: string | null;
  description: string;
  is_demo: number;
};
type Data = {
  requests: Row[];
  history: { id: string; title: string; reason: string; created_at: number }[];
  reports: { id: string; request_id: string; reason: string; detail: string }[];
  appeals: { id: string; request_id: string; text: string }[];
};
export function Moderation({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<ModerationStatus>("review");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [rejection, setRejection] = useState("");
  const [rejectError, setRejectError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api<Data>("/api/moderation"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const r = data?.requests.find((r) => r.id === selected);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/moderation", {
        requestId: selected,
        status,
        reason,
        ...(status === "merged" ? { targetId: target } : {}),
      });
      setSelected("");
      setReason("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rejectAppeal() {
    setBusy(true);
    setRejectError("");
    try {
      await api("/api/moderation", {
        action: dismissId ? "dismiss_report" : "reject_appeal",
        ...(dismissId ? { reportId: dismissId } : { appealId: rejectId }),
        reason: rejection,
      });
      setRejectId(null);
      setDismissId(null);
      setRejection("");
      await refresh();
    } catch (e) {
      setRejectError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={embedded ? "embedded-moderation" : "policy-page"}>
      {!embedded && (
        <header className="simple-header">
          <a href="/" className="brand">
            SPROS.
          </a>
          <a href="/account">
            <ArrowLeft size={17} />
            Профиль
          </a>
        </header>
      )}
      <section className="reading-column">
        <h1>Проверка нарушений</h1>
        <p>
          Содержание идеи, популярность и критика бизнеса не являются
          основаниями для скрытия. Каждое изменение статуса сохраняется с
          причиной.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {!data && !error && <p>Загружаем очередь…</p>}
        {data && (
          <>
            <h2>Жалобы · {data.reports.length}</h2>
            {data.reports.map((q) => (
              <div key={q.id} className="moderation-card">
                <h3>
                  {data.requests.find((r) => r.id === q.request_id)?.title ??
                    q.request_id}
                </h3>
                <p>{q.reason}</p>
                <p>{q.detail}</p>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setSelected(q.request_id);
                    setStatus("review");
                  }}
                >
                  Рассмотреть запрос
                </button>
                <button
                  className="btn text-btn"
                  onClick={() => {
                    setDismissId(q.id);
                    setRejection("");
                    setRejectError("");
                  }}
                >
                  Нарушения нет
                </button>
              </div>
            ))}
            <h2>Апелляции · {data.appeals.length}</h2>
            {data.appeals.map((q) => (
              <div className="moderation-card" key={q.id}>
                <h3>
                  {data.requests.find((r) => r.id === q.request_id)?.title}
                </h3>
                <p>{q.text}</p>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setSelected(q.request_id);
                    setStatus("restored");
                  }}
                >
                  Рассмотреть восстановление
                </button>
                <button
                  className="btn text-btn"
                  onClick={() => {
                    setRejectId(q.id);
                    setRejectError("");
                  }}
                >
                  Отклонить с объяснением
                </button>
              </div>
            ))}
            <h2>Все запросы</h2>
            <Choice
              label="Запрос"
              value={selected || "none"}
              onChange={(v) => {
                setSelected(v);
                const item = data.requests.find((r) => r.id === v);
                if (item)
                  setStatus(
                    item.status === "hidden"
                      ? "restored"
                      : item.status === "review"
                        ? "published"
                        : "review",
                  );
              }}
              options={[
                { value: "none", label: "Выберите запрос" },
                ...data.requests.map((r) => ({
                  value: r.id,
                  label: `${r.title} · ${statusLabels[r.status]}`,
                })),
              ]}
            />
            {r && (
              <form className="moderation-card form-fields" onSubmit={submit}>
                <h3>{r.title}</h3>
                <p>
                  {r.location} · {r.is_demo ? "Демо" : "Запрос участника"}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{r.description}</p>
                <p>Сейчас: {statusLabels[r.status]}</p>
                {r.reason && <p>Предыдущее решение: {r.reason}</p>}
                <label>
                  Решение
                  <Choice
                    value={status}
                    onChange={(v) => setStatus(v as ModerationStatus)}
                    label="Решение"
                    options={Object.entries(statusLabels)
                      .filter(([s]) =>
                        canTransition(r.status, s as ModerationStatus),
                      )
                      .map(([value, label]) => ({ value, label }))}
                  />
                </label>
                {status === "merged" && (
                  <label>
                    Объединить с
                    <Choice
                      value={target || "none"}
                      onChange={setTarget}
                      label="Целевой запрос"
                      options={[
                        { value: "none", label: "Выберите запрос" },
                        ...data.requests
                          .filter(
                            (t) =>
                              t.id !== r.id &&
                              t.is_demo === r.is_demo &&
                              ["published", "review", "restored"].includes(
                                t.status,
                              ),
                          )
                          .map((t) => ({ value: t.id, label: t.title })),
                      ]}
                    />
                  </label>
                )}
                <label>
                  Причина, которую увидит автор
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Конкретное нарушение или основание для восстановления"
                  />
                </label>
                <button
                  disabled={busy || !canTransition(r.status, status)}
                  className="btn primary"
                  type="submit"
                >
                  {busy ? "Сохраняем…" : "Сохранить решение"}
                </button>
              </form>
            )}
            <h2>История решений</h2>
            {data.history.map((e) => (
              <article className="audit-row" key={e.id}>
                <b>{e.title}</b>
                <p>{e.reason}</p>
                <small>{new Date(e.created_at).toLocaleString("ru-RU")}</small>
              </article>
            ))}
          </>
        )}
      </section>
      <Modal
        open={!!rejectId || !!dismissId}
        onClose={() => {
          setRejectId(null);
          setDismissId(null);
        }}
        title={dismissId ? "Закрыть жалобу" : "Решение по апелляции"}
        description="Объясните решение. Оно сохранится в истории модерации."
      >
        <div className="form-fields">
          <label>
            Основание решения
            <textarea
              value={rejection}
              onChange={(e) => setRejection(e.target.value)}
              minLength={10}
              maxLength={1000}
            />
          </label>
        </div>
        {rejectError && <p className="form-error">{rejectError}</p>}
        <button
          disabled={busy || rejection.trim().length < 10}
          className="btn primary"
          onClick={rejectAppeal}
        >
          Сохранить решение
        </button>
      </Modal>
    </div>
  );
}
