import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
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
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
