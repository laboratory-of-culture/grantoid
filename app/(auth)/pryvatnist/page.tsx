import Link from "next/link";

export const metadata = { title: "Політика приватності — Grant Assistant" };

/**
 * The privacy policy.
 *
 * In the `(auth)` group so it is readable without an account: a policy you have
 * to sign up to read is not one anybody can use to decide whether to sign up.
 *
 * D1's promise appears here in the words the decision was recorded in. That is
 * the point of writing it down — a policy that softens a commitment the
 * architecture actually makes is worse than no policy, because it quietly
 * relicenses the thing the architecture was built to prevent.
 */
export default function PrivacyPage() {
  return (
    <div className="auth-panel stack">
      <span className="kicker">Політика приватності</span>
      <h1 className="h1">Що ми робимо з вашими даними</h1>

      <p className="prose">
        Grant Assistant працює з документами громадських організацій — статутами, звітами,
        попередніми заявками. Нижче написано, що з ними відбувається. Без загальних слів: якщо
        тут чогось не сказано, значить ми цього не робимо.
      </p>

      <section className="section">
        <h2 className="h3">Документи не залишають нашої інфраструктури</h2>
        <p className="prose">
          Усі мовні моделі працюють локально, на нашому обладнанні. Ваші документи, профіль
          організації та тексти заявок <strong>не надсилаються до жодного зовнішнього сервісу
          штучного інтелекту</strong>. У системі немає ключів до хмарних API — ні до
          Anthropic, ні до OpenAI, ні до будь-якого іншого постачальника.
        </p>
        <p className="prose muted">
          Це архітектурне рішення, а не налаштування: додати такий виклик означало б переписати
          шар, через який усі агенти звертаються до моделі.
        </p>
      </section>

      <section className="section">
        <h2 className="h3">Що ми зберігаємо</h2>
        <ul className="prose">
          <li>Профіль організації — поля, які ви заповнили, і стан кожного з них.</li>
          <li>
            Завантажені документи — файл і витягнутий із нього текст. Кожен факт, витягнутий із
            документа, зберігає цитату й сторінку, з якої його взято.
          </li>
          <li>Оцінки прийнятності та чернетки концепцій, які ви створили.</li>
          <li>Журнал дій: хто і що підтвердив, і коли.</li>
        </ul>
      </section>

      <section className="section">
        <h2 className="h3">Що надсилається поштою</h2>
        <p className="prose">
          Щотижневий лист — <strong>лише за вашою згодою</strong>, вимкненою за замовчуванням.
          Він містить назви конкурсів, донорів і терміни подання: це публічна інформація з
          відкритих джерел. Він <strong>не містить</strong> оцінки прийнятності, полів вашого
          профілю, цитат із ваших документів чи тексту заявок.
        </p>
        <p className="prose muted">
          Лист із поясненням, чому конкурс вам підходить, був би зручнішим. Ми його не
          надсилаємо, бо він проходив би через поштовий сервер і залишався б у поштовій скриньці,
          а обіцянка з винятком заради зручності — не обіцянка.
        </p>
      </section>

      <section className="section">
        <h2 className="h3">Звідки беруться гранти</h2>
        <p className="prose">
          З двох публічних джерел — Ресурсний центр ГУРТ і Громадський Простір. Ми звертаємося
          до них не частіше ніж раз на добу, з обмеженням швидкості, і лише після перевірки
          robots.txt. Зберігаємо заголовок, посилання й дату; повний текст оголошень не
          републікуємо.
        </p>
      </section>

      <section className="section">
        <h2 className="h3">Видалення</h2>
        <p className="prose">
          Видалення організації видаляє її документи — і рядки в базі, і самі файли. Каскад, що
          лишає файли на диску, — це видалення, якого не сталося.
        </p>
      </section>

      <section className="section">
        <h2 className="h3">Дослідна експлуатація</h2>
        <p className="prose">
          Система працює в режимі бети. Добір конкурсів і оцінку прийнятності ще не перевірено
          на живих даних, а умови донорів із PDF система не читає — у неї є лише текст
          оголошення. Кожен висновок треба звіряти з оригіналом.
        </p>
      </section>

      <p className="prose muted">
        <Link href="/vhid">Повернутися до входу</Link>
      </p>
    </div>
  );
}
