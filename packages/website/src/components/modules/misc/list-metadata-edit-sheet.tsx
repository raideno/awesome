import { useState, type ComponentProps } from "react";

import { Heading, ScrollArea, Text } from "@radix-ui/themes";
import { AutoForm } from "@raideno/auto-form/ui";
import { AwesomeListMetadata } from "shared/types/list";
import { toast } from "sonner";

import type React from "react";

import { Sheet } from "@/components/ui/sheet";
import { useList } from "@/contexts/list";
import { useModals } from "@/contexts/dialogs";

export interface ListMetadataEditSheetProps {
  children?: React.ReactNode;
}

export const ListMetadataEditSheet: React.FC<ListMetadataEditSheetProps> = ({
  children,
}) => {
  const list = useList();

  const { isOpen, setOpen } = useModals("metadata-edit-sheet");

  const handleSubmit: ComponentProps<
    typeof AutoForm.Root<typeof AwesomeListMetadata>
  >["onSubmit"] = async (data, tag, _helpers) => {
    if (tag === "submit") {
      try {
        await list.update({
          ...data,
        });
        setOpen(false);
      } catch (error) {
        toast.error("Failed to update list metadata. Please try again.");
      }
    } else if (tag === "cancel") {
      setOpen(false);
    } else {
      toast.error("Please fix the errors in the form before submitting.");
    }
  };

  const handleError = () => {
    toast.error("Please fix the errors in the form before submitting.");
  };

  return (
    <Sheet.Root open={isOpen && list.canEdit} onOpenChange={setOpen}>
      {children && (
        <Sheet.Trigger disabled={!list.canEdit}>{children}</Sheet.Trigger>
      )}
      <Sheet.Content portal={false} side="right">
        <AutoForm.Root
          schema={AwesomeListMetadata}
          defaultValues={{
            ...list.content.new,
          }}
          onSubmit={handleSubmit}
          onError={handleError}
          className="h-full grid grid-rows-[auto_1fr_auto] gap-4"
        >
          <Sheet.Header>
            <>
              <Sheet.Title className="sr-only">Edit List</Sheet.Title>
              <Sheet.Description className="sr-only">
                Edit the list details below. Make changes and click "Save" to
                apply, or "Cancel" to discard.
              </Sheet.Description>
            </>
            <Heading>Edit List</Heading>
            <Text>
              Edit the list details below. Make changes and click "Save" to
              apply, or "Cancel" to discard.
            </Text>
          </Sheet.Header>
          <ScrollArea scrollbars="vertical">
            <Sheet.Body className="w-full h-full">
              <AutoForm.Content className="w-full" />
            </Sheet.Body>
          </ScrollArea>
          <Sheet.Footer>
            <AutoForm.Actions className="flex flex-col gap-4 w-full items-center">
              <Sheet.Close asChild className="!w-full">
                <AutoForm.Action
                  tag="cancel"
                  className="!w-full"
                  variant="outline"
                >
                  Cancel
                </AutoForm.Action>
              </Sheet.Close>
              <AutoForm.Action
                tag="submit"
                className="!w-full"
                variant="classic"
              >
                Save
              </AutoForm.Action>
            </AutoForm.Actions>
          </Sheet.Footer>
        </AutoForm.Root>
      </Sheet.Content>
    </Sheet.Root>
  );
};
