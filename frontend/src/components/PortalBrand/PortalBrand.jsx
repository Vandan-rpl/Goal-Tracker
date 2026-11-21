import React from "react";
import rubaminLogo from "../../assets/images/rubamin-logo.png";

// Portal name, shown on the sign-in pages, the sidebar and the footer.
export const PORTAL_SHORT_NAME = "GATI";
export const PORTAL_TITLE = "Employee Excellence Portal";
export const PORTAL_FULL_NAME = `${PORTAL_SHORT_NAME} - ${PORTAL_TITLE}`;
export const PORTAL_PILLARS = ["Goal", "Accountability", "Tasks", "Innovation"];

/**
 * The GATI name with a wave animation: each letter bobs in turn (see
 * .gati-wave-letter in index.css). The gradient must be set on each letter
 * (a moving inline-block letter does not show a parent's clipped
 * background), so callers pass it as [&>span]: classes in `className`,
 * along with size and tracking.
 */
export const GatiWordmark = ({
  className = "",
  letterClassName = "bg-clip-text text-transparent",
}) => (
  <h1 className={`leading-none font-black ${className}`} aria-label={PORTAL_SHORT_NAME}>
    {PORTAL_SHORT_NAME.split("").map((letter, i) => (
      <span
        key={i}
        aria-hidden="true"
        className={`gati-wave-letter ${letterClassName}`}
        style={{ animationDelay: `${i * 0.15}s` }}
      >
        {letter}
      </span>
    ))}
  </h1>
);

/**
 * GATI brand block for the top of the sign-in and password cards. The
 * portal name is the headline; the Rubamin logo sits small above it, and
 * the four pillars spell out the acronym underneath.
 */
const PortalBrand = ({ className = "", compact = false }) => (
  <div className={`text-center ${className}`}>
    <img
      src={rubaminLogo}
      alt="Rubamin"
      className={`${compact ? "h-5" : "h-6"} w-auto mx-auto object-contain opacity-90`}
      draggable="false"
    />

    <GatiWordmark
      className={`${compact ? "mt-3 text-4xl tracking-[0.18em] pl-[0.18em]" : "mt-4 text-5xl tracking-[0.2em] pl-[0.2em]"} [&>span]:bg-linear-to-b [&>span]:from-[#ff3348] [&>span]:to-[#a30b1e]`}
    />
    <p className={`${compact ? "mt-1.5 text-sm" : "mt-2 text-base"} font-bold text-[#e8102a]`}>{PORTAL_TITLE}</p>

    <div className={`${compact ? "mt-3 gap-1" : "mt-4 gap-1.5"} grid grid-cols-4`}>
      {PORTAL_PILLARS.map((word) => (
        <div
          key={word}
          className={`rounded-lg bg-red-50/70 border border-red-100 px-1 ${compact ? "py-1.5" : "py-2"}`}
        >
          <div className={`${compact ? "text-base" : "text-lg"} font-black leading-none text-[#e8102a]`}>
            {word[0]}
          </div>
          <div className={`${compact ? "mt-0.5 text-[9.5px]" : "mt-1 text-[10px]"} font-semibold text-slate-600 truncate`}>
            {word}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default PortalBrand;
