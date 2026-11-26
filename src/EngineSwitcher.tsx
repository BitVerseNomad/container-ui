import React from "react";
import { Menu, MenuItem, MenuSeparator, MenuCaption, MenuRadioGroup, MenuRadioItem, EngineButton, Icon, Button } from "./ui/op";
import { Dot } from "./ui/op";
import { type ColimaEngine, dotOf, factsLine, groupEngines, stateLine, buttonLabel } from "./lib/engineModel";

export type EngineSwitcherProps = {
  engines: ColimaEngine[];
  selectedId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onMachines?: () => void; // absent where there are no machines to manage (Windows)
};

export default function EngineSwitcher({
  engines,
  selectedId,
  open,
  onOpenChange,
  onSelect,
  onStart,
  onStop,
  onMachines,
}: EngineSwitcherProps) {
  const selected = engines.find((e) => e.id === selectedId);

  return (
    <Menu
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="engines"
      label="Engines"
      align="start"
      trigger={
        selected ? (
          <EngineButton
            dot={dotOf(selected)}
            name={selected.label}
            state={stateLine(selected)}
            aria-label={buttonLabel(selected)}
          />
        ) : (
          <EngineButton dot="off" name="No engine" state="Not set up" aria-label="Engine: none" />
        )
      }
    >
      {selected ? (
        <>
          <MenuRadioGroup value={selectedId ?? ""} onValueChange={onSelect}>
            {groupEngines(engines).map((group) => (
              <React.Fragment key={group.caption}>
                <MenuCaption>{group.caption}</MenuCaption>
                {group.engines.map((e) => (
                  <MenuRadioItem key={e.id} value={e.id}>
                    <Dot state={dotOf(e)} />
                    <span className="name">{e.name}</span>
                    <span className="meta grow truncate">{factsLine(e)}</span>
                    {selectedId === e.id ? (
                      <Icon name="check" size="sm" />
                    ) : e.state === "stopped" ? (
                      <Button size="xs" onClick={(ev) => { ev.stopPropagation(); onStart(e.id); onOpenChange(false); }}>
                        Start
                      </Button>
                    ) : null}
                  </MenuRadioItem>
                ))}
              </React.Fragment>
            ))}
          </MenuRadioGroup>
          {selected.managed || onMachines ? <MenuSeparator /> : null}
          {selected.managed && selected.state === "running" ? (
            <MenuItem
              label={`Stop ${selected.name}`}
              why="Stops the VM. Containers and data are kept"
              onSelect={() => onStop(selected.id)}
            />
          ) : null}
          {onMachines ? <MenuItem label="Machines…" why="Create, resize or delete a Colima VM" onSelect={onMachines} /> : null}
        </>
      ) : onMachines ? (
        <MenuItem label="Machines…" why="Create, resize or delete a Colima VM" onSelect={onMachines} />
      ) : null}
    </Menu>
  );
}
