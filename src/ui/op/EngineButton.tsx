import { forwardRef } from "react";
import { Dot, DotState } from "./Dot";
import { Icon } from "./Icon";

export type EngineButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  dot: DotState;
  name: string;
  state: string;
};

// The button at the top of the sidebar. It is the trigger of the engine menu, so it forwards its ref and every other prop to the <button>.
export const EngineButton = forwardRef<HTMLButtonElement, EngineButtonProps>(function EngineButton({ dot, name, state, ...rest }, ref) {
  return (
    <button type="button" className="engine flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-tile-hover" ref={ref} {...rest}>
      <Dot state={dot} />
      <span className="grow">
        <div className="name truncate">{name}</div>
        <div className="state truncate">{state}</div>
      </span>
      <Icon name="updown" size="sm" className="chev" />
    </button>
  );
});
