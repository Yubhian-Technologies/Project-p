import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { LandingPage } from "../pages/LandingPage";
import { Login } from "../pages/auth/Login";
import { Signup } from "../pages/auth/Signup";
import { Unauthorized } from "../pages/Unauthorized";
import { UserDashboard } from "../pages/user/UserDashboard";
import { CounsellorDashboard } from "../pages/counsellor/CounsellorDashboard";
import { HeadDashboard } from "../pages/head/HeadDashboard";
import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { SuperAdminDashboard } from "../pages/super-admin/SuperAdminDashboard";
import { ROUTES } from "../config/routes";

export function AppRoutes() {
  return (
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
  );
}
