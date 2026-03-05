import { TextField } from "@radix-ui/themes";

import type React from "react";

import type { AwesomeListElement } from "shared/types/list";

import { type ControllerParams } from "@raideno/auto-form/registry";

export interface ResourceEditSheetProps {
  children?: React.ReactNode;
  element: AwesomeListElement;
  state?: { open: boolean; onOpenChange: (open: boolean) => void };
}

export interface GroupsControllerFactoryProps {
  groups: Array<string>;
}

export const GroupsControllerFactory = ({
  groups,
}: GroupsControllerFactoryProps) => {
  const GroupsController: React.FC<ControllerParams<any, string>> = (props) => {
    const datalistId = `groups-datalist-${props.field.name}`;

    return (
      <div>
        <TextField.Root
          size={"3"}
          value={props.field.value}
          onChange={(event) => props.field.onChange(event.target.value)}
          list={datalistId}
          autoComplete="off"
        />
        <datalist id={datalistId}>
          {groups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </div>
    );
  };

  return GroupsController;
};
