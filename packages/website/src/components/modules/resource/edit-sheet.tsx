import { useState, type ComponentProps } from "react";

import { Heading, Text } from "@radix-ui/themes";
import { AutoForm } from "@raideno/auto-form/ui";
import { AwesomeListElementSchema } from "shared/types/list";
import { toast } from "sonner";

import type React from "react";

import type { AwesomeListElement } from "shared/types/list";

import { Sheet } from "@/components/ui/sheet";

import { GroupsControllerFactory } from "@/components/controllers/groups-input";
import { useList } from "@/contexts/list";
import { MetadataRegistry } from "@raideno/auto-form/registry";

export interface ResourceEditSheetProps {
  children?: React.ReactNode;
  element: AwesomeListElement;
  state?: { open: boolean; onOpenChange: (open: boolean) => void };
}

export const ResourceEditSheet: React.FC<ResourceEditSheetProps> = ({
  children,
  element,
  state,
}) => {
  const list = useList();

  const groups = Array.from(
    new Set(
      list.content.new.elements
        .map((el) => el.group)
        .filter((group): group is string => typeof group === "string"),
    ),
  );

  const GroupAwareAwesomeListElementSchema = AwesomeListElementSchema.extend({
    group: AwesomeListElementSchema.shape.group.register(MetadataRegistry, {
      controller: GroupsControllerFactory({ groups: groups }) as any,
    }),
  });

  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = state?.open ?? internalOpen;
  const setOpen = state?.onOpenChange ?? setInternalOpen;

  const handleSubmit: ComponentProps<
    typeof AutoForm.Root<typeof GroupAwareAwesomeListElementSchema>
  >["onSubmit"] = async (data, tag, _helpers) => {
    if (tag === "submit")
      try {
        await list.update({
          elements: list.content.new.elements.map((el) =>
            el.name === element.name ? { ...el, ...data } : el,
          ),
        });
        setOpen(false);
      } catch (error) {
        toast.error("Failed to update resource. Please try again.");
      }
    else if (tag === "cancel") {
      setOpen(false);
    } else {
      toast.error("Unknown action. Please try again.");
    }
  };

  const handleError = () => {
    toast.error("Please fix the errors in the form before submitting.");
  };

  return (
    <Sheet.Root open={isOpen} onOpenChange={setOpen}>
      {children && (
        <Sheet.Trigger>{children}</Sheet.Trigger>
      )}
      <Sheet.Content portal={false} side="right">
        <AutoForm.Root
          schema={AwesomeListElementSchema}
          defaultValues={{
            ...element,
          }}
          onSubmit={handleSubmit}
          onError={handleError}
          className="w-full h-full grid grid-rows-[auto_1fr_auto] gap-4"
        >
          <Sheet.Header>
            <>
              <Sheet.Title className="sr-only">Edit Resource</Sheet.Title>
              <Sheet.Description className="sr-only">
                Edit the resource details below. Make changes and click "Save"
                to apply, or "Cancel" to discard.
              </Sheet.Description>
            </>
            <Heading>Edit Resource</Heading>
            <Text>
              Edit the resource details below. Make changes and click "Save" to
              apply, or "Cancel" to discard.
            </Text>
          </Sheet.Header>
          <Sheet.Body>
            <AutoForm.Content
              show={["name", "description", "link", "tags", "group"]}
            />
          </Sheet.Body>
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
                className="w-full"
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
