import React from "react";

import {
  Pencil1Icon,
  PlusIcon,
  StarFilledIcon,
  StarIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import { Box, Card, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { useLongPress } from "shared/hooks/long-press";
import type { PluginDefinition } from "shared/types/plugins";

import { useEditing } from "@/contexts/editing";
import { useList } from "@/contexts/list";

import { OnlyWhenEditingEnabled } from "@/components/layout/only-when-editing-enabled";
import { ThemeSwitchButton } from "@/components/layout/theme-switch-button";
import { ListMetadataEditSheet } from "@/components/modules/misc/list-metadata-edit-sheet";
import { PushChangesDialog } from "@/components/modules/misc/push-changes-dialog";
import { SettingsDialog } from "@/components/modules/misc/settings-dialog";
import { ResourceCreateSheet } from "@/components/modules/resource/create-sheet";
import { useNetwork } from "@/contexts/network";
import { usePlugins, type PluginsContextType } from "@/contexts/plugins";
import { useModals } from "@/contexts/dialogs";

type ActionBarExtension = Extract<
  PluginDefinition["extensions"][number],
  { type: "site.action-bar" }
>;

type ToggleableExtension = Extract<ActionBarExtension, { toggleble: true }>;

interface PluginActionBarButtonProps {
  context: Awaited<ReturnType<PluginsContextType["context"]>>;
  extension: ActionBarExtension;
}

const PluginActionBarButton: React.FC<PluginActionBarButtonProps> = ({ context, extension }) => {
  const [active, setActive] = React.useState(false);

  const isToggleable = (extension: ActionBarExtension): extension is ToggleableExtension =>
    "toggleble" in extension && extension.toggleble === true;

  const button = isToggleable(extension) ? (
    <IconButton
      variant={active ? "solid" : "classic"}
      onClick={() => {
        const next = !active;
        setActive(next);
        extension.onToggle(context, next);
      }}
      aria-pressed={active}
    >
      <extension.icon />
    </IconButton>
  ) : (
    <IconButton
      variant="classic"
      onClick={() => extension.onClick(context)}
    >
      <extension.icon />
    </IconButton>
  );

  if (extension.tooltip) {
    return <Tooltip content={extension.tooltip}>{button}</Tooltip>;
  }

  return button;
};

export interface FloatingActionBarProps {}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = () => {
  const { setOpen: setCreateSheetOpen } = useModals("element.create.sheet");
  const { setOpen: setSettingsOpen } = useModals("settings");
  const { setOpen: setPushChangesOpen } = useModals("push-changes-dialog");
  const { setOpen: setEditMetadataOpen } = useModals("metadata-edit-sheet");

  const network = useNetwork();
  const list = useList();
  const plugins = usePlugins();

  const { hasUnsavedChanges, content } = list;
  const { editingEnabled, setEditingEnabled } = useEditing();

  const isPushingDisabled: [boolean, string] =
    network.state === "offline"
      ? [true, "No internet available to push changes."]
      : !hasUnsavedChanges && !plugins.storage.staged.has
        ? [true, "No changes detected."]
        : [false, "Push changes."];

  const handleToggleEditing = () => {
    const next = !editingEnabled;
    setEditingEnabled(next);
    if (!next) {
      setCreateSheetOpen(false);
      setEditMetadataOpen(false);
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setSettingsOpen(true);
    },
    onClick: handleToggleEditing,
    thresholdInMilliseconds: 500,
  });

  return (
    <>
      <Box>
        <Flex
          direction={"row"}
          align={"center"}
          justify={{ initial: "center", sm: "end" }}
          bottom={{ initial: "5", sm: "5" }}
          right={{ initial: "0", sm: "5" }}
          width={{ initial: "100%", sm: "auto" }}
          position={"fixed"}
          className="z-10"
        >
          <Card>
            <Flex direction={{ initial: "row", sm: "column" }} gap={"2"}>
              {editingEnabled && (
                <>
                  <Tooltip content={isPushingDisabled[1]}>
                    <IconButton
                      variant="classic"
                      disabled={isPushingDisabled[0]}
                      onClick={() => setPushChangesOpen(true)}
                      aria-label="Push changes"
                    >
                      <UploadIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    variant="classic"
                    disabled={!list.canEdit}
                    onClick={() => setCreateSheetOpen(true)}
                  >
                    <PlusIcon />
                  </IconButton>
                  <IconButton
                    variant="classic"
                    disabled={!list.canEdit}
                    onClick={() => setEditMetadataOpen(true)}
                  >
                    <Pencil1Icon />
                  </IconButton>
                </>
              )}

              <ThemeSwitchButton />

                {(plugins.plugins
                  .map((plugin) => ({ ...plugin, extensions: plugin.extensions.map((extension) => ({ ...extension, pluginId: plugin.id })) }))
                  .flatMap((plugin) => plugin.extensions))
                  .filter((extension) => extension.type === "site.action-bar")
                  .filter((extension) => !extension.admin || editingEnabled)
                  .filter((extension) => plugins.ready.includes(extension.pluginId))
                  .map((extension, index) => <PluginActionBarButton key={index} extension={extension} context={plugins.context(extension.pluginId)} />)
                }

              <Tooltip content="Click to toggle editing, Long-press for settings">
                <IconButton
                  variant={"classic"}
                  {...longPressHandlers}
                  aria-label={
                    editingEnabled ? "Disable editing" : "Enable editing"
                  }
                >
                  {editingEnabled ? <StarFilledIcon /> : <StarIcon />}
                </IconButton>
              </Tooltip>
            </Flex>
          </Card>
        </Flex>
      </Box>

      <SettingsDialog />

      <OnlyWhenEditingEnabled>
        <PushChangesDialog yamlContent={content.new} />
        <ListMetadataEditSheet />
        <ResourceCreateSheet />
      </OnlyWhenEditingEnabled>
    </>
  );
};
