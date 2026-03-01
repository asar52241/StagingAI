"use client";

import Link from "next/link";
import { useState } from "react";
import { LEGAL } from "@/config/legal";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { HeroSection } from "@/components/ui/hero-section";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: "upload" | "brush" | "spark" | "send";
};

type UseCase = {
  title: string;
  subtitle: string;
  beforeSrc: string;
  afterSrc: string;
};

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: "500+", label: "брокеров и агентов пользуются сервисом ежедневно" },
  { value: "~1 мин", label: "среднее время обработки" },
  { value: "95%", label: "пользователей довольны результатом" },
];

const steps: Step[] = [
  {
    id: "01",
    title: "Загрузите фото",
    description:
      "Добавьте снимок с телефона или компьютера — мы автоматически подготовим его к обработке.",
    hint: "JPG · PNG · WEBP · GIF",
    icon: "upload",
  },
  {
    id: "02",
    title: "Отметьте лишнее",
    description:
      "Проведите кистью по мебели или предметам. Вы сами контролируете область удаления.",
    hint: "Ручная маска",
    icon: "brush",
  },
  {
    id: "03",
    title: "AI обрабатывает",
    description:
      "Нейросеть аккуратно удаляет объекты и восстанавливает фон без артефактов и искажений.",
    hint: "~1 минута",
    icon: "spark",
  },
  {
    id: "04",
    title: "Публикуйте",
    description:
      "Скачайте готовое фото в высоком разрешении. Подходит для любых листингов и платформ.",
    hint: "PNG экспорт",
    icon: "send",
  },
];

const useCases: UseCase[] = [
  {
    title: "Гостиная",
    subtitle: "Убираем диваны и мелкий декор, чтобы подчеркнуть объём комнаты.",
    beforeSrc: "/images/cases/living-room-before.jpeg",
    afterSrc: "/images/cases/living-room-after.png",
  },
  {
    title: "Спальня",
    subtitle: "Очищаем кадр от личных вещей перед публикацией в продажу.",
    beforeSrc: "/images/cases/bedroom-before.webp",
    afterSrc: "/images/cases/bedroom-after.png",
  },
  {
    title: "Кухня",
    subtitle: "Удаляем визуальный шум — фокус на планировке и свете.",
    beforeSrc: "/images/cases/kitchen-before.png",
    afterSrc: "/images/cases/kitchen-after.png",
  },
];

const testimonials: Testimonial[] = [
  {
    quote:
      "Мы стали выпускать объекты в рекламу быстрее: фото выглядят аккуратно, а клиенты лучше реагируют на карточки.",
    name: "Елена Козлова",
    role: "Head of Sales, UrbanNest",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  },
  {
    quote:
      "Ручная маска даёт нужный контроль. Для премиальных лотов это критично: детали интерьера остаются естественными.",
    name: "Игорь Смирнов",
    role: "Брокер, Prime Listing",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
  },
];

const faqItems: FaqItem[] = [
  {
    question: "Нужно ли уметь работать в Photoshop?",
    answer:
      "Нет. Интерфейс рассчитан на брокеров: загрузили фото, отметили лишнее, получили готовый кадр.",
  },
  {
    question: "Что лучше выбрать: авто или ручную маску?",
    answer:
      "Для скорости подойдёт авто-режим. Для главных фото объекта рекомендуем ручную маску — она даёт точный контроль.",
  },
  {
    question: "Сколько длится обработка одного фото?",
    answer:
      "Обычно около 1 минуты. Для сложных зон можно сделать дополнительный проход.",
  },
  {
    question: "Можно ли использовать на мобильном?",
    answer:
      "Да, сервис работает в браузере на телефоне. Для детальной маски удобнее планшет или ноутбук.",
  },
  {
    question: "Какие изображения подходят лучше всего?",
    answer:
      "Светлые, резкие фото без сильного шума. Чем выше качество исходника, тем естественнее результат.",
  },
  {
    question: "Можно ли изменить планировку или перегородки?",
    answer:
      "Нет. Сервис предназначен для удаления временных предметов, а не для изменения конструктива помещения.",
  },
  {
    question: "Где хранятся мои фото?",
    answer:
      "Файлы используются только для обработки и не сохраняются на сервере после выдачи результата.",
  },
];

const limitations = [
  "Не изменяет конструктив помещений: стены, окна, полы остаются нетронутыми",
  "Авто-режим может затронуть мелкие детали — для точного контроля используйте ручную маску",
  "Лучше всего работает на интерьерах с хорошим освещением и без сильного шума",
  "Инструмент для визуальной подготовки фото, а не изменения характеристик объекта",
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M8 6.5v11l8.5-5.5L8 6.5z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5 text-amber-400"
      aria-hidden
    >
      <path d="M12 3.2l2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9-4.3-4.2 6-.9L12 3.2z" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path
        d="M5 13l4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepIcon({ icon }: { icon: Step["icon"] }) {
  if (icon === "upload") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M12 15V5" strokeLinecap="round" />
        <path
          d="M8.5 8.5L12 5l3.5 3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 15.5v2A1.9 1.9 0 006.4 19.4h11.2a1.9 1.9 0 001.9-1.9v-2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "brush") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        className="h-5 w-5"
        aria-hidden
      >
        <path
          d="M4.8 18.8a3.8 3.8 0 005.4 0l8.1-8.1a2.5 2.5 0 10-3.5-3.5l-8.1 8.1a3.8 3.8 0 000 5.4z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (icon === "spark") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        className="h-5 w-5"
        aria-hidden
      >
        <path
          d="M12 4l1.7 3.9L17.6 9l-3.9 1.7L12 14.6l-1.7-3.9L6.4 9l3.9-1.1L12 4z"
          strokeLinejoin="round"
        />
        <path
          d="M18.3 14.3l.7 1.5 1.5.7-1.5.6-.7 1.6-.7-1.6-1.5-.6 1.5-.7.7-1.5z"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-5 w-5"
      aria-hidden
    >
      <path
        d="M4.5 12.5l4.2 4.2 10.8-10.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-6 w-6"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-6 w-6"
      aria-hidden
    >
      <rect x="2" y="8" width="20" height="13" rx="2" />
      <path
        d="M8 8V6a4 4 0 018 0v2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-6 w-6"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 21V9h6v12" strokeLinecap="round" />
      <path d="M9 13h6M9 9h6" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M12 11v5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center px-6 py-6 text-center"
          >
            <span className="text-3xl font-extrabold tracking-tight text-gray-900">
              {stat.value}
            </span>
            <span className="mt-1.5 text-sm text-gray-500">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

const STEP_EMOJI: Record<Step["icon"], string> = {
  upload: "🗂️",
  brush: "✏️",
  spark: "⚡",
  send: "🚀",
};

function StepCard({ step }: { step: Step }) {
  return (
    <article className="group flex flex-col bg-gray-50 p-7 transition-colors duration-200 hover:bg-white">
      <span
        className="select-none text-[72px] font-black leading-none tracking-tighter text-gray-200 transition-colors duration-200 group-hover:text-gray-100"
        aria-hidden
      >
        {step.id}
      </span>

      <div className="mt-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-xl shadow-sm transition-shadow duration-200 group-hover:shadow-md">
        {STEP_EMOJI[step.icon]}
      </div>

      <h3 className="mt-5 text-base font-bold tracking-tight text-gray-900">
        {step.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500">
        {step.description}
      </p>

      <div className="mt-5">
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
          {step.hint}
        </span>
      </div>
    </article>
  );
}

// ─── Use Case Card ────────────────────────────────────────────────────────────

function UseCaseCard({ item }: { item: UseCase }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={item.beforeSrc}
          alt={`${item.title} до`}
          className="h-full w-full object-cover transition duration-500"
          loading="lazy"
        />
        <img
          src={item.afterSrc}
          alt={`${item.title} после`}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
          loading="lazy"
        />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition group-hover:opacity-0">
          До
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          После
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
        <p className="mt-2 text-xs text-gray-400">Наведите для сравнения</p>
      </div>
    </article>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Quote mark */}
      <svg
        viewBox="0 0 32 32"
        fill="currentColor"
        className="mb-4 h-7 w-7 text-gray-200"
        aria-hidden
      >
        <path d="M10 8C5.6 8 2 11.6 2 16c0 3.8 2.6 7 6.2 7.8C7.6 26.4 6 28 4 28h2c3.4 0 6-2.6 6.4-6H12c2.2 0 4-1.8 4-4v-6c0-2.2-1.8-4-4-4h-2zm16 0c-4.4 0-8 3.6-8 8 0 3.8 2.6 7 6.2 7.8C23.6 26.4 22 28 20 28h2c3.4 0 6-2.6 6.4-6H28c2.2 0 4-1.8 4-4v-6c0-2.2-1.8-4-4-4h-2z" />
      </svg>

      <p className="text-sm leading-relaxed text-gray-700">{item.quote}</p>

      <div className="mt-5 flex items-center gap-3">
        <img
          src={item.avatar}
          alt={item.name}
          className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-bold text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">{item.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon key={i} />
          ))}
        </div>
      </div>
    </article>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-900">
          {item.question}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-gray-600">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Price Calculator ─────────────────────────────────────────────────────────
/*
 * Pricing algorithm: DP — minimum-cost combination of packages + штучные фото.
 *
 * Packages: 10=450 ₽, 15=700 ₽, 20=950 ₽, 30=1400 ₽  |  штучно: 50 ₽/фото
 *
 * Examples:
 *   N=3  → 3×50 = 150 ₽              (штучно, скидок нет, минимум)
 *   N=10 → пакет 10 = 450 ₽          (экономия 50 ₽ vs 500 ₽ штучно)
 *   N=12 → пакет 10 + 2×50 = 550 ₽   (экономия 50 ₽ vs 600 ₽ штучно)
 *   N=30 → 3×(пакет 10) = 1350 ₽     (экономия 150 ₽; пакет 30=1400 ₽ дороже)
 */
const CALC_PKGS = [
  { n: 30, p: 1400 },
  { n: 20, p: 950 },
  { n: 15, p: 700 },
  { n: 10, p: 450 },
] as const;

function calcMinPrice(photos: number): number {
  // dp[i] = min cost for exactly i photos
  const dp = new Array(photos + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= photos; i++) {
    if (dp[i - 1] < Infinity) dp[i] = Math.min(dp[i], dp[i - 1] + 50);
    for (const { n, p } of CALC_PKGS) {
      if (i >= n && dp[i - n] < Infinity) {
        dp[i] = Math.min(dp[i], dp[i - n] + p);
      }
    }
  }
  return dp[photos];
}

function PriceCalculator() {
  const [count, setCount] = useState(5);
  const [maxHint, setMaxHint] = useState(false);

  const valid = count >= 3;
  const basePrice = count * 50;
  const total = valid ? calcMinPrice(count) : 0;
  const savings = valid ? Math.max(0, basePrice - total) : 0;
  const perPhoto = valid ? Math.round((total / count) * 10) / 10 : 50;

  const step = (delta: number) => {
    setCount((c) => Math.max(1, Math.min(30, c + delta)));
    setMaxHint(false);
  };

  const onInput = (e: { target: HTMLInputElement }) => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 1) return;
    if (v > 30) {
      setCount(30);
      setMaxHint(true);
    } else {
      setCount(v);
      setMaxHint(false);
    }
  };

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="grid gap-px bg-gray-100 sm:grid-cols-[1fr_280px]">
        {/* ── Controls ── */}
        <div className="bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
            Калькулятор
          </p>
          <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-gray-900">
            Рассчитайте стоимость
          </h3>
          <p className="mt-1 text-sm text-gray-400">1 фото = 1 готовый экспорт</p>

          <div className="mt-6 space-y-4">
            <span className="block text-sm font-semibold text-gray-700">
              Количество фото
            </span>

            {/* Stepper */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={count <= 1}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-600 transition hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Уменьшить"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={onInput}
                className="h-10 w-16 rounded-xl border border-gray-200 text-center text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => step(1)}
                disabled={count >= 30}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-600 transition hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Увеличить"
              >
                +
              </button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={1}
              max={30}
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value));
                setMaxHint(false);
              }}
              className="w-full accent-blue-600"
              aria-label="Количество фото"
            />

            {/* Hints */}
            {count < 3 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-700">
                <InfoIcon />
                Минимум 3 фото = 150 ₽
              </div>
            )}
            {maxHint && (
              <div className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-700">
                <InfoIcon />
                Максимум за один заказ — 30 фото
              </div>
            )}
          </div>
        </div>

        {/* ── Result ── */}
        <div className="flex flex-col justify-between bg-gray-50 p-6 sm:p-8">
          {valid ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Итого
                </p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight text-gray-900">
                  {total.toLocaleString("ru-RU")} ₽
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Эффективно</span>
                    <span className="font-semibold text-gray-900">
                      {perPhoto} ₽/фото
                    </span>
                  </div>
                  {savings > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Экономия</span>
                        <span className="font-semibold text-green-600">
                          −{savings} ₽
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>vs штучно</span>
                        <span className="line-through">{basePrice} ₽</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <Link
                href="/studio"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gray-900 px-4 py-3 text-sm font-bold text-white ring-4 ring-gray-100 transition hover:-translate-y-0.5 hover:bg-gray-800"
              >
                Начать обработку
              </Link>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-4 text-center">
              <p className="text-4xl font-extrabold text-gray-200">— ₽</p>
              <p className="text-sm text-gray-400">Выберите от 3 фото</p>
              <button
                disabled
                className="mt-2 inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-gray-100 px-4 py-3 text-sm font-bold text-gray-400"
              >
                Начать обработку
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

const floatingNavItems = [
  { name: "Как работает", link: "#how" },
  { name: "Примеры", link: "#cases" },
  { name: "Режимы", link: "#modes" },
  { name: "Тарифы", link: "#pricing" },
  { name: "FAQ", link: "#faq" },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-gray-900">
      <FloatingNav navItems={floatingNavItems} />
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="#hero"
            className="text-sm font-extrabold tracking-[0.18em] text-gray-900"
          >
            StagingAI
          </a>

          <div className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
            <a href="#how" className="transition hover:text-gray-900">
              Как работает
            </a>
            <a href="#cases" className="transition hover:text-gray-900">
              Примеры
            </a>
            <a href="#modes" className="transition hover:text-gray-900">
              Режимы
            </a>
            <a href="#pricing" className="transition hover:text-gray-900">
              Тарифы
            </a>
            <a href="#faq" className="transition hover:text-gray-900">
              FAQ
            </a>
          </div>

          <Link
            href="/studio"
            className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white ring-4 ring-gray-100 transition hover:-translate-y-0.5 hover:bg-gray-800"
          >
            Загрузить фото
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* ── Hero ── */}
        <HeroSection
          className="px-0"
          badge={{
            text: "AI сервис для недвижимости",
            action: {
              text: "Как работает",
              href: "#how",
            },
          }}
          title={
            <>
              Уберите лишнее с фото за
              <br />
              ~1 минуту
            </>
          }
          description="Отметьте кистью, что убрать — AI сделает чистое фото для объявления."
          note="Визуальная подготовка фото помогает показать потенциал помещения без изменения фактических характеристик."
          actions={[
            {
              text: "Загрузить фото",
              href: "/studio",
              variant: "default",
            },
            {
              text: "Смотреть примеры",
              href: "#cases",
              variant: "glow",
              icon: <PlayIcon />,
            },
          ]}
          comparison={{
            beforeSrc: "/images/hero-before.png",
            afterSrc: "/images/hero-after.png",
            beforeAlt: "Комната до обработки",
            afterAlt: "Комната после обработки",
            helperText: "Потяните ползунок для сравнения",
          }}
        />

        {/* ── Stats ── */}
        <section className="mt-20">
          <StatsBar />
        </section>

        {/* ── How it works ── */}
        <section id="how" className="mt-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Как работает
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              4 шага от фото до публикации
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-500">
              Весь процесс — в браузере, без дополнительных программ.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 shadow-sm">
            <div className="grid gap-px bg-gray-200 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Use Cases ── */}
        <section id="cases" className="mt-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Примеры
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Гостиная, спальня, кухня
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-500">
              Наведите курсор на карточку, чтобы увидеть результат.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {useCases.map((item) => (
              <UseCaseCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        {/* ── Features CTA ── */}
        <section id="modes" className="mt-24 overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 px-6 py-16 text-center sm:px-12">
          <h2 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Подготовьте фото за ~1 минуту
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Без регистрации. Без карты.
          </p>

          <div className="mt-8">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Попробовать бесплатно
            </Link>
            <p className="mt-3 text-xs text-gray-400">
              Без установки · Без регистрации · Результат за ~1 мин
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <div className="grid gap-px bg-gray-200 md:grid-cols-2 xl:grid-cols-4">
              {[
                { emoji: "✨", title: "Просто", desc: "Кисть по объекту — остальное делает AI. Без Photoshop." },
                { emoji: "⚡", title: "Быстро", desc: "Готовое фото примерно за 1 минуту. Без ожидания и очереди." },
                { emoji: "💎", title: "Доступно", desc: "Дешевле, чем услуги дизайнера в десятки раз." },
                { emoji: "🎯", title: "Точное удаление", desc: "AI удаляет только то, что вы отметили — фон остаётся нетронутым." },
              ].map((f) => (
                <div key={f.title} className="bg-white p-6 text-left">
                  <span className="text-2xl">{f.emoji}</span>
                  <h3 className="mt-3 text-sm font-bold text-gray-900">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>



        {/* ── Pricing ── */}
        <section id="pricing" className="mt-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Тарифы
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Платите за результат
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-500">
              Без карты. Попробуйте прямо сейчас.
            </p>
          </div>

          <PriceCalculator />
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mt-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              FAQ
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Частые вопросы
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqItems.map((item) => (
              <FaqItem key={item.question} item={item} />
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative mt-24 overflow-hidden rounded-3xl bg-gray-900 px-6 py-14 text-center sm:px-12">
          {/* gradient orbs */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-64 w-64 -translate-x-1/3 -translate-y-1/3 rounded-full bg-blue-600/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-sky-400/10 blur-3xl"
            aria-hidden
          />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
              Начните прямо сейчас
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Подготовьте фото объекта к публикации сегодня
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-400">
              Загрузите первый кадр и проверьте, как чистая подача помещения
              влияет на отклик в объявлении.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/studio"
                className="inline-flex items-center rounded-full bg-white px-7 py-3.5 text-sm font-bold text-gray-900 transition hover:-translate-y-0.5 hover:bg-gray-100"
              >
                Загрузить фото бесплатно
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <PlayIcon />
                Как это работает
              </a>
            </div>

            <p className="mt-5 text-xs text-gray-500">
              Без карты · Результат за ~1 мин
            </p>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Top row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-extrabold tracking-[0.14em] text-gray-900">
                {LEGAL.brandName}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Визуальная подготовка фото недвижимости для объявлений
              </p>
            </div>
            {/* Legal links */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-400">
              <Link href="/offer" className="transition hover:text-gray-700">
                Публичная оферта
              </Link>
              <Link href="/privacy" className="transition hover:text-gray-700">
                Политика конфиденциальности
              </Link>
              <Link href="/refund" className="transition hover:text-gray-700">
                Возврат
              </Link>
              <Link href="/contacts" className="transition hover:text-gray-700">
                Контакты
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {LEGAL.sellerType} {LEGAL.sellerName} · ИНН&nbsp;{LEGAL.sellerInn} · г.&nbsp;{LEGAL.sellerCity}
              </p>
              <div className="flex items-center gap-4">
                <a
                  href={`mailto:${LEGAL.email}`}
                  className="transition hover:text-gray-700"
                >
                  {LEGAL.email}
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              © {new Date().getFullYear()} {LEGAL.brandName}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
