"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { Dataset, Demand } from "@/lib/domain/types";
import { statusLabels, locations, rubles } from "@/lib/domain/catalog";
import { api } from "@/lib/client";
import { Choice, Modal } from "./fields";
type AccountData = Dataset & {
  appeals: {
    id: string;
    request_id: string;
    text: string;
    status: string;
    resolution: string | null;
  }[];
  events: {
    request_id: string;
    to_status: string;
    reason: string;
    created_at: number;
  }[];
};
export function Account() {
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [saving, setSaving] = useState(false);
  const [appeal, setAppeal] = useState<Demand | null>(null);
  const [text, setText] = useState("");
  const [appealError, setAppealError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await api<AccountData>("/api/profile");
      setData(d);
      setName(d.profile?.name ?? "");
      setDistrict(d.profile?.district ?? "");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/profile", { name, district });
      await refresh();
      toast.success("Профиль сохранён.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function sendAppeal() {
    if (!appeal) return;
    setSaving(true);
    setAppealError("");
    try {
      await api("/api/actions", {
        action: "appeal",
        requestId: appeal.id,
        text,
      });
      setAppeal(null);
      setText("");
      await refresh();
      toast.success("Апелляция сохранена. Решение появится в профиле.");
    } catch (e) {
      setAppealError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const p = data?.profile;
  return (
    <div className="account-page">
      <header className="simple-header">
        <a href="/" className="brand">
          SPROS<span className="brand-period">.</span>
        </a>
        <a href="/">
          <ArrowLeft size={17} />
          На карту
        </a>
      </header>
      <main className="reading-column">
        <div className="eyebrow">МОЙ ПРОФИЛЬ</div>
        <h1>
          Ваш район.
          <br />
          Ваше участие.
        </h1>
        {error && (
          <div className="form-error" role="alert">
            {error}
            <button className="btn text-btn" onClick={() => void refresh()}>
              Повторить
            </button>
          </div>
        )}
        {!data && !error && <p>Загружаем профиль…</p>}
        {data && p && (
          <>
            <div className="profile-summary">
              <div className="profile-avatar">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2>{p.name}</h2>
                <p>Участник тестового пилота</p>
                <div className="verification-list">
                  <span>Аккаунт: вход подтверждён</span>
                  <span>
                    Телефон:{" "}
                    {p.phoneVerified ? "подтверждён" : "не подтверждён"}
                  </span>
                  <span>
                    Проживание:{" "}
                    {p.residencyVerified ? "подтверждено" : "не подтверждено"}
                  </span>
                </div>
              </div>
            </div>
            <form onSubmit={save} className="form-fields">
              <div className="form-row">
                <label>
                  Как к вам обращаться
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Ваш район
                  <Choice
                    value={district || "none"}
                    onChange={(v) => setDistrict(v === "none" ? "" : v)}
                    label="Ваш район"
                    options={[
                      { value: "none", label: "Не указан" },
                      ...Array.from(
                        new Set(locations.map((l) => l.district)),
                      ).map((d) => ({ value: d, label: d })),
                    ]}
                  />
                </label>
              </div>
              <p className="form-hint">
                Район указан вами и не считается подтверждением проживания.
              </p>
              <button disabled={saving} className="btn secondary" type="submit">
                {saving ? "Сохраняем…" : "Сохранить профиль"}
              </button>
            </form>
            <section className="account-section">
              <h2>Мои запросы</h2>
              {data.requests.filter((r) => r.ownerId === p.id).length === 0 ? (
                <p>
                  Вы ещё не добавляли запросы. Начните с того, чего не хватает
                  рядом с домом.
                </p>
              ) : (
                data.requests
                  .filter((r) => r.ownerId === p.id)
                  .map((r) => (
                    <div className="account-item" key={r.id}>
                      <h3>
                        <a href={`/?request=${r.id}`}>{r.title}</a>
                      </h3>
                      <p>
                        ЖК «{r.location}» · {r.votes} голосов · демонстрация
                      </p>
                      <span className={`status-chip ${r.status}`}>
                        {statusLabels[r.status]}
                      </span>
                      {r.reason && (
                        <p>
                          <b>Причина:</b> {r.reason}
                        </p>
                      )}
                      {r.mergedInto && (
                        <p>
                          <a
                            className="text-link"
                            href={`/?request=${r.mergedInto}`}
                          >
                            Открыть объединённый запрос
                          </a>
                        </p>
                      )}
                      {r.status === "hidden" &&
                        !data.appeals.some(
                          (a) => a.request_id === r.id && a.status === "open",
                        ) && (
                          <button
                            className="btn secondary"
                            style={{ marginTop: 12 }}
                            onClick={() => {
                              setAppeal(r);
                              setAppealError("");
                            }}
                          >
                            Подать апелляцию
                          </button>
                        )}
                      {data.appeals
                        .filter((a) => a.request_id === r.id)
                        .map((a) => (
                          <p key={a.id}>
                            <b>Апелляция:</b>{" "}
                            {a.status === "open"
                              ? "ожидает решения"
                              : a.status === "accepted"
                                ? "удовлетворена"
                                : "отклонена"}
                            {a.resolution ? ` · ${a.resolution}` : ""}
                          </p>
                        ))}
                    </div>
                  ))
              )}
            </section>
            <section className="account-section">
              <h2>Я поддержал</h2>
              {data.requests.filter((r) => r.supported).length === 0 ? (
                <p>Пока нет поддержанных запросов.</p>
              ) : (
                <div className="account-grid">
                  {data.requests
                    .filter((r) => r.supported)
                    .map((r) => (
                      <a
                        className="account-item"
                        href={`/?request=${r.id}`}
                        key={r.id}
                      >
                        <h3>{r.title}</h3>
                        <p>ЖК «{r.location}»</p>
                        <p>
                          {r.myPledge
                            ? `Готовность: ${rubles(r.myPledge)}`
                            : "Только голос"}
                        </p>
                        <span className="status-chip">
                          Демонстрация · без платежа
                        </span>
                      </a>
                    ))}
                </div>
              )}
            </section>
            <section className="account-section">
              <h2>Мои бизнес-концепции и заявки</h2>
              {!data.offers.length ? (
                <p>Пока нет предложений и заявок об интересе.</p>
              ) : (
                data.offers.map((o) => (
                  <div className="account-item" key={o.id}>
                    <h3>{o.title}</h3>
                    <p>ЖК «{o.location}» · демонстрационная концепция</p>
                    <p>
                      {o.ownerId === p.id
                        ? "Ваше предложение"
                        : o.chosen
                          ? "Вы выбрали эту концепцию"
                          : "Ваш интерес сохранён"}
                    </p>
                    {o.interest && (
                      <p>
                        Заявка:{" "}
                        {
                          (
                            {
                              support: "поддержка",
                              preorder: "предзаказ",
                              certificate: "сертификат",
                              bonus: "бонус первых клиентов",
                              invest: "обсудить инвестиции",
                            } as Record<string, string>
                          )[o.interest]
                        }
                      </p>
                    )}
                    {o.requestId && (
                      <a
                        className="text-link"
                        href={`/?request=${o.requestId}`}
                      >
                        Открыть запрос
                      </a>
                    )}
                  </div>
                ))
              )}
            </section>
            {!!data.events.length && (
              <section className="account-section">
                <h2>История модерации</h2>
                {data.events.map((e, i) => (
                  <div className="account-item" key={i}>
                    <p>
                      {new Date(e.created_at).toLocaleDateString("ru-RU")} ·{" "}
                      {statusLabels[e.to_status]}
                    </p>
                    <p>{e.reason}</p>
                  </div>
                ))}
              </section>
            )}
            {p.moderator && (
              <a href="/moderation" className="btn secondary">
                <ShieldCheck size={17} />
                Открыть модерацию
              </a>
            )}
            <p style={{ marginTop: 30 }}>
              <a
                className="text-link"
                href="/signout-with-chatgpt?return_to=%2F"
                target="_top"
              >
                Выйти из аккаунта
              </a>
            </p>
          </>
        )}
      </main>
      <Modal
        open={!!appeal}
        onClose={() => setAppeal(null)}
        title="Апелляция"
        description="Объясните, почему считаете скрытие запроса ошибочным. Решение и его причина появятся в профиле."
      >
        <div className="form-fields">
          <label>
            Ваше объяснение
            <textarea
              minLength={20}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Не менее 20 символов"
            />
          </label>
        </div>
        {appealError && <p className="form-error">{appealError}</p>}
        <button
          disabled={saving || text.trim().length < 20}
          onClick={sendAppeal}
          className="btn primary"
        >
          {saving ? "Отправляем…" : "Отправить апелляцию"}
        </button>
      </Modal>
      <Toaster richColors />
    </div>
  );
}
