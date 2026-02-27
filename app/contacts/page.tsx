import type { Metadata } from "next";
import { LEGAL } from "@/config/legal";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: `Контакты — ${LEGAL.brandName}`,
  description: `Свяжитесь с командой ${LEGAL.brandName} по вопросам заказов, поддержки и сотрудничества.`,
};

export default function ContactsPage() {
  return (
    <LegalLayout title="Контакты">
      <p className="text-gray-600">
        Мы рады помочь с любыми вопросами по работе сервиса, оформлению и статусу
        заказа, а также возвратам.
      </p>

      <h2>Служба поддержки</h2>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">✉️</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Email
            </p>
            <a
              href={`mailto:${LEGAL.email}`}
              className="text-base font-medium text-blue-600 hover:underline"
            >
              {LEGAL.email}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">📞</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Телефон
            </p>
            <a
              href={`tel:${LEGAL.phone.replace(/\D/g, "")}`}
              className="text-base font-medium text-blue-600 hover:underline"
            >
              {LEGAL.phone}
            </a>
          </div>
        </div>

        {LEGAL.telegram && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">💬</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Telegram
              </p>
              <a
                href={`https://t.me/${LEGAL.telegram.replace("@", "")}`}
                className="text-base font-medium text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {LEGAL.telegram}
              </a>
            </div>
          </div>
        )}
      </div>

      <h2>Реквизиты</h2>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        <p>
          <span className="font-semibold">{LEGAL.sellerType}</span>{" "}
          {LEGAL.sellerName}
        </p>
        <p>ИНН: {LEGAL.sellerInn}</p>
        <p>г.&nbsp;{LEGAL.sellerCity}</p>
      </div>

      <h2>Время ответа</h2>
      <p>
        Обычно мы отвечаем в течение одного рабочего дня. По срочным вопросам
        (технические сбои, срочные возвраты) — напишите нам и укажите в теме письма
        «Срочно».
      </p>

      <h2>Документы</h2>
      <ul>
        <li>
          <a href="/offer" className="text-blue-600 underline">
            Публичная оферта
          </a>
        </li>
        <li>
          <a href="/privacy" className="text-blue-600 underline">
            Политика обработки персональных данных
          </a>
        </li>
        <li>
          <a href="/refund" className="text-blue-600 underline">
            Условия получения услуги и возврата
          </a>
        </li>
      </ul>
    </LegalLayout>
  );
}
