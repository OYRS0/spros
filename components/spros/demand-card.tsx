"use client";
import { ArrowUpRight, Users, Wallet, Check } from "lucide-react";
import type { Demand } from "@/lib/domain/types";
import { categoryById, formatNumber, shortRubles } from "@/lib/domain/catalog";
import { CategoryIcon } from "./category-icon";

export function DemandCard({
  request: r,
  onOpen,
  business = false,
}: {
  request: Demand;
  onOpen: () => void;
  business?: boolean;
}) {
  return (
    <button
      className={`demand-card ${r.supported ? "supported-card" : ""}`}
      onClick={onOpen}
    >
      <div className="card-category">
        <CategoryIcon id={r.category} boxed />
        <span>{categoryById(r.category).label}</span>
        {r.votes >= 300 ? (
          <span className="hot-label">Высокий спрос</span>
        ) : r.isDemo ? (
          <span className="demo-tiny">Демо</span>
        ) : null}
      </div>
      <h3>
        {r.title}
        <ArrowUpRight size={18} />
      </h3>
      <div className="card-location">
        ЖК «{r.location}» <span>· {r.district}</span>
      </div>
      <div className="need-chips">
        {r.needs.slice(0, 2).map((n) => (
          <span key={n}>{n}</span>
        ))}
        {r.needs.length > 2 && (
          <span className="more-needs">+{r.needs.length - 2}</span>
        )}
      </div>
      <div className="card-stats">
        <span>
          <Users size={17} />
          <b>{formatNumber(r.votes)}</b> <small>поддержали</small>
        </span>
        <span title="Готовность внести деньги, без платежей">
          <Wallet size={16} />
          {business ? shortRubles(r.pledgeTotal) : formatNumber(r.pledgers)}
          {!business && <small>готовы внести</small>}
        </span>
      </div>
      {(r.supported || r.offerCount > 0) && (
        <div className="card-status">
          {r.supported ? (
            <span>
              <Check size={14} />
              Вы поддержали
            </span>
          ) : (
            <span>{r.offerCount} предложения бизнеса</span>
          )}
          <span>{r.isDemo ? "Демонстрационный запрос" : "Запрос пилота"}</span>
        </div>
      )}
    </button>
  );
}
