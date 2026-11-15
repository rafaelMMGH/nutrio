import { ChartColumn, CalendarDays, CookingPot, LayoutGrid, Settings, ShoppingBasket, Trash2 } from "lucide-react";

export type ViewKey = "dashboard" | "plans" | "recipes" | "groceries" | "settings" | "trash";

const ROUTES: Record<ViewKey, string> = {
  dashboard: "/",
  plans: "/plans",
  recipes: "/recipes",
  groceries: "/groceries",
  settings: "/settings",
  trash: "/trash"
};

export function hrefFor(view: ViewKey) {
  return ROUTES[view];
}

// Sidebar order (alt-dashboard §5.2). Análisis has no destination yet (`key: null`).
export const sidebarNav: { key: ViewKey | null; label: string; icon: any; bottom?: boolean }[] = [
  { key: "dashboard", label: "Inicio", icon: LayoutGrid },
  { key: "plans", label: "Planes", icon: CalendarDays },
  { key: "recipes", label: "Recetario", icon: CookingPot },
  { key: "groceries", label: "Compras", icon: ShoppingBasket },
  { key: null, label: "Análisis", icon: ChartColumn },
  { key: "settings", label: "Configuración", icon: Settings, bottom: true }
];

// Account menu entries that are not in the sidebar.
export const accountNav: { key: ViewKey; label: string; icon: any }[] = [{ key: "trash", label: "Papelera", icon: Trash2 }];

// Which nav item a URL belongs to, e.g. "/recipes/abc" -> recipes.
export function activeView(pathname: string): ViewKey {
  const match = (Object.entries(ROUTES) as [ViewKey, string][]).find(([, href]) => href !== "/" && (pathname === href || pathname.startsWith(`${href}/`)));
  return match ? match[0] : "dashboard";
}
