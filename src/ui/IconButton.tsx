import { Icon, IconName } from "./icons";

type Props = { label: string; icon: IconName; onClick: () => void; danger?: boolean; disabled?: boolean };

export default function IconButton({ label, icon, onClick, danger, disabled }: Props) {
  return (
    <button className={danger ? "icon-btn danger" : "icon-btn"} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}
