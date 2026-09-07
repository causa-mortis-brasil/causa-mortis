export interface SiteNavLink {
  href: string;
  label: string;
  external?: boolean;
  icon?: "github";
}

export const siteNavLinks: SiteNavLink[] = [
  { href: "/", label: "Explorar" },
  { href: "/release", label: "Release" },
  { href: "/fontes", label: "Notas" },
  { href: "/baixar-dados", label: "Dados" },
  {
    href: "https://github.com/causa-mortis-brasil",
    label: "GitHub",
    external: true,
    icon: "github",
  },
];
