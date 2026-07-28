import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { RootLayout } from './components/layout/RootLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { ProtectedLayout } from './components/layout/ProtectedLayout';
import { Login } from './components/auth/Login';
import { ForgotPassword } from './components/auth/ForgotPassword';
import { ResetPassword } from './components/auth/ResetPassword';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Mock components for foundation (These will be replaced by actual modules later)
const Dashboard = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Dashboard Module (Foundation)</div>;
const Pos = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">POS Module (Foundation)</div>;
const Inventory = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Inventory Module (Foundation)</div>;
const Purchasing = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Purchasing Module (Foundation)</div>;
const Sales = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Sales Module (Foundation)</div>;
const Accounting = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Accounting Module (Foundation)</div>;
const Admin = () => <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">Admin Module (Foundation)</div>;

const rootRoute = createRootRoute({
  component: RootLayout,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
});

const loginRoute = createRoute({ getParentRoute: () => authRoute, path: '/login', component: Login });
const forgotPasswordRoute = createRoute({ getParentRoute: () => authRoute, path: '/forgot-password', component: ForgotPassword });
const resetPasswordRoute = createRoute({ getParentRoute: () => authRoute, path: '/reset-password', component: ResetPassword });

const protectedAppRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: ProtectedLayout,
});

// Guarded children routes based on required permissions
const dashboardRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/',
  component: () => <ProtectedRoute component={Dashboard} />
});
const posRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/pos',
  component: () => <ProtectedRoute requiredPermission="process_sales" component={Pos} />
});
const inventoryRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/inventory',
  component: () => <ProtectedRoute requiredPermission="manage_inventory" component={Inventory} />
});
const purchasingRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/purchasing',
  component: () => <ProtectedRoute requiredPermission="manage_purchasing" component={Purchasing} />
});
const salesRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/sales',
  component: () => <ProtectedRoute requiredPermission="view_sales" component={Sales} />
});
const accountingRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/accounting',
  component: () => <ProtectedRoute requiredPermission="manage_accounting" component={Accounting} />
});
const adminRoute = createRoute({
  getParentRoute: () => protectedAppRoute,
  path: '/admin',
  component: () => <ProtectedRoute requiredRole="super_admin" component={Admin} />
});

const routeTree = rootRoute.addChildren([
  authRoute.addChildren([loginRoute, forgotPasswordRoute, resetPasswordRoute]),
  protectedAppRoute.addChildren([
    dashboardRoute,
    posRoute,
    inventoryRoute,
    purchasingRoute,
    salesRoute,
    accountingRoute,
    adminRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
