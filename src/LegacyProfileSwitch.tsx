import React from "react";
import { Profile } from "./api";
import { Button } from "./ui/op";
import { Menu, MenuItem, MenuSeparator } from "./ui/op";
import { Icon } from "./ui/op";
import { openUrl } from "./api";
import { REPO_URL } from "./lib/links";

type LegacyProfileSwitchProps = {
  profiles: Profile[];
  active: string | null;
  shown: (p: Profile) => string;
  onSelect: (name: string) => void;
  onVm: (name: string, op: "starting" | "stopping") => void;
  onRestart?: (name: string) => void;
  vmBusy: boolean;
  onNewProfile: () => void;
};

export default function LegacyProfileSwitch({ profiles, active, shown, onSelect, onVm, onRestart, vmBusy, onNewProfile }: LegacyProfileSwitchProps) {
  const current = profiles.find((p) => p.name === active);
  return (
    <Menu
      label="Switch profile"
      align="start"
      trigger={<Button className="engine" variant="ghost" iconOnly icon="sidebar" aria-label="Engine switcher" />}
    >
      {profiles.map((p) => (
        <MenuItem key={p.name} label={p.name} onSelect={() => onSelect(p.name)} />
      ))}
      {current?.status === "Running" && onRestart ? (
        <>
          <MenuSeparator />
          <MenuItem label="Restart VM" onSelect={() => onRestart(current.name!)} disabled={vmBusy} />
        </>
      ) : null}
      <MenuSeparator />
      <MenuItem label="New profile" onSelect={onNewProfile} />
      <MenuItem label="Manage profiles" onSelect={() => {}} />
      <MenuItem label="Give feedback" onSelect={() => void openUrl(`${REPO_URL}/discussions`)} />
    </Menu>
  );
}
