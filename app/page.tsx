"use client";

import Link from "next/link";
import { useState } from "react";
import { Pill, PillIndicator } from "@/components/ui/pill";
import { AccordionFeatureSection } from "@/components/blocks/accordion-feature-section";

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

type Plan = {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

type FaqItem = {
  question: string;
  answer: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: "500+", label: "брокеров и агентов пользуются сервисом ежедневно" },
  { value: "15 сек", label: "среднее время обработки" },
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
    hint: "~15 секунд",
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

const plans: Plan[] = [
  {
    name: "Free",
    price: "0 ₽",
    cadence: "/ 7 дней",
    features: [
      "До 10 обработок",
      "Ручная маска",
      "Экспорт PNG",
      "Базовая поддержка",
    ],
    cta: "Начать бесплатно",
  },
  {
    name: "Pro",
    price: "3 900 ₽",
    cadence: "/ месяц",
    features: [
      "До 500 обработок",
      "Авто + ручной режим",
      "Приоритетная скорость",
      "Командный доступ до 3 пользователей",
    ],
    cta: "Выбрать Pro",
    highlighted: true,
  },
  {
    name: "Агентство",
    price: "11 900 ₽",
    cadence: "/ месяц",
    features: [
      "Безлимитные обработки",
      "До 15 пользователей",
      "Приоритетная поддержка",
      "Единый биллинг для офиса",
    ],
    cta: "Связаться с нами",
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
      "Обычно от 5 до 15 секунд. Для сложных зон можно сделать дополнительный проход.",
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

// ─── Before/After Slider ──────────────────────────────────────────────────────

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  id?: string;
};

function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  id,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(52);

  return (
    <div
      id={id}
      className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="relative aspect-[4/3]">
        <img
          src={beforeSrc}
          alt={beforeAlt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={afterSrc}
            alt={afterAlt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          До
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 backdrop-blur-sm">
          После
        </div>

        {/* Divider line */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.3)]"
          style={{ left: `${position}%` }}
        />
        {/* Handle */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position}%` }}
        >
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-gray-900 text-white shadow-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M8 7l-4 5 4 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={position}
          aria-label="Сравнение до и после"
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 text-center text-xs text-gray-400">
        Потяните ползунок для сравнения
      </div>
    </div>
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

// ─── Pricing Card ─────────────────────────────────────────────────────────────

function PricingCard({ plan }: { plan: Plan }) {
  const highlighted = !!plan.highlighted;

  return (
    <article
      className={`relative rounded-3xl border p-6 shadow-sm ${
        highlighted
          ? "border-blue-300 bg-white shadow-[0_12px_32px_rgba(37,99,235,0.10)]"
          : "border-gray-200 bg-white"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3.5 left-6 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Популярный
        </span>
      )}

      <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-gray-900">
          {plan.price}
        </span>
        <span className="text-sm text-gray-400">{plan.cadence}</span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <span
              className={`mt-0.5 ${highlighted ? "text-blue-600" : "text-gray-400"}`}
            >
              <CheckIcon />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href="/studio"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
          highlighted
            ? "bg-gray-900 text-white ring-4 ring-blue-100 hover:bg-gray-800"
            : "border border-gray-200 bg-white text-gray-800 hover:border-gray-900 hover:text-gray-900"
        }`}
      >
        {plan.cta}
      </Link>
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

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="#hero"
            className="text-sm font-extrabold tracking-[0.18em] text-gray-900"
          >
            DECLUTTER AI
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
        <section
          id="hero"
          className="relative pt-12 lg:pt-20"
        >
          {/* Mesh gradient blob */}
          <div
            className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-[540px] w-full -translate-x-1/2 opacity-60"
            aria-hidden
          >
            <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-sky-200 blur-3xl" />
            <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-blue-100 blur-3xl" />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                AI сервис для недвижимости
              </span>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Уберите лишнее с&nbsp;фото
                <br />
                <span className="text-blue-600">за секунды</span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
                Отметьте кистью, что убрать — AI сделает чистое фото для
                объявления.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/studio"
                  className="inline-flex items-center rounded-full bg-gray-900 px-6 py-3.5 text-sm font-bold text-white ring-4 ring-gray-100 transition hover:-translate-y-0.5 hover:bg-gray-800"
                >
                  Загрузить фото
                </Link>

              </div>

              <p className="mt-4 text-xs text-gray-400">
                Визуальная подготовка фото — помогает показать потенциал
                помещения без изменения фактических характеристик.
              </p>

              {/* Mini trust signals */}
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {["Бесплатный старт", "Без установки", "Результат за 15 сек"].map((label) => (
                  <Pill key={label} variant="secondary">
                    <PillIndicator variant="success" />
                    {label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="lg:pt-2">
              <BeforeAfterSlider
                id="demo"
                beforeSrc="/images/hero-before.png"
                afterSrc="/images/hero-after.png"
                beforeAlt="Комната до обработки"
                afterAlt="Комната после обработки"
              />
            </div>
          </div>
        </section>

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

        {/* ── Features ── */}
        <section className="mt-24">
          <AccordionFeatureSection
            features={[
              {
                id: 1,
                title: "Просто",
                description: "Проведите кистью по лишним предметам — остальное сделает AI. Не нужен Photoshop или специальные навыки.",
                image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80",
              },
              {
                id: 2,
                title: "Мгновенно",
                description: "Готовое фото за 15 секунд. Нейросеть обрабатывает снимок прямо в браузере — без ожидания и очередей.",
                image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80",
              },
              {
                id: 3,
                title: "Доступно",
                description: "Дешевле, чем услуги дизайнера или фотографа. Первые 10 обработок бесплатно — без карты.",
                image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=80",
              },
              {
                id: 4,
                title: "Без ограничений",
                description: "Делайте сколько угодно проходов — результат улучшается с каждым разом. Точный контроль через ручную маску.",
                image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80",
              },
            ]}
          />
        </section>



        {/* ── Pricing ── */}
        <section id="pricing" className="mt-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Тарифы
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Для одного и для команды
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-500">
              Первые 10 обработок — бесплатно. Без карты.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
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
              Первые 10 обработок бесплатно · Без карты · Результат за 15 секунд
            </p>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-semibold tracking-[0.12em] text-gray-900">
            DECLUTTER AI
          </p>
          <p>Визуальная подготовка фото недвижимости для объявлений</p>
          <p>© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
