import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AcademicYearProvider } from "./context/AcademicYearContext";
import { ToastProvider } from "./context/ToastContext";
import { AppRoutes } from "./routes/AppRoutes";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { useCarouselFade } from "./hooks/useCarouselFade";

function App() {
  useScrollReveal();
  useCarouselFade();

  return (
    <ToastProvider>
      <AuthProvider>
        <AcademicYearProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AcademicYearProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
