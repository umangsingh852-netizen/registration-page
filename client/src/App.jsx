
import { useEffect, useRef, useState } from "react";
import "./index.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3212";

const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

const BRANCHES = [
  "CSE",
  "CSE (AI & ML)",
  "IT",
  "ECE",
  "EN",
  "ME",
  "CS (Data Science)",
  "CE",
];

const INITIAL_FORM = {
  fullName: "",
  studentNumber: "",
  universityRollNo: "",
  branch: "",
  gender: "",
  residence: "",
  currentYear: "",
  section: "",
  collegeEmail: "",
  whatsapp: "",
};

const EMPTY_ERRORS = {};

function validateAcademic(form) {
  const errors = {};

  if (form.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name as printed on your college ID.";
  } else if (form.fullName.trim().length > 100) {
    errors.fullName = "Name must be 100 characters or fewer.";
  }

  const studentNumber = form.studentNumber.trim();

  if (!studentNumber) {
    errors.studentNumber = "Student number is required.";
  } else if (!/^[A-Za-z0-9/-]{3,50}$/.test(studentNumber)) {
    errors.studentNumber = "Enter a valid student number.";
  } else if (studentNumber.startsWith("26")) {
    errors.studentNumber =
      "First-year students are not eligible. Please enter an eligible student number.";
  }

  const roll = form.universityRollNo.trim();

  if (!roll) {
    errors.universityRollNo = "University roll number is required.";
  } else if (!/^\d{13}$/.test(roll)) {
    errors.universityRollNo =
      "Enter your 13-digit university roll number.";
  } else if (!["23", "24", "25"].some((prefix) => roll.startsWith(prefix))) {
    errors.universityRollNo =
      "First-year students are not allowed. Enter a roll number starting with 23, 24 or 25.";
  } else if (!roll.includes("027")) {
    errors.universityRollNo =
      "This roll number must contain college code 027.";
  }

  if (!BRANCHES.includes(form.branch)) {
    errors.branch = "Select your branch.";
  }

  if (!["Male", "Female", "Other", "Prefer not to say"].includes(form.gender)) {
    errors.gender = "Select a gender option.";
  }

  if (!["Dayscholar", "Hosteler"].includes(form.residence)) {
    errors.residence = "Select your residence type.";
  }

  if (!["2", "3", "4"].includes(form.currentYear)) {
    errors.currentYear = "Only second-, third- and fourth-year students may register.";
  }

  if (form.section.trim().length > 30) {
    errors.section = "Section must be 30 characters or fewer.";
  }

  return errors;
}

function validateVerification(form) {
  const errors = {};

  const email = form.collegeEmail.trim();

  if (!email) {
    errors.collegeEmail = "College email is required.";
  } else if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.collegeEmail = "Enter a valid email address.";
  }

  const whatsapp = form.whatsapp.replace(/[\s()-]/g, "");

  if (!/^\+?[1-9]\d{7,14}$/.test(whatsapp)) {
    errors.whatsapp =
      "Enter a valid WhatsApp number, including country code if needed.";
  }

  return errors;
}

function Turnstile({ onToken, resetSignal }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbackRef = useRef(onToken);

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;
    let pollId;

    const renderWidget = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.turnstile ||
        widgetIdRef.current !== null
      ) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(
        containerRef.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          callback: (token) => callbackRef.current(token),
          "expired-callback": () => callbackRef.current(""),
          "error-callback": () => callbackRef.current(""),
        }
      );
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector(
        'script[data-turnstile-script="true"]'
      );

      const script = existing || document.createElement("script");

      if (!existing) {
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        document.head.appendChild(script);
      }

      script.addEventListener("load", renderWidget);

      // Handles the case where another component loaded the script first.
      pollId = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(pollId);
          renderWidget();
        }
      }, 200);

      script.addEventListener("error", () => {
        callbackRef.current("");
      });
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);

      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      resetSignal > 0 &&
      widgetIdRef.current !== null &&
      window.turnstile
    ) {
      callbackRef.current("");
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <div className="captcha-placeholder">
        CAPTCHA is not configured. Add VITE_TURNSTILE_SITE_KEY to
        client/.env.local.
      </div>
    );
  }

  return <div ref={containerRef} className="turnstile-container" />;
}

export default function App() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMessage("");
  }

  function continueToVerification(event) {
    event.preventDefault();

    const nextErrors = validateAcademic(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setStep(2);
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    setStep(1);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitRegistration(event) {
    event.preventDefault();

    const nextErrors = {
      ...validateAcademic(form),
      ...validateVerification(form),
    };

    if (!captchaToken) {
      nextErrors.captcha = "Complete the CAPTCHA verification.";
    }

    if (!confirmed) {
      nextErrors.confirmed = "Please confirm that your details are accurate and you will attend.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage("Please correct the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          studentNumber: form.studentNumber.trim(),
          universityRollNo: form.universityRollNo.trim(),
          branch: form.branch,
          gender: form.gender,
          residence: form.residence,
          currentYear: Number(form.currentYear),
          section: form.section.trim() || null,
          collegeEmail: form.collegeEmail.trim().toLowerCase(),
          whatsapp: form.whatsapp.trim(),
          turnstileToken: captchaToken,
          attendanceConfirmed: confirmed,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          setMessage(
            data.error || "These details may already be registered."
          );
        } else if (response.status === 429) {
          setMessage("Too many attempts. Please wait and try again.");
        } else if (response.status === 400) {
          setMessage(
            data.error || "Some details are invalid. Please review them."
          );
        } else {
          setMessage(
            data.error || "Registration failed. Please try again."
          );
        }

        setCaptchaToken("");
        setCaptchaReset((previous) => previous + 1);
        return;
      }

      setSuccess(true);
      setMessage(
        data.message || "Registration completed successfully."
      );
      setCaptchaToken("");
    } catch {
      setMessage(
        "Unable to reach the registration server. Check your connection and try again."
      );
      setCaptchaToken("");
      setCaptchaReset((previous) => previous + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="page-shell">
        <section className="success-card">
          <div className="success-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">HOUR OF CODE · 27TH</p>
          <h1>You're registered.</h1>
          <p className="muted">
            {message} Keep an eye on your college email for any
            further event information.
          </p>
          <div className="summary-card">
            <span>{form.fullName}</span>
            <span>{form.branch} · Year {form.currentYear}</span>
          </div>
        </section>
      </main>
    );
  }

  const academicFields = [
    {
      name: "fullName",
      label: "Full name",
      hint: "As printed on your college ID",
    },
    {
      name: "studentNumber",
      label: "Student number",
      hint: "Enter your student number",
    },
    {
      name: "universityRollNo",
      label: "University roll number",
      hint: "e.g. 2500271530137",
    },
  ];

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Hour of Code home">
          <span className="brand-mark">H</span>
          <span>HOUR OF CODE</span>
        </a>
        <span className="event-date">27TH · COLLEGE EVENT</span>
      </header>

      <section className="registration-card">
        <div className="intro">
          <p className="eyebrow">DSA CODING CONTEST</p>
          <h1>Reserve your seat.</h1>
          <p className="muted">
            Register with your academic details to join Hour of Code.
          </p>
        </div>

        <div
          className="step-indicator"
          aria-label={`Step ${step} of 2`}
        >
          <div className={`step-line ${step >= 1 ? "active" : ""}`} />
          <div className={`step-line ${step >= 2 ? "active" : ""}`} />
        </div>

        <div className="step-caption">
          STEP 0{step} OF 02
          <span>
            {step === 1 ? "ACADEMIC INFORMATION" : "VERIFICATION"}
          </span>
        </div>

        {step === 1 && (
          <form onSubmit={continueToVerification} noValidate>
            <div className="form-grid">
              {academicFields.map((field) => (
                <div
                  key={field.name}
                  className={`field ${
                    field.name === "fullName" ? "full-width" : ""
                  }`}
                >
                  <label htmlFor={field.name}>{field.label}</label>
                  <input
                    id={field.name}
                    name={field.name}
                    autoComplete={
                      field.name === "fullName" ? "name" : "off"
                    }
                    value={form[field.name]}
                    onChange={(event) =>
                      updateField(field.name, event.target.value)
                    }
                    placeholder={field.hint}
                    maxLength={field.name === "fullName" ? 100 : 50}
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={
                      errors[field.name] ? `${field.name}-error` : undefined
                    }
                  />
                  {field.name === "studentNumber" &&
                    form.studentNumber.trim().startsWith("26") && (
                      <p className="field-warning" role="alert">
                        First-year students are not allowed.
                      </p>
                    )}
                  {field.name === "universityRollNo" &&
                    form.universityRollNo.trim().startsWith("26") && (
                      <p className="field-warning" role="alert">
                        First-year students are not allowed. Enter a roll
                        number starting with 23, 24 or 25.
                      </p>
                    )}
                  {errors[field.name] && (
                    <p className="field-error" id={`${field.name}-error`}>
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}

              <div className="field">
                <label htmlFor="branch">Branch</label>
                <select
                  id="branch"
                  value={form.branch}
                  onChange={(event) => updateField("branch", event.target.value)}
                  aria-invalid={Boolean(errors.branch)}
                >
                  <option value="">Select branch</option>
                  {BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                {errors.branch && <p className="field-error">{errors.branch}</p>}
              </div>

              <div className="field">
                <label htmlFor="currentYear">Current year</label>
                <select
                  id="currentYear"
                  value={form.currentYear}
                  onChange={(event) =>
                    updateField("currentYear", event.target.value)
                  }
                  aria-invalid={Boolean(errors.currentYear)}
                >
                  <option value="">Select year</option>
                  <option value="2">2nd year</option>
                  <option value="3">3rd year</option>
                  <option value="4">4th year</option>
                </select>
                {errors.currentYear && (
                  <p className="field-error">{errors.currentYear}</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(event) => updateField("gender", event.target.value)}
                  aria-invalid={Boolean(errors.gender)}
                >
                  <option value="">Select option</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && <p className="field-error">{errors.gender}</p>}
              </div>

              <div className="field">
                <label htmlFor="residence">Residence</label>
                <select
                  id="residence"
                  value={form.residence}
                  onChange={(event) =>
                    updateField("residence", event.target.value)
                  }
                  aria-invalid={Boolean(errors.residence)}
                >
                  <option value="">Select residence</option>
                  <option value="Dayscholar">Dayscholar</option>
                  <option value="Hosteler">Hosteler</option>
                </select>
                {errors.residence && (
                  <p className="field-error">{errors.residence}</p>
                )}
              </div>

              <div className="field">
                <label htmlFor="section">
                  Section <span className="optional">(optional)</span>
                </label>
                <input
                  id="section"
                  value={form.section}
                  onChange={(event) =>
                    updateField("section", event.target.value)
                  }
                  placeholder="e.g. A"
                  maxLength={30}
                />
                {errors.section && (
                  <p className="field-error">{errors.section}</p>
                )}
              </div>
            </div>

            <button className="primary-button" type="submit">
              Continue to verification <span aria-hidden="true">→</span>
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitRegistration} noValidate>
            <div className="summary-card">
              <div className="summary-heading">
                <div>
                  <p className="eyebrow">YOUR DETAILS</p>
                  <h2>{form.fullName.trim()}</h2>
                  <p className="muted">
                    {form.branch} · Year {form.currentYear}
                  </p>
                </div>
                <button
                  className="edit-button"
                  type="button"
                  onClick={goBack}
                >
                  Edit
                </button>
              </div>
              <div className="summary-meta">
                <span>University roll no.</span>
                <strong>{form.universityRollNo}</strong>
              </div>
            </div>

            <div className="form-grid verification-grid">
              <div className="field full-width">
                <label htmlFor="collegeEmail">College email ID</label>
                <input
                  id="collegeEmail"
                  type="email"
                  autoComplete="email"
                  value={form.collegeEmail}
                  onChange={(event) =>
                    updateField("collegeEmail", event.target.value)
                  }
                  placeholder="you@college.edu"
                  maxLength={254}
                  aria-invalid={Boolean(errors.collegeEmail)}
                />
                {errors.collegeEmail && (
                  <p className="field-error">{errors.collegeEmail}</p>
                )}
              </div>

              <div className="field full-width">
                <label htmlFor="whatsapp">WhatsApp number</label>
                <input
                  id="whatsapp"
                  type="tel"
                  autoComplete="tel"
                  value={form.whatsapp}
                  onChange={(event) =>
                    updateField("whatsapp", event.target.value)
                  }
                  placeholder="+91 98765 43210"
                  maxLength={20}
                  aria-invalid={Boolean(errors.whatsapp)}
                />
                {errors.whatsapp && (
                  <p className="field-error">{errors.whatsapp}</p>
                )}
              </div>
            </div>

            <div className="captcha-section">
              <label>Security verification</label>
              <Turnstile
                onToken={setCaptchaToken}
                resetSignal={captchaReset}
              />
              {errors.captcha && (
                <p className="field-error">{errors.captcha}</p>
              )}
            </div>

            <label className="confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  setErrors((previous) => ({
                    ...previous,
                    confirmed: undefined,
                  }));
                }}
              />
              <span>
                I confirm that all details are accurate and I will attend
                Hour of Code on the 27th.
              </span>
            </label>
            {errors.confirmed && (
              <p className="field-error">{errors.confirmed}</p>
            )}

            {message && (
              <div
                className={`form-message ${
                  message.toLowerCase().includes("success") ? "success" : ""
                }`}
                role="status"
              >
                {message}
              </div>
            )}

            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                onClick={goBack}
                disabled={submitting}
              >
                ← Back
              </button>
              <button
                className="primary-button submit-button"
                type="submit"
                disabled={submitting || !TURNSTILE_SITE_KEY}
              >
                {submitting ? "Submitting..." : "Submit & Confirm Seat"}
              </button>
            </div>

            {!TURNSTILE_SITE_KEY && (
              <p className="field-warning">
                Configure the Turnstile site key before enabling registration.
              </p>
            )}
          </form>
        )}

        <footer className="card-footer">
          <span>HOUR OF CODE</span>
          <span>Secure registration</span>
        </footer>
      </section>

      <p className="page-note">
        Only eligible students may register. Please review your details before
        confirming your seat.
      </p>
    </main>
  );
}
