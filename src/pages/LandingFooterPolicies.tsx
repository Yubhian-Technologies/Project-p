import { useState } from "react";
import { Modal } from "../components/common/Modal";
import "./LandingFooterPolicies.css";

type PolicyKey = "privacy" | "terms" | "accessibility";

const policyTitles: Record<PolicyKey, string> = {
  privacy: "Privacy & Confidentiality",
  terms: "Terms of Use",
  accessibility: "Accessibility Statement",
};

function PolicyContent({ policy }: { policy: PolicyKey }) {
  if (policy === "privacy") {
    return (
      <div className="footer-policy">
        <p>
          Vishnu Wellness Centre is committed to respecting the privacy and dignity of every individual who uses its services.
          This policy explains how personal information is collected, used, accessed and protected when you use our web application.
        </p>
        <section>
          <h3>Information We May Collect</h3>
          <p>
            Depending on the services you use, information may include your name, institutional identification, contact details,
            appointment information, wellness check-in responses and relevant counselling records.
          </p>
        </section>
        <section>
          <h3>How We Use Your Information</h3>
          <p>Information may be used to:</p>
          <ul>
            <li>Facilitate counselling appointments and follow-up support.</li>
            <li>Provide access to wellness resources and programmes.</li>
            <li>Coordinate authorised referrals and support services.</li>
            <li>Evaluate wellness initiatives using appropriate aggregate data.</li>
            <li>Improve the quality and accessibility of our services.</li>
          </ul>
        </section>
        <section>
          <h3>Confidentiality of Counselling</h3>
          <p>
            Counselling information is treated as confidential and is accessible only to authorised individuals for legitimate
            purposes. Information may need to be disclosed in circumstances required by applicable law or when necessary to
            address serious safety concerns, in accordance with applicable procedures.
          </p>
        </section>
        <section>
          <h3>Data Security and Access</h3>
          <p>
            Reasonable technical and organisational safeguards should be implemented to protect personal information against
            unauthorised access, disclosure, alteration or loss. Access to information is restricted according to assigned roles
            and responsibilities.
          </p>
        </section>
        <section>
          <h3>Your Responsibility</h3>
          <p>
            Users should keep their login credentials secure and avoid sharing personal or counselling-related information
            through unauthorised channels.
          </p>
        </section>
        <section>
          <h3>Questions or Concerns</h3>
          <p>
            For questions about privacy or confidentiality, please contact the Vishnu Wellness Centre through the official
            institutional contact channel.
          </p>
        </section>
      </div>
    );
  }

  if (policy === "terms") {
    return (
      <div className="footer-policy">
        <p>
          Welcome to the Vishnu Wellness Centre web application. By accessing or using this platform, you agree to comply with
          these Terms of Use and the applicable institutional policies.
        </p>
        <section>
          <h3>1. Purpose of the Platform</h3>
          <p>
            The web application provides access to wellness resources, counselling services, appointment requests, educational
            materials and related institutional support.
          </p>
        </section>
        <section>
          <h3>2. Appropriate Use</h3>
          <p>Users are expected to:</p>
          <ul>
            <li>Provide accurate information when registering or requesting services.</li>
            <li>Use the platform respectfully and responsibly.</li>
            <li>Respect the privacy and confidentiality of other users.</li>
            <li>Avoid uploading or sharing abusive, misleading, unlawful or harmful content.</li>
            <li>Refrain from attempting unauthorised access to accounts, records or system functions.</li>
          </ul>
        </section>
        <section>
          <h3>3. Counselling Services</h3>
          <p>
            Submitting an appointment request does not necessarily confirm a booking. Appointments are subject to availability
            and confirmation.
          </p>
          <p>
            Counselling and wellness resources support wellbeing but do not replace emergency medical care or other specialised
            services when these are required.
          </p>
        </section>
        <section>
          <h3>4. User Accounts</h3>
          <p>
            Users are responsible for maintaining the security of their login credentials and promptly reporting suspected
            unauthorized access.
          </p>
        </section>
        <section>
          <h3>5. Changes to the Terms</h3>
          <p>
            Vishnu Wellness Centre may update these Terms of Use when necessary. The current version and its effective date
            should be displayed on the web application.
          </p>
        </section>
        <section>
          <h3>6. Contact</h3>
          <p>
            For questions about these terms or the use of the platform, contact the Vishnu Wellness Centre through its official
            institutional contact channel.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="footer-policy">
      <p>
        Vishnu Wellness Centre aims to make its web application accessible, inclusive and easy to use for students, faculty,
        parents and staff with diverse needs and abilities.
      </p>
      <section>
        <h3>Our Accessibility Goals</h3>
        <p>We aim to provide:</p>
        <ul>
          <li>Clear and readable text with appropriate contrast.</li>
          <li>Simple, consistent navigation across pages and dashboards.</li>
          <li>Compatibility with commonly used desktop, tablet and mobile devices.</li>
          <li>Descriptive labels for buttons, forms and interactive elements.</li>
          <li>Keyboard-friendly navigation wherever supported.</li>
          <li>Meaningful alternative text for relevant images.</li>
          <li>Clear instructions and understandable error messages.</li>
          <li>Accessible wellness information presented in a respectful, user-friendly manner.</li>
        </ul>
      </section>
      <section>
        <h3>Continuous Improvement</h3>
        <p>
          We recognise that accessibility is an ongoing process. We aim to identify and address usability barriers as the
          platform develops.
        </p>
      </section>
      <section>
        <h3>Feedback and Assistance</h3>
        <p>
          If you experience difficulty accessing any feature, encounter a display issue or require assistance using the web
          application, please contact the Vishnu Wellness Centre through the official institutional contact channel.
        </p>
        <p>Your feedback helps us improve the accessibility and usability of our services.</p>
      </section>
    </div>
  );
}

export function LandingFooterPolicies() {
  const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);
  const links: Array<{ key: PolicyKey; label: string }> = [
    { key: "privacy", label: "Privacy & Confidentiality" },
    { key: "terms", label: "Terms of Use" },
    { key: "accessibility", label: "Accessibility" },
  ];

  return (
    <>
      <span className="footer-policy-links">
        {links.map(({ key, label }, index) => (
          <span key={key}>
            {index > 0 && <span aria-hidden="true"> | </span>}
            <button type="button" onClick={() => setActivePolicy(key)}>{label}</button>
          </span>
        ))}
      </span>
      {activePolicy && (
        <Modal
          title={policyTitles[activePolicy]}
          onClose={() => setActivePolicy(null)}
          className="footer-policy-modal"
        >
          <PolicyContent policy={activePolicy} />
        </Modal>
      )}
    </>
  );
}
