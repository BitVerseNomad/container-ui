import * as React from "react";
import type { Block } from "../lib/containerRows.ts";
import { openUrl } from "../api";
import { Block as OpBlock, Button, Col, Dot, Menu, MoreButton, Row, RowHead, Sparkline, Blocks } from "../ui/op";
import type { DotState } from "../ui/op";

export type RowCommon = {
  name: string;
  meta: string;
  dot: DotState;
  stateWord: string;
  ports: number[];
  stats: string;
  history: number[];
  cpuNow: number | null;
  action: { label: "Stop" | "Start"; busy: boolean; locked: boolean } | null;
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
    id, name, meta, dot, stateWord, ports, stats, history, cpuNow,
    action, selected, onSelect, onOpen, onAction, menu, menuOpen, onMenuOpenChange,
    group, open, onToggle, blocks, runningText,
  } = props;

  const isGroup = group;
  const lead = isGroup ? (
    <Button
      variant="ghost"
      size="xs"
      iconOnly
      icon={open ? "chev-down" : "chev-right"}
      aria-label={`${open ? "Fold" : "Unfold"} ${name}`}
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
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
      meta={meta}
      onOpen={isGroup ? onToggle : onOpen}
      expanded={isGroup ? open : undefined}
      onToggle={isGroup ? onToggle : undefined}
      selected={showCheck ? selected : undefined}
      onSelect={showCheck ? onSelect : undefined}
      menu={menu}
      menuOpen={menuOpen}
      onMenuOpenChange={onMenuOpenChange}
      onMenuKey={() => onMenuOpenChange(true)}
    >
      {isGroup && <OpBlock services={blocks} />}
      <Col kind="ports">
        {ports.map((p) => (
          <a
            key={p}
            className="port"
            href={`http://localhost:${p}`}
            aria-label={`Open port ${p} in the browser`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openUrl(`http://localhost:${p}`); }}
          >
            :{p}
          </a>
        ))}
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
      <Sparkline points={history.length >= 2 ? history : null} label={`CPU ${cpuNow ?? 0} percent`} />
      <Col kind="stats" mono>{stats}</Col>
      <Col kind="state">{stateWord}</Col>
      {action && (
        <Button
          aria-label={`${action.label} ${name}`}
          busy={action.busy}
          aria-disabled={action.locked || undefined}
          onClick={onAction}
        >
          {action.label}
        </Button>
      )}
    </Row>
  );
}

export function ChildRow(props: RowCommon & { id: string }): JSX.Element {
  const {
    id, name, meta, dot, stateWord, ports, stats, history, cpuNow,
    action, selected, onSelect, onOpen, onAction, menu, menuOpen, onMenuOpenChange,
  } = props;

  return (
    <Row
      lead={<Dot state={dot} label={stateWord} />}
      name={name}
      meta={meta}
      onOpen={onOpen}
      selected={selected !== undefined ? selected : undefined}
      onSelect={onSelect}
      menu={menu}
      menuOpen={menuOpen}
      onMenuOpenChange={onMenuOpenChange}
      onMenuKey={() => onMenuOpenChange(true)}
      child
    >
      <Col kind="ports">
        {ports.map((p) => (
          <a
            key={p}
            className="port"
            href={`http://localhost:${p}`}
            aria-label={`Open port ${p} in the browser`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openUrl(`http://localhost:${p}`); }}
          >
            :{p}
          </a>
        ))}
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
      <Sparkline points={history.length >= 2 ? history : null} label={`CPU ${cpuNow ?? 0} percent`} />
      <Col kind="stats" mono>{stats}</Col>
      <Col kind="state">{stateWord}</Col>
      {action && (
        <Button
          aria-label={`${action.label} ${name}`}
          busy={action.busy}
          aria-disabled={action.locked || undefined}
          onClick={onAction}
        >
          {action.label}
        </Button>
      )}
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
