"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FeatureItem {
  id: number;
  title: string;
  image: string;
  description: string;
}

interface AccordionFeatureSectionProps {
  features: FeatureItem[];
}

const AccordionFeatureSection = ({ features }: AccordionFeatureSectionProps) => {
  const [activeTabId, setActiveTabId] = useState<number>(features[0].id);
  const [activeImage, setActiveImage] = useState(features[0].image);

  return (
    <div className="overflow-hidden rounded-3xl bg-[#0f1121] px-8 py-10 sm:px-10 lg:px-12 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        {/* Left — heading + accordion */}
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/70">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-emerald-400" aria-hidden>
              <path d="M12 4l1.7 3.9L17.6 9l-3.9 1.7L12 14.6l-1.7-3.9L6.4 9l3.9-1.1L12 4z" strokeLinejoin="round" />
            </svg>
            AI-подготовка фото
          </span>

          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
            Подготовьте фото к публикации{" "}
            <span className="text-emerald-400">за 15 секунд</span>
          </h2>

          <div className="mt-8">
            <Accordion
              type="single"
              defaultValue={`item-${features[0].id}`}
              className="w-full"
            >
              {features.map((tab) => (
                <AccordionItem key={tab.id} value={`item-${tab.id}`}>
                  <AccordionTrigger
                    onClick={() => {
                      setActiveImage(tab.image);
                      setActiveTabId(tab.id);
                    }}
                    className="cursor-pointer py-4 !no-underline transition hover:no-underline"
                  >
                    <h6
                      className={`text-base font-semibold transition-colors ${
                        tab.id === activeTabId
                          ? "text-white"
                          : "text-white/40"
                      }`}
                    >
                      {tab.title}
                    </h6>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mt-1 text-sm leading-relaxed text-white/55">
                      {tab.description}
                    </p>
                    {/* Image shown inline on mobile */}
                    <div className="mt-4 lg:hidden">
                      <img
                        src={tab.image}
                        alt={tab.title}
                        className="h-52 w-full rounded-xl object-cover"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-8">
              <Link
                href="/studio"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Загрузить фото
              </Link>
              <p className="mt-3 text-xs text-white/40">Без регистрации · Без карты</p>
            </div>
          </div>
        </div>

        {/* Right — image preview */}
        <div className="relative hidden overflow-hidden rounded-2xl lg:block">
          <img
            key={activeImage}
            src={activeImage}
            alt="Feature preview"
            className="aspect-[4/3] h-full w-full rounded-2xl object-cover transition-all duration-500"
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        </div>
      </div>
    </div>
  );
};

export { AccordionFeatureSection };
