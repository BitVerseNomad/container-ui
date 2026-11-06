import { useState, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon, IconName } from "./ui/icons";
import { Button } from "./ui/components/Button";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  illustration?: ReactNode;
  action?: { label: string; onClick: () => void };
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao Container UI",
    description: "Gerencie containers, images, volumes, redes e Kubernetes — tudo com orientação para evitar problemas antes que aconteçam.",
    illustration: <Icon name="box" size={48} />,
  },
  {
    id: "runtime",
    title: "Escolha seu Runtime",
    description: "O Container UI detecta automaticamente Colima, OrbStack, Rancher Desktop, Podman Desktop e Docker Desktop. Troque na sidebar quando quiser.",
    illustration: <Icon name="terminal" size={48} />,
  },
  {
    id: "profiles",
    title: "VMs (Profiles)",
    description: "Crie VMs com CPU, memória e disco personalizados. Cada profile é isolado. Ligue/desligue na sidebar com um clique.",
    illustration: <Icon name="sliders" size={48} />,
  },
  {
    id: "doctor",
    title: "Doctor — Diagnóstico Automático",
    description: "O Doctor verifica sua configuração: portas em conflito, memória baixa, redes, Kubernetes, Docker Desktop leftovers. Um clique corrige.",
    illustration: <Icon name="check" size={48} />,
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Precisa de ajuda? Abra o chat (⌘Shift+A) e pergunte: 'Por que meu container reinicia?', 'Como corrigir porta em conflito?', 'Kafka não conecta'. Modelos locais (Ollama) ou gratuitos (OpenRouter).",
    illustration: <Icon name="hammer" size={48} />,
  },
  {
    id: "shortcuts",
    title: "Atalhos de Teclado",
    description: "⌘K — Command Palette\n⌘1–7 — Abas rápidas\n↑↓ — Navegar listas\nEnter — Ação principal\nEsc — Fechar painéis\n⌘B — Toggle sidebar",
    illustration: <Icon name="terminal" size={48} />,
    action: { label: "Começar a usar", onClick: () => {} },
  },
];

const ONBOARDING_KEY = "colima-ui:onboarding-complete";
const DONT_SHOW_KEY = "colima-ui:onboarding-dont-show";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)));
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex]);

  const previous = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  const finish = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    if (dontShow) {
      localStorage.setItem(DONT_SHOW_KEY, "1");
    }
    onComplete();
  }, [dontShow, onComplete]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      previous();
    } else if (e.key === "Escape") {
      finish();
    }
  }, [next, previous, finish]);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    const hidden = localStorage.getItem(DONT_SHOW_KEY);
    if (done || hidden) {
      onComplete();
      return;
    }
    setMounted(true);
    const nativeHandler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      } else if (e.key === "Escape") {
        finish();
      }
    };
    document.addEventListener("keydown", nativeHandler);
    return () => document.removeEventListener("keydown", nativeHandler);
  }, [next, previous, finish, onComplete]);

  if (!mounted) return null;

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return createPortal(
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onKeyDown={handleKeyDown}>
      <div className="onboarding-modal">
        <div className="onboarding-progress" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="onboarding-progress-steps" role="list" aria-label="Progresso do onboarding">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                className={`onboarding-step-indicator ${i === stepIndex ? "current" : ""} ${i < stepIndex ? "completed" : ""}`}
                onClick={() => goToStep(i)}
                aria-current={i === stepIndex ? "step" : undefined}
                aria-label={`${i + 1}. ${s.title}${i < stepIndex ? " (concluído)" : ""}`}
                disabled={i > stepIndex + 1}
              >
                <span className="step-number">{i + 1}</span>
                {i < stepIndex && <Icon name="tick" size={12} />}
              </button>
            ))}
          </div>
          <div className="onboarding-progress-bar" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
            <div className="onboarding-progress-bar-fill" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
          </div>
          <span className="onboarding-step-counter">{stepIndex + 1} / {STEPS.length}</span>
        </div>

        <h2 id="onboarding-title" className="onboarding-title">{step.title}</h2>
        <p className="onboarding-description">{step.description}</p>

        {step.illustration && (
          <div className="onboarding-illustration" aria-hidden="true">
            {step.illustration}
          </div>
        )}

        {!isLast && (
          <div className="onboarding-dont-show">
            <label className="dont-show-label">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
              />
              <span>Não mostrar novamente</span>
            </label>
          </div>
        )}

        <div className="onboarding-actions">
          {!isFirst && <Button variant="ghost" onClick={previous} icon="chevron" aria-label="Voltar">Voltar</Button>}
          {!isLast && <Button variant="ghost" onClick={skip}>Pular</Button>}
          <Button
            variant="primary"
            onClick={next}
            icon={isLast ? "tick" : "chevron"}
            disabled={stepIndex > STEPS.length - 1}
          >
            {isLast ? "Começar a usar" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}