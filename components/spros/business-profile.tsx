"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
type Business = {
  legal_name: string;
  inn: string;
  contact: string;
  about: string;
  status: string;
  reason: string | null;
};
export function BusinessProfile() {
  const [business, setBusiness] = useState<Business | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<{ business: Business | null }>("/api/business-profile")
      .then((d) => {
        setBusiness(d.business);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/business-profile", {
        legalName: f.get("legalName"),
        inn: f.get("inn"),
        contact: f.get("contact"),
        about: f.get("about"),
      });
      setBusiness(
        (await api<{ business: Business }>("/api/business-profile")).business,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="business-profile">
      <h2>Профиль предпринимателя</h2>
      <p>
        Один аккаунт для жизни в районе и своего бизнеса. Укажите данные, чтобы
        команда пилота могла проверить компанию.
      </p>
      {business && (
        <div className="status-chip">
          {{
            pending: "На проверке",
            verified: "Проверено командой",
            rejected: "Нужно уточнение",
          }[business.status] ?? business.status}
        </div>
      )}
      {business?.reason && <p>{business.reason}</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!loaded && !error ? (
        <p>Загружаем…</p>
      ) : (
        <form className="form-fields" onSubmit={save}>
          <label>
            Название ИП или организации
            <input
              name="legalName"
              required
              minLength={3}
              maxLength={200}
              defaultValue={business?.legal_name}
            />
          </label>
          <div className="form-row">
            <label>
              ИНН
              <input
                name="inn"
                inputMode="numeric"
                pattern="[0-9]{10}|[0-9]{12}"
                required
                defaultValue={business?.inn}
              />
            </label>
            <label>
              Контакт для проверки
              <input
                name="contact"
                required
                minLength={5}
                maxLength={200}
                placeholder="Телефон или почта"
                defaultValue={business?.contact}
              />
            </label>
          </div>
          <label>
            О команде и опыте
            <textarea
              name="about"
              required
              minLength={20}
              maxLength={2000}
              defaultValue={business?.about}
            />
          </label>
          <p className="form-hint">
            Контакты и ИНН доступны вам и администраторам. Изменение данных
            отправляет профиль на повторную проверку. Проверка не является
            гарантией открытия бизнеса.
          </p>
          <button className="btn primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Отправить на проверку"}
          </button>
        </form>
      )}
    </section>
  );
}
