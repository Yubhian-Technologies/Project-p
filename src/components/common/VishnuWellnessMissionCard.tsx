import "./VishnuWellnessMissionCard.css";

interface VishnuWellnessMissionCardProps {
  onSelectSection: (sectionId: string) => void;
}

export function VishnuWellnessMissionCard({ onSelectSection }: VishnuWellnessMissionCardProps) {
  return (
    <div className="vwm-wrapper">
      {/* ── Main Mission & Vision Card ───────────────────────── */}
      <div className="vwm-card">
        {/* Header Section */}
        <div className="vwm-header">
          <div className="vwm-header__badge">
            SRI VISHNU EDUCATIONAL SOCIETY • EST. 2017
          </div>

          <div className="vwm-header__main">
            <div className="vwm-header__brand">
              <img
                src="/favicon.png"
                alt="Vishnu Wellness Centre Logo"
                className="vwm-header__logo"
              />
              <div>
                <h2 className="vwm-header__title">Vishnu Wellness Centre</h2>
                <p className="vwm-header__tagline">
                  "Supporting Minds. Empowering Lives. ♡"
                </p>
              </div>
            </div>

            <button
              type="button"
              className="vwm-btn-counsellors"
              onClick={() => onSelectSection("campus-counsellors")}
            >
              MEET OUR COUNSELLORS →
            </button>
          </div>
        </div>

        {/* Content Blocks */}
        <div className="vwm-body">
          {/* OUR VISION */}
          <div className="vwm-block">
            <h4 className="vwm-block__heading vwm-block__heading--vision">
              OUR VISION
            </h4>
            <p className="vwm-block__text">
              To foster a campus community where every student feels supported,
              empowered, and equipped to thrive emotionally, personally, and
              academically.
            </p>
          </div>

          {/* OUR MISSION */}
          <div className="vwm-block">
            <h4 className="vwm-block__heading vwm-block__heading--mission">
              OUR MISSION
            </h4>
            <p className="vwm-block__text">
              Provide accessible, ethical, and confidential psychological
              support, encouraging early intervention while building safe spaces
              for healing.
            </p>
          </div>

          {/* CORE PILLARS */}
          <div className="vwm-block">
            <h4 className="vwm-block__heading vwm-block__heading--pillars">
              CORE PILLARS
            </h4>
            <div className="vwm-pillars">
              <span className="vwm-pill">Compassion</span>
              <span className="vwm-pill">Confidentiality</span>
              <span className="vwm-pill">Empathy</span>
              <span className="vwm-pill">Non-Judgemental</span>
              <span className="vwm-pill">Well-Being</span>
            </div>
            <p className="vwm-pillars__sub">
              Dedicated counsellors working around the clock across all Vishnu
              campuses.
            </p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="vwm-footer">
          <div className="vwm-footer__left">YOUR INSTITUTIONAL WELLNESS TEAM</div>
          <div className="vwm-footer__right">
            100% Confidential • On-Campus & Online
          </div>
        </div>
      </div>
    </div>
  );
}
