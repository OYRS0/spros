"use client";
import { useEffect, useState } from "react";
import {
  MapPin,
  Check,
  Heart,
  Share2,
  Flag,
  BriefcaseBusiness,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { Demand, Offer } from "@/lib/domain/types";
import {
  categoryById,
  formatNumber,
  pledgeOptions,
  reportReasons,
  statusLabels,
} from "@/lib/domain/catalog";
import { api } from "@/lib/client";
import { CategoryIcon } from "./category-icon";
import { Choice, Modal } from "./fields";
import { OfferCard, OfferDetail, CompareOffers } from "./offers";

export function RequestDetail({
  request: r,
  offers,
  onClose,
  onRefresh,
  requireAccount,
  onOffer,
}: {
  request: Demand | null;
  offers: Offer[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  requireAccount: () => boolean;
  onOffer: () => void;
}) {
  const [support, setSupport] = useState(false);
  const [pledge, setPledge] = useState("0");
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState(reportReasons[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [compare, setCompare] = useState(false);
  const [share, setShare] = useState("");
  useEffect(() => {
    setSupport(false);
    setReport(false);
    setError("");
  }, [r?.id]);
  async function saveSupport() {
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/actions", {
        action: "support",
        requestId: r.id,
        pledge: Number(pledge),
      });
      await onRefresh();
      setSupport(false);
      toast.success("Вы поддержали запрос. Ваш голос сохранён.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unsupport() {
    if (!r) return;
    setBusy(true);
    try {
      await api("/api/actions", { action: "unsupport", requestId: r.id });
      await onRefresh();
      setSupport(false);
      toast.success("Голос отозван.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReport() {
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/actions", {
        action: "report",
        requestId: r.id,
        reason,
        detail,
      });
      setReport(false);
      toast.success("Жалоба сохранена для проверки. Запрос остаётся на карте.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function shareRequest() {
    if (!r) return;
    const url = `${window.location.origin}/?request=${encodeURIComponent(r.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${r.title} — SPROS`,
          text: `ЖК «${r.location}». Поддержите запрос соседей. Демонстрация пилота.`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShare(url);
    }
  }
  return (
    <>
      <Sheet
        open={!!r}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <SheetContent className="detail-sheet">
          {r && (
            <>
              <SheetHeader>
                <div className="detail-category">
                  <CategoryIcon id={r.category} boxed />
                  {categoryById(r.category).label}
                  <span className="detail-demo">Демо</span>
                </div>
                <SheetTitle>{r.title}</SheetTitle>
                <SheetDescription>
                  <MapPin size={15} />
                  ЖК «{r.location}» · {r.district}
                </SheetDescription>
              </SheetHeader>
              <div className="detail-body">
                <div className="detail-metrics">
                  <div>
                    <strong>{formatNumber(r.votes)}</strong>
                    <span>человек поддержали</span>
                  </div>
                  <div>
                    <strong>{formatNumber(r.pledgers)}</strong>
                    <span>готовы внести до открытия</span>
                  </div>
                </div>
                <p className="detail-note">
                  Демонстрационные показатели.{" "}
                  {r.testVotes > 0
                    ? `Включая ${r.testVotes} голосов участников теста. `
                    : ""}
                  Деньги не собираются. Готовность внести не гарантирует
                  покупку.
                </p>
                {r.status !== "published" && (
                  <div className={`status-chip ${r.status}`}>
                    {statusLabels[r.status]}
                    {r.reason && ` · ${r.reason}`}
                  </div>
                )}
                <p className="detail-description">{r.description}</p>
                <h2 className="section-title">Каким жители видят это место</h2>
                <ul className="needs-list">
                  {r.needs.map((n) => (
                    <li key={n}>
                      <Check size={16} />
                      {n}
                    </li>
                  ))}
                </ul>
                <div className="detail-actions">
                  <button
                    className={`btn ${r.supported ? "secondary" : "primary"}`}
                    onClick={() => {
                      if (requireAccount()) {
                        setPledge(String(r.myPledge));
                        setError("");
                        setSupport(true);
                      }
                    }}
                  >
                    {r.supported ? <Check size={18} /> : <Heart size={18} />}{" "}
                    {r.supported
                      ? "Вы поддержали · изменить"
                      : "Мне тоже нужно"}
                  </button>
                  <button className="btn secondary" onClick={onOffer}>
                    <BriefcaseBusiness size={18} />Я могу это открыть
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="detail-secondary-actions">
                  <button onClick={shareRequest}>
                    <Share2 size={15} />
                    Поделиться
                  </button>
                  <button
                    onClick={() => {
                      if (requireAccount()) {
                        setError("");
                        setReport(true);
                      }
                    }}
                  >
                    <Flag size={14} />
                    Пожаловаться
                  </button>
                </div>
                <div className="detail-offers">
                  <div className="detail-offers-heading">
                    <h2 className="section-title" style={{ margin: 0 }}>
                      Предложения бизнеса{" "}
                      <span className="detail-note">{offers.length}</span>
                    </h2>
                    {offers.length > 1 && (
                      <button onClick={() => setCompare(true)}>Сравнить</button>
                    )}
                  </div>
                  {offers.length ? (
                    offers.map((o) => (
                      <OfferCard
                        key={o.id}
                        offer={o}
                        onOpen={() => setOffer(o)}
                      />
                    ))
                  ) : (
                    <p className="form-hint">
                      Пока никто не предложил концепцию. Предприниматель может
                      первым откликнуться на этот спрос.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Modal
        open={support}
        onClose={() => setSupport(false)}
        title={r?.supported ? "Ваша поддержка" : "Вам тоже это нужно?"}
        description="Один голос уже помогает. При желании укажите готовность внести деньги после подтверждения открытия."
      >
        <RadioGroup
          value={pledge}
          onValueChange={setPledge}
          className="pledge-list"
        >
          {pledgeOptions.map((p) => (
            <label
              key={p.value}
              className="pledge-choice"
              data-selected={Number(pledge) === p.value}
            >
              <RadioGroupItem value={String(p.value)} />
              {p.label}
            </label>
          ))}
        </RadioGroup>
        <div className="success-box">
          <Wallet size={17} style={{ display: "inline", marginRight: 7 }} />
          Это заявление о намерении. Деньги не списываются, платёжные данные не
          нужны.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn primary full-width"
          disabled={busy}
          onClick={saveSupport}
        >
          {busy
            ? "Сохраняем…"
            : r?.supported
              ? "Сохранить изменения"
              : "Поддержать запрос"}
        </button>
        {r?.supported && (
          <button className="btn text-btn" disabled={busy} onClick={unsupport}>
            Отозвать голос
          </button>
        )}
      </Modal>
      <Modal
        open={report}
        onClose={() => setReport(false)}
        title="Сообщить о нарушении"
        description="Несогласие с идеей не является нарушением. Жалоба не скрывает запрос автоматически."
      >
        <div className="form-fields">
          <label>
            Причина
            <Choice
              value={reason}
              onChange={setReason}
              label="Причина жалобы"
              options={reportReasons.map((r) => ({ value: r, label: r }))}
            />
          </label>
          <label>
            Что произошло
            <textarea
              maxLength={1000}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Укажите конкретное нарушение. Не добавляйте чужие личные данные."
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn primary full-width"
          disabled={busy}
          onClick={sendReport}
        >
          {busy ? "Сохраняем…" : "Отправить жалобу"}
        </button>
      </Modal>
      <Modal
        open={!!share}
        onClose={() => setShare("")}
        title="Ссылка на запрос"
        description="Скопируйте адрес и отправьте соседям."
      >
        <div className="form-fields">
          <input
            aria-label="Ссылка на запрос"
            value={share}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </div>
      </Modal>
      <OfferDetail
        offer={offer ? (offers.find((o) => o.id === offer.id) ?? offer) : null}
        onClose={() => setOffer(null)}
        onRefresh={onRefresh}
        requireAccount={requireAccount}
      />
      <CompareOffers
        open={compare}
        onClose={() => setCompare(false)}
        offers={offers}
        onChoose={async (id) => {
          if (!requireAccount()) return;
          await api("/api/actions", { action: "choose", offerId: id });
          await onRefresh();
          toast.success("Ваш выбор сохранён. Его можно изменить.");
        }}
      />
    </>
  );
}
