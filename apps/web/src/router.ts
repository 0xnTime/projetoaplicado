import { createRouter, createWebHistory, type RouteLocationRaw } from "vue-router";
import type { Role, User } from "@cantina/types";
import { refreshUser, token, user } from "@/lib/session";
import AppLayout from "@/components/AppLayout.vue";

declare module "vue-router" {
  interface RouteMeta {
    public?: boolean;
    role?: Role;
    title?: string;
  }
}

export const homeFor = (current: User): RouteLocationRaw =>
  current.role === "ADMINISTRADOR" ? { name: "admin-reports" } : { name: "home" };

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/entrar",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { public: true, title: "Entrar" },
    },
    {
      path: "/",
      component: AppLayout,
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/views/HomeView.vue"),
          meta: { role: "CONSUMIDOR", title: "Início" },
        },
        {
          path: "comprar",
          name: "purchase",
          component: () => import("@/views/PurchaseView.vue"),
          meta: { role: "CONSUMIDOR", title: "Comprar" },
        },
        {
          path: "carteira",
          name: "wallet",
          component: () => import("@/views/WalletView.vue"),
          meta: { role: "CONSUMIDOR", title: "Carteira" },
        },
        {
          path: "historico",
          name: "history",
          component: () => import("@/views/HistoryView.vue"),
          meta: { role: "CONSUMIDOR", title: "Histórico" },
        },
        {
          path: "admin/relatorios",
          name: "admin-reports",
          component: () => import("@/views/admin/ReportsView.vue"),
          meta: { role: "ADMINISTRADOR", title: "Relatórios" },
        },
        {
          path: "admin/produtos",
          name: "admin-products",
          component: () => import("@/views/admin/ProductsView.vue"),
          meta: { role: "ADMINISTRADOR", title: "Produtos" },
        },
        {
          path: "admin/usuarios",
          name: "admin-users",
          component: () => import("@/views/admin/UsersView.vue"),
          meta: { role: "ADMINISTRADOR", title: "Usuários" },
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  if (to.query.redefinir && to.name !== "login") return { name: "login", query: to.query };

  if (token.value && !user.value) await refreshUser();
  const current = user.value;

  if (to.meta.public) return current && !to.query.redefinir ? homeFor(current) : true;
  if (!current) return { name: "login" };
  if (to.meta.role && to.meta.role !== current.role) return homeFor(current);
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Cantina da Honestidade` : "Cantina da Honestidade";
});
