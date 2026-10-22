import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ROUTES } from "../config/routes";

const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((module) => ({ default: module.LandingPage })),
);
const Login = lazy(() =>
  import("../pages/auth/Login").then((module) => ({ default: module.Login })),
);
const Signup = lazy(() =>
  import("../pages/auth/Signup").then((module) => ({ default: module.Signup })),
);
const Unauthorized = lazy(() =>
  import("../pages/Unauthorized").then((module) => ({ default: module.Unauthorized })),
);
const UserDashboard = lazy(() =>
  import("../pages/user/UserDashboard").then((module) => ({ default: module.UserDashboard })),
);
const CounsellorDashboard = lazy(() =>
  import("../pages/counsellor/CounsellorDashboard").then((module) => ({ default: module.CounsellorDashboard })),
);
const HeadDashboard = lazy(() =>
  import("../pages/head/HeadDashboard").then((module) => ({ default: module.HeadDashboard })),
);
const AdminDashboard = lazy(() =>
  import("../pages/admin/AdminDashboard").then((module) => ({ default: module.AdminDashboard })),
);
const SuperAdminDashboard = lazy(() =>
  import("../pages/super-admin/SuperAdminDashboard").then((module) => ({ default: module.SuperAdminDashboard })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.signup} element={<Signup />} />
        <Route path={ROUTES.unauthorized} element={<Unauthorized />} />

        <Route
          path={`${ROUTES.user}/*`}
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.counsellor}/*`}
          element={
            <ProtectedRoute allowedRoles={["counsellor"]}>
              <CounsellorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.head}/*`}
          element={
            <ProtectedRoute allowedRoles={["head"]}>
              <HeadDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.admin}/*`}
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.superAdmin}/*`}
          element={
            <ProtectedRoute allowedRoles={["super-admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
