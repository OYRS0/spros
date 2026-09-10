"use client";
import { useEffect, useMemo, useState } from "react";
import { MapPin, ArrowLeft, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { categories, locations, pledgeOptions } from "@/lib/domain/catalog";
import { nearbySimilar } from "@/lib/domain/geo";
import { api } from "@/lib/client";
import type { Demand, Point } from "@/lib/domain/types";
import { Choice, Modal } from "./fields";
import { MapView } from "./map-view";

export function CreateRequest({
  open,
  onClose,
  requests,
  onCreated,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  requests: Demand[];
  onCreated: (id: string) => Promise<void>;
  onJoin: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState(locations[0].name);
  const [customLocation, setCustomLocation] = useState("");
  const [customDistrict, setCustomDistrict] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [category, setCategory] = useState("food");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [needs, setNeeds] = useState("");
  const [check, setCheck] = useState("");
  const [pledge, setPledge] = useState("0");
  const [distinct, setDistinct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setStep(0);
      setPoint(null);
      setTitle("");
      setDescription("");
      setNeeds("");
      setDistinct(false);
      setError("");
    }
  }, [open]);
  const loc = locations.find((l) => l.name === location) ?? locations[0];
  const similar = useMemo(
    () => (point ? nearbySimilar(requests, point, category, title) : []),
    [requests, point, category, title],
  );
  async function next() {
    setError("");
    if (step === 0) {
      if (!point) {
        setError("Выберите точку на карте или центр ЖК.");
        return;
      }
      if (
        location === "other" &&
        (!customLocation.trim() || !customDistrict.trim())
      ) {
        setError("Укажите место и район.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (title.trim().length < 5 || description.trim().length < 15) {
        setError("Добавьте название от 5 символов и описание от 15 символов.");
        return;
      }
      if (similar.length && !distinct) {
        setError(
          "Присоединитесь к похожему запросу или подтвердите, что ваш отличается.",
        );
        return;
      }
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ id: string }>("/api/requests", {
        title,
        category,
        location: location === "other" ? customLocation : location,
        district: location === "other" ? customDistrict : loc.district,
        ...point,
        description,
        needs: needs
          .split(/[,\n]/)
          .map((n) => n.trim())
          .filter(Boolean),
        avgCheck: Number(check) || 0,
        pledge: Number(pledge),
        confirmedDistinct: distinct,
      });
      await onCreated(result.id);
      toast.success("Запрос появился на карте. Ваш голос уже учтён.");
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
      title={
        step === 0
          ? "Где нужен новый бизнес?"
          : step === 1
            ? "Чего здесь не хватает?"
            : "Как вы готовы поддержать?"
      }
      description={
        step === 0
          ? "Выберите ЖК, затем отметьте точку на карте."
          : step === 1
            ? "Опишите место, в которое вам хотелось бы ходить."
            : "Это поможет предпринимателю понять интерес жителей."
      }
      wide
    >
      <div className="step-indicator">
        {[0, 1, 2].map((s) => (
          <span key={s} className={step >= s ? "done" : ""} />
        ))}
        <b>Шаг {step + 1} из 3</b>
      </div>
      {step === 0 && (
        <div className="form-fields">
          <label>
            ЖК или район
            <Choice
              label="ЖК или район"
              value={location}
              onChange={(v) => {
                setLocation(v);
                setPoint(null);
              }}
              options={[
                ...locations.map((l) => ({
                  value: l.name,
                  label: `ЖК «${l.name}»`,
                })),
                { value: "other", label: "Другое место в Москве или области" },
              ]}
            />
          </label>
          {location === "other" && (
            <div className="form-row">
              <label>
                Название места
                <input
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  maxLength={100}
                  placeholder="ЖК или улица"
                />
              </label>
              <label>
                Район
                <input
                  value={customDistrict}
                  onChange={(e) => setCustomDistrict(e.target.value)}
                  maxLength={100}
                  placeholder="Название района"
                />
              </label>
            </div>
          )}
          <MapView
            requests={[]}
            onSelect={() => {}}
            center={loc}
            selecting
            onPoint={setPoint}
            point={point}
            compact
          />
          {point ? (
            <p className="place-confirmed">
              <Check size={15} />
              Точка выбрана: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </p>
          ) : (
            <button
              className="btn secondary"
              onClick={() => setPoint({ lat: loc.lat, lng: loc.lng })}
            >
              <MapPin size={16} />
              Выбрать центр ЖК «{loc.name}»
            </button>
          )}
          <p className="form-hint">
            Точки ЖК приведены для ориентира. Уточните место на карте; точный
            адрес проживания не нужен.
          </p>
        </div>
      )}
      {step === 1 && (
        <div className="form-fields">
          <label>
            Категория
            <Choice
              value={category}
              onChange={(v) => {
                setCategory(v);
                setDistinct(false);
              }}
              label="Категория"
              options={categories.map((c) => ({ value: c.id, label: c.label }))}
            />
          </label>
          <label>
            Название запроса
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Например, семейный ресторан"
              autoFocus
            />
          </label>
          <label>
            Что для вас важно
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Какое место вы ищете? Для кого оно, когда вы будете приходить?"
            />
          </label>
          <label>
            Детали через запятую
            <input
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              maxLength={700}
              placeholder="Детское меню, можно с собакой, до 23:00"
            />
          </label>
          <label>
            Желаемый чек или стоимость услуги, ₽
            <input
              type="number"
              min="0"
              max="10000000"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
              placeholder="Например, 1 800"
            />
          </label>
          {similar.length > 0 && (
            <div className="similar-box">
              <h3>Похожий запрос уже есть рядом</h3>
              <p>Объединённый спрос заметнее предпринимателям.</p>
              {similar.map((r) => (
                <div key={r.id} className="similar-row">
                  <div>
                    {r.title}
                    <span>
                      ЖК «{r.location}» · {r.votes} голосов · демо
                    </span>
                  </div>
                  <button
                    className="btn secondary"
                    onClick={() => onJoin(r.id)}
                  >
                    Присоединиться
                  </button>
                </div>
              ))}
              <label className="checkbox-label">
                <Checkbox
                  checked={distinct}
                  onCheckedChange={(v) => setDistinct(v === true)}
                />
                Мой запрос отличается. Я описал отличие выше.
              </label>
            </div>
          )}
        </div>
      )}
      {step === 2 && (
        <>
          <div className="success-box">
            <strong>{title}</strong>
            <br />
            ЖК «{location === "other" ? customLocation : location}»
          </div>
          <RadioGroup
            className="pledge-list"
            value={pledge}
            onValueChange={setPledge}
          >
            {pledgeOptions.map((p) => (
              <label
                className="pledge-choice"
                data-selected={Number(pledge) === p.value}
                key={p.value}
              >
                <RadioGroupItem value={String(p.value)} />
                {p.label}
              </label>
            ))}
          </RadioGroup>
          <p className="form-hint">
            Платежей нет. Заявленная сумма — только намерение; её можно
            изменить. Запрос публикуется в тестовом пилоте с пометкой о
            демонстрации.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        {step > 0 && (
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
        )}
        <button className="btn primary" disabled={busy} onClick={next}>
          {busy
            ? "Публикуем…"
            : step === 2
              ? "Опубликовать запрос"
              : "Продолжить"}
        </button>
      </div>
    </Modal>
  );
}
