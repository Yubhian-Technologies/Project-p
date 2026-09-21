import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppRoutes } from "./routes/AppRoutes";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { useCarouselFade } from "./hooks/useCarouselFade";

function App() {
  useScrollReveal();
  useCarouselFade();

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
