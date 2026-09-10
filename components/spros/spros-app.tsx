"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  UserRound,
  Info,
  Map,
  List,
  X,
  BriefcaseBusiness,
  RotateCcw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { categories, locations } from "@/lib/domain/catalog";
import { seedDemands, seedOffers } from "@/lib/domain/seed";
import { distanceKm } from "@/lib/domain/geo";
import type {
  Dataset,
  Demand,
  Offer,
  Point,
  BusinessFilters,
} from "@/lib/domain/types";
import { MapView, initialCenter } from "./map-view";
import { CategoryIcon } from "./category-icon";
import { DemandCard } from "./demand-card";
import { Choice, Modal } from "./fields";
import { RequestDetail } from "./request-detail";
import { CreateRequest } from "./create-request";
import { CreateOffer, OfferCard, OfferDetail } from "./offers";
import { registerSprosTools } from "./webmcp";

import { api } from "@/lib/client";
const defaultFilters: BusinessFilters = {
  minVotes: 0,
  maxCheck: 0,
  minPledge: 0,
  radius: 0,
};
export function SprosApp() {
  const [data, setData] = useState<Dataset>({
    requests: seedDemands,
    offers: seedOffers,
    profile: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("resident");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("popular");
  const [onlyHot, setOnlyHot] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);
  const [listTab, setListTab] = useState("demands");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [center, setCenter] = useState<Point>(initialCenter);
  const [addRequest, setAddRequest] = useState(false);
  const [offerFor, setOfferFor] = useState<Demand | null | undefined>(
    undefined,
  );
  const [login, setLogin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [locationModal, setLocationModal] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setError("");
      const d = await api<Dataset>("/api/requests");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const p = new URLSearchParams(window.location.search);
    setSelected(p.get("request"));
    if (p.get("mode") === "business") setMode("business");
  }, [refresh]);
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(
    () =>
      registerSprosTools({
        getData: () => dataRef.current,
        filter: ({ category: cat, search }) => {
          if (cat) setCategory(cat);
          if (search !== undefined) setQuery(search);
        },
        open: (id) => setSelected(id),
        refresh,
      }),
    [refresh],
  );
  const requireAccount = () => {
    if (data.profile) return true;
    setLogin(true);
    return false;
  };
  const chooseLocation = (name: string) => {
    setLocation(name);
    const l = locations.find((l) => l.name === name);
    setCenter(l ?? initialCenter);
    setLocationModal(false);
  };
  const visible = useMemo(
    () =>
      data.requests
        .filter((r) => ["published", "review", "restored"].includes(r.status))
        .filter((r) => category === "all" || r.category === category)
        .filter((r) => location === "all" || r.location === location)
        .filter((r) =>
          `${r.title} ${r.location} ${r.district} ${r.needs.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .filter((r) => !onlyHot || r.votes >= 300)
        .filter(
          (r) =>
            mode !== "business" ||
            (r.votes >= filters.minVotes &&
              (!filters.maxCheck || r.avgCheck <= filters.maxCheck) &&
              r.pledgeTotal >= filters.minPledge &&
              (!filters.radius || distanceKm(r, center) <= filters.radius)),
        )
        .sort((a, b) =>
          sort === "new"
            ? b.createdAt - a.createdAt
            : sort === "funds"
              ? b.pledgeTotal - a.pledgeTotal
              : b.votes - a.votes,
        ),
    [
      data.requests,
      category,
      location,
      query,
      sort,
      onlyHot,
      mode,
      filters,
      center,
    ],
  );
  const offers = data.offers
    .filter(
      (o) =>
        (category === "all" || o.category === category) &&
        (location === "all" || o.location === location) &&
        `${o.title} ${o.location} ${o.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "new"
        ? b.createdAt - a.createdAt
        : sort === "funds"
          ? b.fundingNeeded - a.fundingNeeded
          : b.choices - a.choices,
    );
  const current = data.requests.find((r) => r.id === selected);
  useEffect(() => {
    if (current) setCenter({ lat: current.lat, lng: current.lng });
  }, [current?.lat, current?.lng]);
  useEffect(() => {
    if (
      !loading &&
      !error &&
      selected &&
      !data.requests.some((r) => r.id === selected)
    ) {
      toast.error(
        "Запрос не найден или недоступен. Посмотрите другие запросы на карте.",
      );
      setSelected(null);
    }
  }, [loading, error, selected, data.requests]);
  const mapRequests =
    listTab === "demands"
      ? visible
      : offers.map(
          (o) =>
            ({
              ...seedDemands[0],
              ...o,
              id: `offer:${o.id}`,
              title: o.title,
              votes: o.choices,
              seedVotes: 0,
              needs: [],
              pledgers: 0,
              pledgeTotal: 0,
            }) as Demand,
        );
  const openRequest = (r: Demand) => {
    if (r.id.startsWith("offer:")) {
      setSelectedOffer(data.offers.find((o) => o.id === r.id.slice(6)) ?? null);
      return;
    }
    setSelected(r.id);
    window.history.replaceState(
      null,
      "",
      `?request=${encodeURIComponent(r.id)}`,
    );
  };
  const closeDetail = () => {
    setSelected(null);
    window.history.replaceState(null, "", window.location.pathname);
  };
  const resetFilters = () => {
    setCategory("all");
    setQuery("");
    chooseLocation("all");
    setOnlyHot(false);
    setFilters(defaultFilters);
  };
  const filterCount = Object.values(filters).filter(Boolean).length;
  return (
    <div className="spros-app">
      <header className="app-header">
        <a className="brand" href="/" aria-label="SPROS, главная">
          <span className="brand-mark">s</span>
          <span>
            SPROS<span className="brand-period">.</span>
          </span>
        </a>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v)}
          className="mode-tabs"
        >
          <TabsList>
            <TabsTrigger value="resident">
              <Map size={16} />
              Карта спроса
            </TabsTrigger>
            <TabsTrigger value="business">
              <BriefcaseBusiness size={16} />
              Для бизнеса
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="header-actions">
          <button
            className="location-button"
            onClick={() => setLocationModal(true)}
          >
            <MapPin size={17} />
            <span>{location === "all" ? "Москва и область" : location}</span>
          </button>
          <a href="/rules" className="how-link">
            Как это работает
          </a>
          <button
            className="profile-button"
            aria-label="Мой профиль"
            onClick={() =>
              data.profile ? window.location.assign("/account") : setLogin(true)
            }
          >
            <UserRound size={18} />
            <span>{data.profile ? "Мой профиль" : "Войти"}</span>
          </button>
          <button
            className="btn primary header-add"
            onClick={() => {
              if (requireAccount())
                mode === "business" ? setOfferFor(null) : setAddRequest(true);
            }}
          >
            <Plus size={18} />
            {mode === "business" ? "Предложить бизнес" : "Добавить запрос"}
          </button>
        </div>
      </header>
      <nav className="categories" aria-label="Категории запросов">
        <button
          className={
            category === "all" ? "category active-category" : "category"
          }
          onClick={() => setCategory("all")}
        >
          <span className="all-category-icon">⌘</span>Все категории
        </button>
        <span className="category-divider" />
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`category ${category === c.id ? "active-category" : ""}`}
          >
            <CategoryIcon id={c.id} size={18} />
            {c.short}
          </button>
        ))}
      </nav>
      <div className="demo-banner">
        <Info size={14} />
        <span>
          <b>Пилот SPROS.</b> Запросы, предложения и показатели —
          демонстрационные. Платежей нет.
        </span>
        <a href="/rules#pilot">
          О пилоте <ArrowUpRight size={13} />
        </a>
      </div>
      <main className={`workspace ${mobileMap ? "mobile-show-map" : ""}`}>
        <aside className="request-sidebar">
          <div className="sidebar-heading">
            <div className="eyebrow">
              {mode === "business"
                ? "КАРТА ВОЗМОЖНОСТЕЙ"
                : "ХОРОШЕЕ МЕСТО НАЧИНАЕТСЯ С ЗАПРОСА"}
            </div>
            <h1>
              {mode === "business" ? (
                <>
                  Откройте бизнес
                  <br />
                  там, где его ждут.
                </>
              ) : (
                <>
                  Чего не хватает
                  <br />
                  рядом с вами?
                </>
              )}
            </h1>
            <p>
              {mode === "business"
                ? "Посмотрите, что нужно жителям района."
                : "Поддержите соседей. Предложите своё."}
            </p>
            <div className="search-field">
              <Search size={19} />
              <input
                aria-label="Поиск по ЖК, району или запросу"
                placeholder="ЖК, район или запрос"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  aria-label="Очистить поиск"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
              <button
                aria-label="Открыть фильтры"
                className={filterCount ? "filter-active" : ""}
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={18} />
                {filterCount > 0 && <sup>{filterCount}</sup>}
              </button>
            </div>
            <Tabs
              value={listTab}
              onValueChange={setListTab}
              className="list-tabs"
            >
              <TabsList>
                <TabsTrigger value="demands">Запросы жителей</TabsTrigger>
                <TabsTrigger value="offers">Предложения бизнеса</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="list-toolbar">
            <span>
              <b>{listTab === "demands" ? visible.length : offers.length}</b>{" "}
              {listTab === "demands" ? "запросов" : "предложения"}
            </span>
            <Choice
              label="Сортировать запросы"
              value={sort}
              onChange={setSort}
              options={[
                { value: "popular", label: "По спросу" },
                { value: "new", label: "Сначала новые" },
                { value: "funds", label: "По готовности внести" },
              ]}
            />
          </div>
          {listTab === "demands" && (
            <div className="hot-filter">
              <label htmlFor="hot-only">
                Только высокий спрос <span>от 300 голосов</span>
              </label>
              <Switch
                id="hot-only"
                checked={onlyHot}
                onCheckedChange={setOnlyHot}
              />
            </div>
          )}
          {error && (
            <div className="data-error" role="alert">
              {error}{" "}
              <button onClick={() => void refresh()}>
                <RotateCcw size={14} />
                Повторить
              </button>
              <span>Показаны примеры. Сохранение временно недоступно.</span>
            </div>
          )}
          <div className="request-list" aria-busy={loading}>
            {listTab === "demands"
              ? visible.map((r) => (
                  <DemandCard
                    key={r.id}
                    request={r}
                    onOpen={() => openRequest(r)}
                    business={mode === "business"}
                  />
                ))
              : offers.map((o) => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    onOpen={() => setSelectedOffer(o)}
                  />
                ))}
            {(listTab === "demands" ? visible : offers).length === 0 && (
              <div className="empty-state">
                <Search size={32} />
                <h3>Пока ничего не найдено</h3>
                <p>
                  Измените фильтры или добавьте первый запрос в этом районе.
                </p>
                <button className="btn secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              </div>
            )}
            <div className="list-ending">
              {loading
                ? "Обновляем карту…"
                : "Все показатели относятся к демонстрации."}
            </div>
          </div>
          <div className="sidebar-footer">
            <a href="/rules#moderation">Правила и модерация</a>
            <span>SPROS · пилот</span>
          </div>
        </aside>
        <section className="map-section" aria-label="Карта">
          <MapView
            kind={listTab === "offers" ? "offers" : "demands"}
            requests={mapRequests}
            onSelect={openRequest}
            selectedId={selected ?? undefined}
            center={center}
          />
        </section>
        <button
          className="mobile-view-toggle"
          onClick={() => setMobileMap(!mobileMap)}
        >
          {mobileMap ? <List size={18} /> : <Map size={18} />}{" "}
          {mobileMap ? "Список запросов" : "На карту"}
        </button>
        <button
          className="mobile-add"
          aria-label="Добавить запрос или бизнес"
          onClick={() => {
            if (requireAccount())
              mode === "business" ? setOfferFor(null) : setAddRequest(true);
          }}
        >
          <Plus size={22} />
        </button>
      </main>
      <RequestDetail
        request={current ?? null}
        offers={data.offers.filter((o) => o.requestId === selected)}
        onClose={closeDetail}
        onRefresh={refresh}
        requireAccount={requireAccount}
        onOffer={() => {
          if (requireAccount()) {
            closeDetail();
            setOfferFor(current ?? null);
          }
        }}
      />
      <CreateRequest
        open={addRequest}
        onClose={() => setAddRequest(false)}
        requests={data.requests}
        onCreated={async (id) => {
          setAddRequest(false);
          await refresh();
          resetFilters();
          setSelected(id);
        }}
        onJoin={async (id) => {
          try {
            const existing = data.requests.find((r) => r.id === id);
            await api("/api/actions", {
              action: "support",
              requestId: id,
              pledge: existing?.myPledge ?? 0,
            });
            await refresh();
            setAddRequest(false);
            setSelected(id);
            toast.success("Вы присоединились к запросу. Ваш голос учтён.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <CreateOffer
        open={offerFor !== undefined}
        request={offerFor ?? null}
        onClose={() => setOfferFor(undefined)}
        onCreated={async () => {
          setOfferFor(undefined);
          setListTab("offers");
          await refresh();
        }}
      />
      <OfferDetail
        offer={
          selectedOffer
            ? (data.offers.find((o) => o.id === selectedOffer.id) ??
              selectedOffer)
            : null
        }
        onClose={() => setSelectedOffer(null)}
        onRefresh={refresh}
        requireAccount={requireAccount}
      />
      <Modal
        open={login}
        onClose={() => setLogin(false)}
        title="Один аккаунт — один голос"
        description="Войдите, чтобы поддерживать запросы, добавлять свои и предлагать бизнес."
      >
        <div className="auth-note">
          <UserRound size={28} />
          <p>
            В этой версии пилота доступен вход через ChatGPT. Подтверждение
            телефона и проживания ещё не подключено.
          </p>
        </div>
        <a
          className="btn primary full-width"
          href={`/signin-with-chatgpt?return_to=${encodeURIComponent(selected ? `/?request=${selected}` : "/")}`}
          target="_top"
        >
          Войти через ChatGPT <ArrowUpRight size={17} />
        </a>
        <p className="form-hint">
          Вход не означает, что человек подтверждён как житель района.
        </p>
      </Modal>
      <Modal
        open={locationModal}
        onClose={() => setLocationModal(false)}
        title="Выберите район"
        description="Пять ЖК для демонстрации пилота. Точку нового запроса можно выбрать вручную."
      >
        <div className="location-options">
          <button onClick={() => chooseLocation("all")}>
            <MapPin size={19} />
            <div>
              <b>Москва и область</b>
              <span>Все запросы</span>
            </div>
          </button>
          {locations.map((l) => (
            <button key={l.name} onClick={() => chooseLocation(l.name)}>
              <MapPin size={19} />
              <div>
                <b>ЖК «{l.name}»</b>
                <span>{l.district}</span>
              </div>
              {location === l.name && <span className="selected-dot" />}
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Настроить карту"
        description={
          mode === "business"
            ? "Найдите спрос под свой формат бизнеса."
            : "Выберите место и категорию."
        }
      >
        <div className="form-fields">
          <label>
            ЖК
            <Choice
              value={location}
              label="ЖК"
              onChange={(v) => {
                setLocation(v);
                setCenter(locations.find((l) => l.name === v) ?? initialCenter);
              }}
              options={[
                { value: "all", label: "Все ЖК" },
                ...locations.map((l) => ({ value: l.name, label: l.name })),
              ]}
            />
          </label>
          <label>
            Категория
            <Choice
              value={category}
              label="Категория"
              onChange={setCategory}
              options={[
                { value: "all", label: "Все категории" },
                ...categories.map((c) => ({ value: c.id, label: c.label })),
              ]}
            />
          </label>
          {mode === "business" && (
            <>
              <div className="form-row">
                <label>
                  Минимум голосов
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={filters.minVotes || ""}
                    placeholder="Например, 100"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minVotes: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Чек до, ₽
                  <input
                    type="number"
                    min="0"
                    value={filters.maxCheck || ""}
                    placeholder="Без ограничения"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxCheck: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Заявленная готовность внести от, ₽
                <input
                  type="number"
                  min="0"
                  value={filters.minPledge || ""}
                  placeholder="Без ограничения"
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      minPledge: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </label>
              <label>
                Радиус от выбранного ЖК
                <Choice
                  value={String(filters.radius)}
                  label="Радиус"
                  onChange={(v) =>
                    setFilters({ ...filters, radius: Number(v) })
                  }
                  options={[
                    { value: "0", label: "Без ограничения" },
                    { value: "1", label: "1 км" },
                    { value: "3", label: "3 км" },
                    { value: "5", label: "5 км" },
                    { value: "10", label: "10 км" },
                  ]}
                />
              </label>
              <p className="form-hint">
                Для «Все ЖК» центр радиуса — Шелепиха. Заявленные суммы не
                являются предзаказами или выручкой.
              </p>
            </>
          )}
        </div>
        <div className="form-actions">
          <button
            className="btn secondary"
            onClick={() => {
              resetFilters();
              setShowFilters(false);
            }}
          >
            Сбросить
          </button>
          <button className="btn primary" onClick={() => setShowFilters(false)}>
            Показать на карте
          </button>
        </div>
      </Modal>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
