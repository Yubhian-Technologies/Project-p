import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../services/firebase/auth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { useAuth } from "../../hooks/useAuth";
import { dashboardPathForRole } from "../../utils/roleRedirect";
import { Select } from "../../components/common/Select";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import "./AuthForm.css";

export function Signup() {
  const navigate = useNavigate();
  const { currentUser, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeId, setCollegeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && currentUser) {
      navigate(dashboardPathForRole(role), { replace: true });
    }
  }, [loading, currentUser, role, navigate]);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  useEffect(() => {
    setCollegeId("");
    if (!campusId) {
      setColleges([]);
      return;
    }
    listColleges(campusId).then(setColleges);
  }, [campusId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!campusId) {
      setError("Please select your Campus.");
      return;
    }
    if (!collegeId) {
      setError("Please select your College.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email, password, campusId, collegeId);
    } catch {
      setError("Could not create an account. Try a different email.");
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-bg" />
      <div className="auth-bg-overlay" />

      <div className="auth-glass-card">
        <div className="auth-header">
          <Link to="/" className="auth-logo-link">
            <img src="/favicon.png" alt="Vishnu Wellness Center Logo" className="auth-logo-img" />
            <span className="auth-logo-text">Vishnu Wellness Center</span>
          </Link>
          <h1 className="auth-card__title">Create Account</h1>
          <p className="auth-card__subtitle">Join Vishnu Wellness Center and start your journey today</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email Address <span className="auth-field__required">*</span></label>
            <input
              id="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password <span className="auth-field__required">*</span></label>
            <div className="auth-field__password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-field__toggle-visibility"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="campus">Campus <span className="auth-field__required">*</span></label>
            <Select id="campus" value={campusId} onChange={setCampusId}>
              <option value="" disabled>
                Select your campus…
              </option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="auth-field">
            <label htmlFor="college">College <span className="auth-field__required">*</span></label>
            <Select id="college" disabled={!campusId} value={collegeId} onChange={setCollegeId}>
              <option value="" disabled>
                {campusId ? "Select your college…" : "Select a campus first"}
              </option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </Select>
          </div>

          <button className="auth-card__submit" type="submit" disabled={submitting || !campusId || !collegeId}>
            {submitting ? "Creating account…" : "Create Account →"}
          </button>
        </form>

        <p className="auth-card__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
