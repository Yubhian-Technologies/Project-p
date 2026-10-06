import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import "./animated-hero.css";

interface HeroProps {
  currentUser?: any;
  dashboardPath?: string;
}

function Hero({ currentUser, dashboardPath = "/user" }: HeroProps) {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => [
      "transformative",
      "confidential",
      "empowering",
      "compassionate",
      "healing",
    ],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2200);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  const bookingTarget = currentUser ? dashboardPath : "/signup";

  return (
    <section className="animated-hero">
      <div className="animated-hero__container">
        <div className="animated-hero__wrapper">
          {/* Headline with Animated Spring Text & Entrance Effect */}
          <motion.div
            className="animated-hero__content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="animated-hero__headline">
              <span className="animated-hero__headline-static">
                Elevate your mind, body &amp; soul with care that is
              </span>
              <span className="animated-hero__rotator-wrap">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="animated-hero__rotating-word"
                    initial={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -120 : 120,
                            opacity: 0,
                          }
                    }
                  >
                    {title}.
                  </motion.span>
                ))}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="animated-hero__subtitle">
              Book a therapy session with certified psychologists, track
              your personal wellness journey, and receive dedicated counselling
              support—all in one seamless, compassionate space.
            </p>
          </motion.div>

          {/* Action Buttons with Staggered Entrance */}
          <motion.div
            className="animated-hero__actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to={bookingTarget} style={{ textDecoration: "none" }}>
              <Button
                size="lg"
                className="animated-hero__btn-primary"
              >
                <span>Book a Confidential Session</span>
                <MoveRight className="w-4 h-4" />
              </Button>
            </Link>

            <a href="#features" style={{ textDecoration: "none" }}>
              <Button
                size="lg"
                variant="outline"
                className="animated-hero__btn-secondary"
              >
                <span>Explore Features</span>
                <MoveRight className="w-4 h-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export { Hero, Hero as AnimatedHero };
