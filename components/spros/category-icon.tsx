import {
  Utensils,
  Coffee,
  ShoppingBasket,
  Dumbbell,
  Baby,
  PawPrint,
  Scissors,
  Car,
  Wrench,
  Drama,
  Shapes,
} from "lucide-react";
import { categoryById } from "@/lib/domain/catalog";
const icons = {
  food: Utensils,
  coffee: Coffee,
  grocery: ShoppingBasket,
  sport: Dumbbell,
  kids: Baby,
  pets: PawPrint,
  beauty: Scissors,
  auto: Car,
  services: Wrench,
  fun: Drama,
  other: Shapes,
};
export function CategoryIcon({
  id,
  boxed = false,
  size = 20,
}: {
  id: string;
  boxed?: boolean;
  size?: number;
}) {
  const cat = categoryById(id);
  const Icon = icons[cat.id];
  return boxed ? (
    <span
      className="category-icon"
      style={{ color: cat.color, background: cat.bg }}
    >
      <Icon size={size} strokeWidth={1.7} />
    </span>
  ) : (
    <Icon size={size} strokeWidth={1.7} />
  );
}
