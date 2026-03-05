import React from "react";

import { ContextMenu } from "@radix-ui/themes";
import { toast } from "sonner";

import type { AwesomeListElement } from "shared/types/list";
import type { PluginDefinition } from "shared/types/plugins";

import { useList } from "@/contexts/list";
import { usePlugins } from "@/contexts/plugins";

import { OnlyWhenEditingEnabled } from "@/components/layout/only-when-editing-enabled";
import { ResourceEditSheet } from "@/components/modules/resource/edit-sheet";
import { AdminOnly } from "@/components/utils/admin-only";
import { useConfirm } from "@/components/utils/alert-dialog";

type CardContextAction = Extract<
  PluginDefinition["extensions"][number],
  { type: "card.context-action" }
>;

export interface ResourceCardContextMenuProps {
  children?: React.ReactNode;
  element: AwesomeListElement;
}

export const ResourceCardContextMenu: React.FC<
  ResourceCardContextMenuProps
> = ({ children, element }) => {
  const [open, setOpen] = React.useState(false);
  const list = useList();
  const confirm = useConfirm();
  const plugins = usePlugins();

  const cardContextActions = plugins.plugins
    .map((plugin) => ({ ...plugin, extensions: plugin.extensions.map((extension) => ({ ...extension, pluginId: plugin.id })) }))
    .flatMap((plugin) => plugin.extensions)
    .filter((extension) => extension.type === "card.context-action");

  const publicActions = cardContextActions.filter((a) => !a.admin);
  const adminActions = cardContextActions.filter((a) => a.admin);

  const handleDeleteButtonClick = async () => {
    if (!list.canEdit) {
      toast.error("You do not have permission to delete this resource");
      return;
    }

    const confirmation = await confirm({
      title: "Delete Resource",
      body: `Are you sure you want to delete the resource "${element.name}"? This action cannot be undone.`,
    });

    if (confirmation) {
      try {
        await list.update({
          elements: list.content.new.elements.filter(
            (el) => el.name !== element.name,
          ),
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete resource",
        );
      }
    }
  };

  const handleCopyButtonClick = async () => {
    if (!element.link) {
      toast.error("No link available to copy for this resource");
      return;
    }

    try {
      await navigator.clipboard.writeText(element.link);
      toast.success("Link copied to clipboard");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to copy link to clipboard",
      );
    }
  };

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onClick={() => handleCopyButtonClick()}>
            Copy
          </ContextMenu.Item>

          {publicActions.length > 0 && (
            <>
              <ContextMenu.Separator />
              {publicActions.map((action) => (
                <ContextMenu.Item key={action.name} onClick={() => action.onClick(plugins.context(action.pluginId))}>
                  {action.name}
                </ContextMenu.Item>
              ))}
            </>
          )}

          {/* Admin-only items (built-in + admin plugin actions) gated by editing toggle */}
          <AdminOnly>
            <OnlyWhenEditingEnabled>
              <ContextMenu.Separator />
              {adminActions.map((action) => (
                <ContextMenu.Item key={action.name} onClick={() => action.onClick(plugins.context(action.pluginId))}>
                  {action.name}
                </ContextMenu.Item>
              ))}
              <ContextMenu.Item
                disabled={!list.canEdit}
                onClick={() => setOpen(true)}
              >
                Modify
              </ContextMenu.Item>
              <ContextMenu.Item
                color="red"
                disabled={!list.canEdit}
                onClick={() => handleDeleteButtonClick()}
              >
                Delete
              </ContextMenu.Item>
            </OnlyWhenEditingEnabled>
          </AdminOnly>
        </ContextMenu.Content>
      </ContextMenu.Root>

      <OnlyWhenEditingEnabled>
        <ResourceEditSheet
          element={element}
          state={{ open, onOpenChange: setOpen }}
        />
      </OnlyWhenEditingEnabled>
    </>
  );
};
