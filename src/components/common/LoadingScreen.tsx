import "./LoadingScreen.css";

export function LoadingScreen() {
  // The intro splash is the loading screen while it is up; avoid stacking a second one.
  if (document.getElementById("splash")) return null;

  return (
    <div className="loading-screen" role="status" aria-label="Loading">
      <img src="/favicon.png" alt="Vishnu Wellness Centre logo" className="loading-screen__logo" />
      <p className="loading-screen__title">Vishnu Wellness Centre</p>
    </div>
  );
}
