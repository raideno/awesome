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

import { useEditing } from "@/contexts/editing";
import { useList } from "@/contexts/list";

import { OnlyWhenEditingEnabled } from "@/components/layout/only-when-editing-enabled";
import { ThemeSwitchButton } from "@/components/layout/theme-switch-button";
import { ListMetadataEditSheet } from "@/components/modules/misc/list-metadata-edit-sheet";
import { PushChangesDialog } from "@/components/modules/misc/push-changes-dialog";
import { SettingsDialog } from "@/components/modules/misc/settings-dialog";
import { ResourceCreateSheet } from "@/components/modules/resource/create-sheet";
import { useNetwork } from "@/contexts/network";
import { usePlugins } from "@/contexts/plugins";

export interface FloatingActionBarProps {}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = () => {
  const [editMetadataOpen, setEditMetadataOpen] = React.useState(false);
  const [createResourceOpen, setCreateResourceOpen] = React.useState(false);
  const [pushChangesOpen, setPushChangesOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const network = useNetwork();
  const list = useList();
  const plugins = usePlugins();

  const { hasUnsavedChanges, content } = list;
  const { editingEnabled, setEditingEnabled } = useEditing();

  // TODO: consider them while loading, we might integrate some async initiatiation method on the plugins later.
  plugins.isLoading;
  plugins.error;

  const isPushingDisabled: [boolean, string] =
    network.state === "offline"
      ? [true, "No internet available to push changes."]
      : !hasUnsavedChanges
        ? [true, "No changes detected."]
        : [false, "Push changes."];

  const handleToggleEditing = () => {
    const next = !editingEnabled;
    setEditingEnabled(next);
    if (!next) {
      setCreateResourceOpen(false);
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

  console.log(plugins.plugins)

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
                    onClick={() => setCreateResourceOpen(true)}
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

              {
                plugins.plugins
                  .flatMap((plugin) => plugin.extensions)
                  .filter((extension) => extension.type === "site.action-bar")
                  .map((extension, index) => {
                    return (
                      <IconButton
                        key={index}
                        variant="classic"
                      >
                          <StarIcon />
                      </IconButton>
                    )
                  })
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

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <OnlyWhenEditingEnabled>
        <PushChangesDialog
          yamlContent={content.new}
          open={pushChangesOpen}
          onOpenChange={setPushChangesOpen}
        />
        <ListMetadataEditSheet
          state={{
            open: editMetadataOpen,
            onOpenChange: setEditMetadataOpen,
          }}
        />
        <ResourceCreateSheet
          state={{
            open: createResourceOpen,
            onOpenChange: setCreateResourceOpen,
          }}
        />
      </OnlyWhenEditingEnabled>
    </>
  );
};
