import { Icon, IconName } from "./icons";

// waiting: why the button waits for now (it stays focusable and says so), as opposed to disabled for good.
type Props = { label: string; icon: IconName; onClick: () => void; danger?: boolean; disabled?: boolean; waiting?: string; text?: boolean };

export default function IconButton({ label, icon, onClick, danger, disabled, waiting, text }: Props) {
  return (
    <button className={`${text ? "icon-btn text-btn" : ""}${danger ? " danger" : ""}`} aria-label={waiting ? `${label}. ${waiting}` : label} title={waiting ?? label} aria-disabled={waiting ? true : undefined} onClick={() => !waiting && onClick()} disabled={disabled}>
      <Icon name={icon} />
      {text && <span className="icon-btn-label">{label}</span>}
    </button>
  );
}
