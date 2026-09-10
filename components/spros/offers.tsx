"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Upload, MapPin } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  categories,
  locations,
  rubles,
  shortRubles,
} from "@/lib/domain/catalog";
import type { Demand, Offer } from "@/lib/domain/types";
import { api } from "@/lib/client";
import { CategoryIcon } from "./category-icon";
import { Choice, Modal } from "./fields";

export function OfferCard({
  offer: o,
  onOpen,
}: {
  offer: Offer;
  onOpen: () => void;
}) {
  return (
    <button className="offer-card" onClick={onOpen}>
      {o.photoKey && (
        <img
          src={`/api/media/${o.photoKey}`}
          alt={`Концепция «${o.title}»`}
          loading="lazy"
        />
      )}
      <div className="offer-top">
        <CategoryIcon id={o.category} boxed />
        <span>
          {o.requestId ? "В ответ на спрос жителей" : "Идея предпринимателя"}
        </span>
        <span className="demo-tiny">Демо</span>
      </div>
      <h3>{o.title}</h3>
      <p>{o.description}</p>
      <div className="offer-stats">
        <span>Чек {rubles(o.avgCheck)}</span>
        <span>Бюджет {shortRubles(o.budget)}</span>
      </div>
      <div className="offer-foot">
        ЖК «{o.location}»{o.chosen ? " · Вы выбрали эту концепцию" : ""}
      </div>
    </button>
  );
}
const interestOptions = [
  { value: "support", label: "Поддержать идею" },
  { value: "preorder", label: "Интересен предзаказ" },
  { value: "certificate", label: "Интересен сертификат" },
  { value: "bonus", label: "Хочу бонус первых клиентов" },
  { value: "invest", label: "Готов обсудить инвестиции" },
];
export function OfferDetail({
  offer: o,
  onClose,
  onRefresh,
  requireAccount,
}: {
  offer: Offer | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  requireAccount: () => boolean;
}) {
  const [interest, setInterest] = useState("support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setInterest(o?.interest ?? "support");
    setError("");
  }, [o?.id, o?.interest]);
  async function act(action: "choose" | "interest", remove = false) {
    if (!o || !requireAccount()) return;
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/actions",
        action === "choose"
          ? { action, offerId: o.id }
          : { action, offerId: o.id, kind: remove ? "none" : interest },
      );
      await onRefresh();
      toast.success(
        remove
          ? "Заявка отозвана."
          : action === "choose"
            ? "Ваш выбор концепции сохранён."
            : "Интерес сохранён в профиле. Денежных обязательств нет.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!o}
      onClose={onClose}
      title={o?.title ?? "Предложение бизнеса"}
      description={o ? `ЖК «${o.location}» · демонстрационная концепция` : ""}
      wide
    >
      {o && (
        <>
          {o.photoKey && (
            <img
              className="offer-full-image"
              src={`/api/media/${o.photoKey}`}
              alt={`Концепция «${o.title}»`}
            />
          )}
          <p className="offer-paragraph">{o.description}</p>
          <dl className="offer-specs">
            <div>
              <dt>Средний чек</dt>
              <dd>{rubles(o.avgCheck)}</dd>
            </div>
            <div>
              <dt>Общий бюджет</dt>
              <dd>{shortRubles(o.budget)}</dd>
            </div>
            <div>
              <dt>Потребность в финансировании</dt>
              <dd>{shortRubles(o.fundingNeeded)}</dd>
            </div>
            <div>
              <dt>Планируемое открытие</dt>
              <dd>{o.timeline}</dd>
            </div>
          </dl>
          <div className="success-box">
            <strong>Первым клиентам</strong>
            <br />
            {o.benefit}
          </div>
          {o.requestId && (
            <button
              disabled={busy}
              className={`btn ${o.chosen ? "secondary" : "primary"} full-width`}
              onClick={() => act("choose")}
            >
              {o.chosen ? <Check size={18} /> : <ArrowUpRight size={18} />}{" "}
              {o.chosen ? "Эта концепция — ваш выбор" : "Выбрать эту концепцию"}
            </button>
          )}
          <div className="form-fields">
            <label>
              Как вам интересно участвовать
              <Choice
                value={interest}
                onChange={setInterest}
                label="Форма интереса"
                options={interestOptions}
              />
            </label>
          </div>
          <button
            disabled={busy}
            className="btn secondary full-width"
            onClick={() => act("interest")}
          >
            {busy
              ? "Сохраняем…"
              : o.interest
                ? "Обновить мою заявку"
                : "Оставить заявку об интересе"}
          </button>
          {o.interest && (
            <button
              disabled={busy}
              className="btn text-btn"
              onClick={() => act("interest", true)}
            >
              Отозвать заявку
            </button>
          )}
          <p className="form-hint">
            Все действия в пилоте — фиксация интереса. Предзаказ, сертификат и
            инвестиции сейчас не оплачиваются. Доли компаний не продаются. Сроки
            и экономика концепции не проверены.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
export function CompareOffers({
  open,
  onClose,
  offers,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  offers: Offer[];
  onChoose: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function choose(id: string) {
    setBusy(id);
    setError("");
    try {
      await onChoose(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Какой бизнес вы хотите видеть?"
      description="Сравните концепции для одного запроса. Один аккаунт выбирает одну; решение можно изменить."
      wide
    >
      <div className="comparison-scroll">
        <Table className="comparison-table">
          <TableHeader>
            <TableRow>
              <TableHead>Концепция</TableHead>
              {offers.map((o) => (
                <TableHead key={o.id}>{o.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              {
                label: "Средний чек",
                render: (o: Offer) => rubles(o.avgCheck),
              },
              { label: "Формат", render: (o: Offer) => o.description },
              { label: "Открытие", render: (o: Offer) => o.timeline },
              { label: "Бюджет", render: (o: Offer) => shortRubles(o.budget) },
              {
                label: "Нужно привлечь",
                render: (o: Offer) => shortRubles(o.fundingNeeded),
              },
              { label: "Первым клиентам", render: (o: Offer) => o.benefit },
            ].map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                {offers.map((o) => (
                  <TableCell key={o.id}>{row.render(o)}</TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell>Ваш выбор</TableCell>
              {offers.map((o) => (
                <TableCell key={o.id}>
                  <button
                    disabled={!!busy}
                    className={`btn ${o.chosen ? "secondary" : "primary"}`}
                    onClick={() => choose(o.id)}
                  >
                    {o.chosen
                      ? "Вы выбрали"
                      : busy === o.id
                        ? "Сохраняем…"
                        : "Выбрать"}
                  </button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="form-hint">
        Все концепции и финансовые показатели демонстрационные. Выбор не создаёт
        обязательств по оплате.
      </p>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}

export function CreateOffer({
  open,
  request,
  onClose,
  onCreated,
}: {
  open: boolean;
  request: Demand | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(locations[0].name);
  const [category, setCategory] = useState("coffee");
  const [budget, setBudget] = useState("");
  const [funding, setFunding] = useState("");
  const [timeline, setTimeline] = useState("");
  const [benefit, setBenefit] = useState("");
  const [check, setCheck] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPhoto(null);
      setError("");
      setBudget("");
      setFunding("");
      setTimeline("");
      setBenefit("");
      setCheck(request?.avgCheck ? String(request.avgCheck) : "");
    }
  }, [open, request]);
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });
      const result = (await response.json()) as { id: string; error?: string };
      if (!response.ok) throw new Error(result.error);
      setPhoto(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (Number(funding) > Number(budget)) {
      setError("Сумма привлечения не может превышать общий бюджет.");
      return;
    }
    setBusy(true);
    try {
      const l = locations.find((l) => l.name === location) ?? locations[0];
      await api("/api/offers", {
        title,
        description,
        requestId: request?.id ?? null,
        category: request?.category ?? category,
        location: request?.location ?? location,
        lat: request?.lat ?? l.lat,
        lng: request?.lng ?? l.lng,
        budget: Number(budget),
        fundingNeeded: Number(funding),
        timeline,
        benefit,
        avgCheck: Number(check),
        photoKey: photo,
      });
      await onCreated();
      toast.success(
        "Предложение опубликовано. Жители могут сравнить вашу концепцию.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Предложить бизнес"
      description={
        request
          ? `В ответ на запрос «${request.title}» · ЖК «${request.location}»`
          : "Расскажите о концепции и проверьте интерес жителей до открытия."
      }
      wide
    >
      <form onSubmit={submit} className="form-fields">
        {!request && (
          <div className="form-row">
            <label>
              Локация
              <Choice
                value={location}
                onChange={setLocation}
                label="Локация"
                options={locations.map((l) => ({
                  value: l.name,
                  label: l.name,
                }))}
              />
            </label>
            <label>
              Категория
              <Choice
                value={category}
                onChange={setCategory}
                label="Категория бизнеса"
                options={categories.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
              />
            </label>
          </div>
        )}
        <label>
          Название концепции
          <input
            required
            minLength={5}
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, «Соседи». Семейное бистро"
          />
        </label>
        <label>
          Концепция, команда и помещение
          <textarea
            required
            minLength={30}
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Какой бизнес вы хотите открыть? Какой у команды опыт? Есть ли помещение? Что важно знать жителям?"
          />
        </label>
        <div className="upload-field">
          <label>
            <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <Upload size={17} />
              {uploading ? "Загружаем…" : "Фото или визуал концепции"}
            </span>
            <input
              aria-label="Изображение концепции"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {photo && (
            <img
              className="upload-preview"
              src={`/api/media/${photo}`}
              alt="Загруженный визуал концепции"
            />
          )}
          <span className="form-hint">
            Необязательно. JPG, PNG или WebP до 5 МБ. Только изображения,
            которые вы вправе публиковать.
          </span>
        </div>
        <div className="form-row">
          <label>
            Общий бюджет, ₽
            <input
              required
              type="number"
              min="1"
              max="10000000000"
              step="1"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="8 000 000"
            />
          </label>
          <label>
            Нужно привлечь, ₽
            <input
              required
              type="number"
              min="0"
              max="10000000000"
              step="1"
              value={funding}
              onChange={(e) => setFunding(e.target.value)}
              placeholder="2 000 000"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Планируемый средний чек, ₽
            <input
              required
              type="number"
              min="0"
              max="10000000"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
              placeholder="1 500"
            />
          </label>
          <label>
            Срок до открытия
            <input
              required
              minLength={3}
              maxLength={200}
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="4–6 месяцев после аренды"
            />
          </label>
        </div>
        <label>
          Что получат первые клиенты
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
            placeholder="Бонус, сертификат или условия будущего предзаказа"
          />
        </label>
        <p className="form-hint">
          Это демонстрация предложения, без сбора денег и продажи долей. Не
          обещайте гарантированную доходность и не публикуйте чужие личные
          данные.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn primary full-width"
          disabled={busy || uploading}
          type="submit"
        >
          {busy ? "Публикуем…" : "Опубликовать концепцию"}
        </button>
      </form>
    </Modal>
  );
}
