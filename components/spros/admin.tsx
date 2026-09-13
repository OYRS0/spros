"use client";
import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  ShieldCheck,
  History,
  ArrowLeft,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { api } from "@/lib/client";
import { statusLabels } from "@/lib/domain/catalog";
import { Moderation } from "./moderation";
import { Modal } from "./fields";
type Row = {
  id: string;
  title: string;
  location: string;
  status: string;
  is_demo: number;
  votes: number;
};
type User = {
  id: string;
  name: string;
  district: string;
  suspended: number;
  phone_verified_at: number | null;
  requests: number;
  votes: number;
};
type Business = {
  user_id: string;
  name: string;
  legal_name: string;
  inn: string;
  contact: string;
  about: string;
  status: string;
  reason: string | null;
};
type Data = {
  requests: Row[];
  users: User[];
  business: Business[];
  events: {
    id: string;
    name: string;
    action: string;
    reason: string;
    created_at: number;
  }[];
  funnel: { event: string; sessions: number }[];
  counts: {
    users: number;
    live_requests: number;
    demo_requests: number;
    supporters: number;
    reports: number;
    appeals: number;
  };
};
const sections = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "requests", label: "Запросы", icon: MapPin },
  { id: "moderation", label: "Модерация", icon: ShieldCheck },
  { id: "users", label: "Участники", icon: Users },
  { id: "business", label: "Предприниматели", icon: BriefcaseBusiness },
  { id: "history", label: "История", icon: History },
];
const actions: Record<string, string> = {
  verify_business: "Подтвердить проверку",
  reject_business: "Запросить уточнение",
  suspend: "Ограничить аккаунт",
  restore: "Снять ограничение",
};
export function Admin() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview"),
    [search, setSearch] = useState(""),
    [decision, setDecision] = useState<{
      action: string;
      target: string;
      name: string;
    } | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setData(await api<Data>("/api/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function save() {
    if (!decision) return;
    setBusy(true);
    try {
      await api("/api/admin", {
        action: decision.action,
        target: decision.target,
        reason,
      });
      setDecision(null);
      setReason("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered =
    data?.requests.filter((r) =>
      `${r.title} ${r.location} ${statusLabels[r.status] ?? r.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <a className="brand" href="/">
          SPROS<span className="brand-period">.</span>
        </a>
        <span className="eyebrow">УПРАВЛЕНИЕ ПИЛОТОМ</span>
        <nav aria-label="Администрирование">
          {sections.map((s) => (
            <button
              key={s.id}
              aria-current={tab === s.id ? "page" : undefined}
              onClick={() => setTab(s.id)}
            >
              <s.icon size={19} />
              {s.label}
              {s.id === "moderation" && data && (
                <small>{data.counts.reports + data.counts.appeals}</small>
              )}
            </button>
          ))}
        </nav>
        <a href="/">
          <ArrowLeft size={16} />
          Вернуться на карту
        </a>
      </aside>
      <main className="admin-main">
        <header className="admin-title">
          <div>
            <span className="eyebrow">SPROS / ПИЛОТ</span>
            <h1>{sections.find((s) => s.id === tab)?.label}</h1>
          </div>
          <button className="btn secondary" onClick={() => void refresh()}>
            Обновить
          </button>
        </header>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p>Загружаем кабинет…</p>}
        {data && (
          <>
            {tab === "overview" && (
              <>
                <div className="metric-grid">
                  {[
                    ["Аккаунтов", data.counts.users],
                    ["Запросов участников", data.counts.live_requests],
                    ["Демозапросов", data.counts.demo_requests],
                    [
                      "Обращений в очереди",
                      data.counts.reports + data.counts.appeals,
                    ],
                  ].map(([label, value]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <section className="admin-panel">
                  <h2>Как люди участвуют · 30 дней</h2>
                  <p>
                    Посещения считаются по сессиям браузера, а не по людям. Один
                    человек может иметь несколько сессий. Этапы не образуют
                    строгую сквозную конверсию.
                  </p>
                  <div className="metric-grid">
                    {[
                      ["map_view", "Открыли карту"],
                      ["request_view", "Открыли запрос"],
                      ["signin_start", "Начали вход"],
                      ["signin_complete", "Вернулись после входа"],
                    ].map(([event, label]) => (
                      <article key={event}>
                        <span>{label}</span>
                        <strong>
                          {data.funnel.find((f) => f.event === event)
                            ?.sessions ?? 0}
                        </strong>
                      </article>
                    ))}
                  </div>
                  <p>
                    <b>{data.counts.supporters}</b> аккаунтов поддержали запросы
                    участников за 30 дней. Демоголоса в показатель не входят.
                  </p>
                </section>
                <section className="admin-panel">
                  <h2>Нуждаются во внимании</h2>
                  <button
                    className="btn secondary"
                    onClick={() => setTab("moderation")}
                  >
                    Жалобы: {data.counts.reports} · Апелляции:{" "}
                    {data.counts.appeals}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => setTab("business")}
                  >
                    Профили на проверке:{" "}
                    {data.business.filter((b) => b.status === "pending").length}
                  </button>
                </section>
              </>
            )}
            {tab === "requests" && (
              <section className="admin-panel">
                <input
                  aria-label="Поиск запросов в админке"
                  placeholder="Название, район или статус"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Запрос",
                        "Локация",
                        "Источник",
                        "Статус",
                        "Голоса аккаунтов",
                      ].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <a href={`/?request=${encodeURIComponent(r.id)}`}>
                            {r.title}
                          </a>
                        </TableCell>
                        <TableCell>{r.location}</TableCell>
                        <TableCell>{r.is_demo ? "Демо" : "Участник"}</TableCell>
                        <TableCell>
                          {statusLabels[r.status] ?? r.status}
                        </TableCell>
                        <TableCell>{r.votes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!filtered.length && <p>Запросы не найдены.</p>}
                <button
                  className="btn secondary"
                  onClick={() => setTab("moderation")}
                >
                  Рассмотреть или объединить запрос
                </button>
              </section>
            )}
            {tab === "moderation" && <Moderation embedded />}
            {tab === "users" && (
              <section className="admin-panel">
                <p>
                  Большое число действий само по себе не доказывает накрутку.
                  Ограничение требует конкретной причины.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Участник",
                        "Район",
                        "Телефон",
                        "Запросы / голоса",
                        "Действие",
                      ].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>{u.district || "Не указан"}</TableCell>
                        <TableCell>
                          {u.phone_verified_at
                            ? "Подтверждён"
                            : "Не подтверждён"}
                        </TableCell>
                        <TableCell>
                          {u.requests} / {u.votes}
                        </TableCell>
                        <TableCell>
                          <button
                            className="btn secondary"
                            onClick={() =>
                              setDecision({
                                action: u.suspended ? "restore" : "suspend",
                                target: u.id,
                                name: u.name,
                              })
                            }
                          >
                            {u.suspended ? "Снять ограничение" : "Ограничить"}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
            {tab === "business" && (
              <>
                {!data.business.length && (
                  <div className="admin-panel">
                    <h2>Пока нет профилей бизнеса</h2>
                    <p>
                      Предприниматели отправляют данные на проверку из своего
                      кабинета.
                    </p>
                  </div>
                )}
                {data.business.map((b) => (
                  <section className="admin-panel" key={b.user_id}>
                    <span className="status-chip">
                      {
                        {
                          pending: "На проверке",
                          verified: "Проверен",
                          rejected: "Нужно уточнение",
                        }[b.status]
                      }
                    </span>
                    <h2>{b.legal_name}</h2>
                    <p>
                      ИНН {b.inn} · {b.name}
                    </p>
                    <p>{b.contact}</p>
                    <p>{b.about}</p>
                    {b.reason && <p>Последнее решение: {b.reason}</p>}
                    <button
                      className="btn primary"
                      onClick={() =>
                        setDecision({
                          action: "verify_business",
                          target: b.user_id,
                          name: b.legal_name,
                        })
                      }
                    >
                      Подтвердить проверку
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        setDecision({
                          action: "reject_business",
                          target: b.user_id,
                          name: b.legal_name,
                        })
                      }
                    >
                      Запросить уточнение
                    </button>
                  </section>
                ))}
              </>
            )}
            {tab === "history" && (
              <section className="admin-panel">
                <p>
                  Изменения доступа и проверки бизнеса. История решений по
                  запросам доступна в модерации.
                </p>
                {!data.events.length && <p>Решений пока нет.</p>}
                {data.events.map((e) => (
                  <article className="audit-row" key={e.id}>
                    <b>{actions[e.action] ?? e.action}</b>
                    <p>{e.reason}</p>
                    <small>
                      {e.name} ·{" "}
                      {new Date(e.created_at).toLocaleString("ru-RU")}
                    </small>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? actions[decision.action] : "Решение"}
        description={decision?.name ?? ""}
      >
        <div className="form-fields">
          <label>
            Основание решения
            <textarea
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>Решение и ваше имя сохранятся в журнале.</p>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn primary"
            disabled={busy || reason.trim().length < 10}
            onClick={save}
          >
            {busy ? "Сохраняем…" : "Сохранить решение"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
