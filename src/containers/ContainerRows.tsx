import * as React from "react";
import type { Block } from "../lib/containerRows.ts";
import { openUrl } from "../api";
import { isWebPort } from "../lib/webPort";
import { Button, Col, Dot, Menu, MoreButton, Row, RowHead, Sparkline, Blocks } from "../ui/op";
import type { DotState } from "../ui/op";

// Renders one port link inside a row's Ports cell. When isWebPort says no, the port is a copy chip
// instead of a browser link (database ports, SSH, etc.).
function PortLink({ p, id }: { p: number; id: string }): React.JSX.Element {
  const web = isWebPort(null, p);
  if (web) {
    return (
      <a key={p} className="port" href={`http://localhost:${p}`} aria-label={`Open port ${p} in the browser`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openUrl(`http://localhost:${p}`); }}>
        :{p}
      </a>
    );
  }
  return (
    <a key={p} className="port" href="#" aria-label={`Copy localhost:${p}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void navigator.clipboard.writeText(`localhost:${p}`); }}>
      :{p}
    </a>
  );
}

export type RowCommon = {
  name: string;
  meta: string;
  dot: DotState;
  stateWord: string;
  ariaLabel?: string;
  ports: number[];
  stats: string;
  history: number[];
  cpuNow: number | null;
  action: { label: "Stop" | "Start" | "Open"; busy: boolean; locked: boolean } | null;
  selected: boolean;
  onSelect: ((v: boolean) => void) | null;
  onOpen: () => void;
  onAction: () => void;
  menu: React.ReactNode | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
};

type EntryGroupProps = RowCommon & {
  group: true;
  open: boolean;
  onToggle: () => void;
  blocks: Block[];
  runningText: string;
  id: string;
};

type EntrySingleProps = RowCommon & {
  group: false;
  id: string;
};

export type EntryProps = EntryGroupProps | EntrySingleProps;

export function EntryRow(props: EntryProps): JSX.Element {
  const {
    id, name, meta, dot, stateWord, ariaLabel, ports, stats, history, cpuNow,
    action, selected, onSelect, onOpen, onAction, menu, onMenuOpenChange,
  } = props;
  const isGroup = props.group === true;
  const group = isGroup ? props as EntryGroupProps : null;
  const open = group?.open ?? false;
  const onToggle = group?.onToggle;
  const blocks = group?.blocks;
  const runningText = group?.runningText;

  const lead = isGroup ? (
    <Button
      variant="ghost"
      size="xs"
      iconOnly
      icon={open ? "chev-down" : "chev-right"}
      aria-label={`${open ? "Fold" : "Unfold"} ${name}`}
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
    />
  ) : (
    <Dot state={dot} label={stateWord} />
  );

  const rowDot = isGroup ? <Dot state={dot} /> : undefined;

  const showCheck = onSelect !== null;

  return (
    <Row
      lead={lead}
      dot={rowDot}
      name={name}
      nameClass="shrink-0"
      meta={meta}
      ariaLabel={ariaLabel}
      onOpen={isGroup ? onToggle ?? onOpen : onOpen}
      expanded={isGroup ? open : undefined}
      onToggle={isGroup ? onToggle : undefined}
      selected={showCheck ? selected : undefined}
      onSelect={showCheck ? onSelect : undefined}
      action={action ? (
        <Button
          aria-label={`${action.label} ${name}`}
          busy={action.busy}
          aria-disabled={action.locked || undefined}
          onClick={onAction}
        >
          {action.label}
        </Button>
      ) : undefined}
      menu={menu}
      onMenuKey={() => onMenuOpenChange(true)}
    >
      {isGroup && blocks && <span className="hidden lg:block"><Blocks services={blocks} /></span>}
      <Col kind="ports">
        {ports.map((p) => <PortLink key={p} p={p} id={id} />)}
        {ports.length > 2 && (
          <a
            className="port"
            href={`#/containers/${id}/network`}
            onClick={(e) => e.stopPropagation()}
          >
            +{ports.length - 2}
          </a>
        )}
      </Col>
      <span className="hidden xl:block"><Sparkline points={history.length >= 2 ? history : null} label={`CPU ${cpuNow ?? 0} percent`} /></span>
      <Col kind="stats" mono>{stats}</Col>
      <Col kind="state">{isGroup ? runningText ?? "" : stateWord}</Col>
    </Row>
  );
}

export function ChildRow(props: RowCommon & { id: string }): JSX.Element {
  const {
    id, name, meta, dot, stateWord, ariaLabel, ports, stats, history, cpuNow,
    action, selected, onSelect, onOpen, onAction, menu, onMenuOpenChange,
  } = props;

  return (
    <Row
      lead={<Dot state={dot} label={stateWord} />}
      name={name}
      nameClass="shrink-0"
      meta={meta}
      ariaLabel={ariaLabel}
      onOpen={onOpen}
      selected={selected !== undefined ? selected : undefined}
      onSelect={onSelect ? (v: boolean) => onSelect(v) : undefined}
      action={action ? (
        <Button
          aria-label={`${action.label} ${name}`}
          busy={action.busy}
          aria-disabled={action.locked || undefined}
          onClick={onAction}
        >
          {action.label}
        </Button>
      ) : undefined}
      menu={menu}
      onMenuKey={() => onMenuOpenChange(true)}
      child
    >
      <Col kind="ports">
        {ports.map((p) => <PortLink key={p} p={p} id={id} />)}
        {ports.length > 2 && (
          <a
            className="port"
            href={`#/containers/${id}/network`}
            onClick={(e) => e.stopPropagation()}
          >
            +{ports.length - 2}
          </a>
        )}
      </Col>
      <span className="hidden xl:block"><Sparkline points={history.length >= 2 ? history : null} label={`CPU ${cpuNow ?? 0} percent`} /></span>
      <Col kind="stats" mono>{stats}</Col>
      <Col kind="state">{stateWord}</Col>
    </Row>
  );
}

export function TableHeadRow(): JSX.Element {
  return (
    <RowHead menuGap>
      <span className="lead" />
      <span className="name">Name</span>
      <span className="meta grow">Image or folder</span>
      <Col kind="ports">Ports</Col>
      <Col kind="cpu">CPU, 10 min</Col>
      <Col kind="stats">Now</Col>
      <Col kind="state">State</Col>
      <span className="act" />
    </RowHead>
  );
}

// The row's "..." button and its menu, in one place so every row opens it the same way. The items come from the
// screen (they need its state); the trigger and the controlled open state belong to the row.
export function RowMenu({ name, items, open, onOpenChange }: {
  name: string;
  items: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <Menu trigger={<MoreButton name={name} />} label={`Actions for ${name}`} align="end" wide open={open} onOpenChange={onOpenChange}>
      {items}
    </Menu>
  );
}
