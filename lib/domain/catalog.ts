import type { CategoryId } from "./types";

export const categories: {
  id: CategoryId;
  label: string;
  short: string;
  color: string;
  bg: string;
}[] = [
  {
    id: "food",
    label: "Рестораны и кафе",
    short: "Рестораны",
    color: "#a56131",
    bg: "#f7ebde",
  },
  {
    id: "coffee",
    label: "Кофейни",
    short: "Кофейни",
    color: "#84624d",
    bg: "#eee6df",
  },
  {
    id: "grocery",
    label: "Продукты",
    short: "Продукты",
    color: "#5b804b",
    bg: "#ecf1e5",
  },
  {
    id: "sport",
    label: "Спорт",
    short: "Спорт",
    color: "#517b98",
    bg: "#e6eff5",
  },
  { id: "kids", label: "Дети", short: "Дети", color: "#9474a4", bg: "#f0eaf6" },
  {
    id: "pets",
    label: "Животные",
    short: "Животные",
    color: "#ad784b",
    bg: "#f8ecdf",
  },
  {
    id: "beauty",
    label: "Красота",
    short: "Красота",
    color: "#a06983",
    bg: "#f7eaf0",
  },
  {
    id: "auto",
    label: "Автомобили",
    short: "Авто",
    color: "#617b8a",
    bg: "#e7eef2",
  },
  {
    id: "services",
    label: "Услуги",
    short: "Услуги",
    color: "#578780",
    bg: "#e4f0ed",
  },
  {
    id: "fun",
    label: "Развлечения",
    short: "Развлечения",
    color: "#8879a4",
    bg: "#eeebf7",
  },
  {
    id: "other",
    label: "Другое",
    short: "Другое",
    color: "#718077",
    bg: "#eef0ee",
  },
];
export const categoryById = (id: string) =>
  categories.find((c) => c.id === id) ?? categories[10];
export const locations = [
  {
    name: "Сердце столицы",
    district: "Хорошёво-Мнёвники",
    lat: 55.7652,
    lng: 37.509,
  },
  { name: "Береговой", district: "Филёвский Парк", lat: 55.756, lng: 37.502 },
  { name: "Остров", district: "Хорошёво-Мнёвники", lat: 55.7568, lng: 37.448 },
  { name: "Хорошёвский", district: "Хорошёвский", lat: 55.787, lng: 37.491 },
  { name: "Символ", district: "Лефортово", lat: 55.7483, lng: 37.702 },
];
export const pledgeOptions = [
  { value: 0, label: "Только проголосовать" },
  { value: 1000, label: "До 1 000 ₽" },
  { value: 5000, label: "До 5 000 ₽" },
  { value: 15000, label: "До 15 000 ₽" },
  { value: 50000, label: "50 000 ₽ и больше" },
];
export const statusLabels: Record<string, string> = {
  published: "Опубликован",
  review: "На проверке",
  merged: "Объединён",
  hidden: "Скрыт",
  restored: "Восстановлен после апелляции",
};
export const reportReasons = [
  "Спам или реклама не по теме",
  "Мошенничество",
  "Угрозы или травля",
  "Чужие персональные данные",
  "Незаконное предложение",
  "Фиктивный запрос",
  "Другое нарушение",
];
export const formatNumber = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n);
export const rubles = (n: number) => `${formatNumber(n)} ₽`;
export const shortRubles = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
    : n >= 1000
      ? `${Math.round(n / 1000)} тыс. ₽`
      : rubles(n);
