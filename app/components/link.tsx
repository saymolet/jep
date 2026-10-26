import { Link as RouterLink, type LinkProps } from "react-router";

type Variant = "default" | "inverse";

const BASE_STYLES = "underline transition-colors";

const VARIANT_STYLES: Record<Variant, string> = {
  default:
    "text-accent decoration-link-line visited:text-link-visited visited:decoration-link-visited-line hover:text-accent-soft hover:decoration-link-line-hover",
  inverse:
    "text-sm text-blue-100 decoration-blue-300 hover:text-white hover:decoration-white",
};

export function Anchor({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a className={`${BASE_STYLES} ${VARIANT_STYLES.default}`} href={href}>
      {children}
    </a>
  );
}

export default function Link({
  variant = "default",
  ...props
}: Omit<LinkProps, "className"> & {
  variant?: Variant;
}) {
  return (
    <RouterLink
      {...props}
      className={`${BASE_STYLES} ${VARIANT_STYLES[variant]}`}
    />
  );
}
