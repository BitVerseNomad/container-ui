import { useState, useEffect, ReactNode } from "react";
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
    title: "Bem-vindo ao Colima UI",
    description: "Gerencie containers, images, volumes, redes e Kubernetes — tudo com orientação para evitar problemas.",
    illustration: <Icon name="box" size={48} />,
  },
  {
    id: "runtime",
    title: "Escolha seu Runtime",
    description: "O Colima UI detecta automaticamente Colima, OrbStack, Rancher Desktop, Podman Desktop e Docker Desktop. Troque na sidebar.",
    illustration: <Icon name="terminal" size={48} />,
  },
  {
    id: "profiles",
    title: "VMs (Profiles)",
    description: "Crie VMs com CPU, memória e disco personalizados. Cada profile é isolado. Ligue/desligue na sidebar.",
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
    description: "Precisa de ajuda? Abra o chat (sidebar) e pergunte: 'Por que meu container reinicia?', 'Como corrigir porta em conflito?', 'Kafka não conecta'. Modelos locais (Ollama) ou gratuitos (OpenRouter).",
    illustration: <Icon name="hammer" size={48} />,
  },
  {
    id: "shortcuts",
    title: "Atalhos de Teclado",
    description: "⌘K — Command Palette\n⌘1–7 — Abas rápidas\n↑↓ — Navegar listas\nEnter — Ação principal\nEsc — Fechar painéis",
    illustration: <Icon name="terminal" size={48} />,
    action: { label: "Começar", onClick: () => {} },
  },
];

const ONBOARDING_KEY = "colima-ui:onboarding-complete";

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done) {
      onComplete();
    }
  }, [onComplete]);

  if (!mounted) return null;
  if (localStorage.getItem(ONBOARDING_KEY)) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, "1");
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const skip = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  };

  return createPortal(
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-modal">
        <div className="onboarding-progress" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="onboarding-progress-bar" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
          <span className="onboarding-step-counter">{stepIndex + 1} / {STEPS.length}</span>
        </div>

        <h2 id="onboarding-title" className="onboarding-title">{step.title}</h2>
        <p className="onboarding-description">{step.description}</p>

        {step.illustration && (
          <div className="onboarding-illustration" aria-hidden="true">
            {step.illustration}
          </div>
        )}

        <div className="onboarding-actions">
          {!isLast && <Button variant="ghost" onClick={skip}>Pular</Button>}
          <Button
            variant="primary"
            onClick={next}
            icon={isLast ? "tick" : "chevron"}
          >
            {isLast ? "Começar" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}