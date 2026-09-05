/**
 * The HUS mark (M6-0).
 *
 * Served from `public/` rather than inlined, so it stays out of the JS bundle
 * and the attendee page on a phone pays nothing for it. The brand logo is
 * black-only and every ground in the app is light, so it is never recoloured.
 */

interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return <img src="/hus-logo.svg" alt="HUS" className={className} width={482} height={312} />;
}
