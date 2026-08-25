/**
 * Who paid for this, on every page.
 *
 * A condition of the funding rather than a courtesy: the EU's visibility rules
 * require the emblem and the funding statement to be displayed, and «displayed»
 * means legible, not tucked behind a link.
 *
 * Three separate images, not the one strip they arrived as. The supplied file
 * is 15:1 — on a phone it would render «Funded by the European Union» at about
 * five pixels of cap height, which satisfies nobody's visibility requirement.
 * Split, they wrap onto two rows and each stays the same optical size.
 *
 * The marks carry `alt` text and are not decorative: a screen reader that skips
 * them drops the attribution entirely, which is the one thing this block exists
 * to prevent.
 *
 * A server component. It renders the same markup for everybody and has nothing
 * to hydrate.
 */

const LOGOS = [
  {
    src: "/logos/eu.png",
    alt: "Профінансовано Європейським Союзом",
    width: 632,
    height: 136,
  },
  {
    src: "/logos/eed.png",
    alt: "Європейський фонд за демократію (EED)",
    width: 890,
    height: 136,
  },
  {
    src: "/logos/labkult.png",
    alt: "ГО «Лабораторія культурних досліджень»",
    width: 207,
    height: 136,
  },
];

export function Funders() {
  return (
    <footer className="funders">
      <div className="funders-marks">
        {LOGOS.map((logo) => (
          // Plain <img> with both dimensions given, so the row reserves its
          // height before the files arrive. A footer that jumps as its logos
          // load is the layout shift people notice most, because it moves the
          // thing they were about to read.
          <img
            key={logo.src}
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            className="funders-mark"
          />
        ))}
      </div>

      <p className="funders-text">
        Цей вебресурс створено в межах програми підтримки ідей проєкту
        Creative&nbsp;Democracy&nbsp;Boost, який реалізовує ГО «Лабораторія культурних
        досліджень». Проєкт фінансується Європейським Союзом за підтримки Європейського
        фонду за демократію&nbsp;(EED).
      </p>
    </footer>
  );
}
